#!/usr/bin/env python3
"""Incremental episode detection for real-time updates (Phase 1)"""

import os
import logging
import psycopg
import pandas as pd
import numpy as np
import ruptures as rpt
from datetime import datetime, timedelta
from statsmodels.tsa.regime_switching.markov_regression import MarkovRegression

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def incremental_detect_episodes(db_url: str, days_back: int = 30, min_episode_length: int = 10):
    """
    Detect new episodes and update existing ones incrementally.

    Uses rolling window Markov Switching on recent data + PELT changepoint detection.
    Idempotent: safe to run multiple times same day (uses UPSERT logic).

    Args:
        db_url: PostgreSQL connection string (psycopg v3)
        days_back: How many days of recent data to analyze (default 30)
        min_episode_length: Minimum episode duration in days

    Returns:
        dict with counts of new/updated/closed episodes
    """

    logger.info(f"Starting incremental episode detection (last {days_back} days)...")

    conn = psycopg.connect(db_url)
    try:
        cur = conn.cursor()

        # 1. Fetch recent market data
        cutoff_date = (datetime.now() - timedelta(days=days_back)).date()
        logger.info(f"Fetching market data since {cutoff_date}...")

        cur.execute("""
            SELECT date, spy_price, vix, cpi, fed_rate, yield_spread, unemployment
            FROM market_state
            WHERE spy_price IS NOT NULL AND date >= %s
            ORDER BY date ASC
        """, (cutoff_date,))

        rows = cur.fetchall()
        if len(rows) < 2:
            logger.warning(f"Insufficient data: {len(rows)} rows. Need at least 2.")
            return {'new_episodes_count': 0, 'updated_episodes_count': 0, 'closed_episodes_count': 0}

        # 2. Prepare data for fitting
        dates = [row[0] for row in rows]
        spy_prices = np.array([row[1] for row in rows])
        vix_list = [row[2] for row in rows]
        cpi_list = [row[3] for row in rows]
        fed_list = [row[4] for row in rows]
        yield_list = [row[5] for row in rows]
        unemploy_list = [row[6] for row in rows]

        # 3. Calculate returns for changepoint detection
        returns = np.diff(np.log(spy_prices)) * 100
        returns = np.concatenate([[0], returns])

        # Calculate rolling volatility (21-day)
        rolling_vol = pd.Series(returns).rolling(window=21).std().fillna(0).values

        # Combine features for PELT
        features = np.column_stack([returns, rolling_vol])

        # 4. Detect changepoints
        logger.info("Running incremental changepoint detection...")

        # PELT requires sufficient data; skip if window is too small
        if len(features) < 20:
            logger.info(f"Insufficient data for changepoint detection ({len(features)} < 20), skipping PELT")
            changepoints = [len(features)]  # Single segment covering all data
        else:
            try:
                algo = rpt.Pelt(model="l2", min_size=min_episode_length).fit(features)
                changepoints = algo.predict(pen=10)
            except Exception as e:
                logger.warning(f"PELT detection failed: {e}, using single segment")
                changepoints = [len(features)]  # Fallback: treat as single episode

        # 5. Fit Markov Switching on recent window (252 days for stability)
        logger.info("Fitting Markov Switching model on recent data...")
        window_size = min(252, len(returns))
        returns_window = returns[-window_size:]

        try:
            markov_states = fit_markov_switching(returns_window)
            if markov_states is None:
                logger.warning("Markov fit failed, skipping this run")
                return {'new_episodes_count': 0, 'updated_episodes_count': 0, 'closed_episodes_count': 0}
        except Exception as e:
            logger.warning(f"Markov fitting failed: {e}")
            return {'error': str(e)}

        # 6. Convert indices to dates
        offset = len(returns) - len(markov_states)
        episode_boundaries = [0] + changepoints

        new_count = 0
        updated_count = 0
        closed_count = 0

        logger.info(f"Processing {len(changepoints)} changepoints...")

        # 7. Process each segment
        for i in range(len(episode_boundaries) - 1):
            start_idx = episode_boundaries[i]
            end_idx = episode_boundaries[i + 1]

            if end_idx > len(dates):
                end_idx = len(dates)

            if start_idx >= end_idx:
                continue

            start_date = dates[start_idx]
            end_date = dates[end_idx - 1]

            # Extract episode data
            ep_spy = spy_prices[start_idx:end_idx]
            ep_vix = np.array([vix_list[j] if vix_list[j] is not None else np.nan
                              for j in range(start_idx, end_idx)])
            ep_cpi = np.array([cpi_list[j] if cpi_list[j] is not None else np.nan
                              for j in range(start_idx, end_idx)])
            ep_fed = np.array([fed_list[j] if fed_list[j] is not None else np.nan
                              for j in range(start_idx, end_idx)])
            ep_yield = np.array([yield_list[j] if yield_list[j] is not None else np.nan
                                for j in range(start_idx, end_idx)])
            ep_unemploy = np.array([unemploy_list[j] if unemploy_list[j] is not None else np.nan
                                   for j in range(start_idx, end_idx)])

            # Calculate metrics
            total_return = ((ep_spy[-1] - ep_spy[0]) / ep_spy[0]) * 100
            max_drawdown = calculate_max_drawdown(ep_spy)

            avg_vix = float(np.nanmean(ep_vix)) if not np.isnan(np.nanmean(ep_vix)) else None
            avg_cpi = float(np.nanmean(ep_cpi)) if not np.isnan(np.nanmean(ep_cpi)) else None
            avg_fed = float(np.nanmean(ep_fed)) if not np.isnan(np.nanmean(ep_fed)) else None
            avg_yield = float(np.nanmean(ep_yield)) if not np.isnan(np.nanmean(ep_yield)) else None
            avg_unemploy = float(np.nanmean(ep_unemploy)) if not np.isnan(np.nanmean(ep_unemploy)) else None

            # Determine regime using Markov states in this segment
            markov_segment_start = max(0, start_idx - offset)
            markov_segment_end = min(len(markov_states), end_idx - offset)

            if markov_segment_end > markov_segment_start:
                segment_markov = markov_states[markov_segment_start:markov_segment_end]
                regime = classify_regime_markov_simple(segment_markov)
            else:
                regime = "STAGNATION"

            # Get forward 6-month return (if data exists)
            spy_return_6m = None
            six_months_later_idx = end_idx + 126
            if six_months_later_idx < len(spy_prices):
                spy_return_6m = ((spy_prices[six_months_later_idx] - spy_prices[end_idx]) /
                                spy_prices[end_idx]) * 100

            # Check for existing episode with same dates (UPSERT)
            cur.execute("""
                SELECT id, spy_return_6m_after FROM episodes
                WHERE start_date = %s AND end_date = %s
            """, (start_date, end_date))

            existing = cur.fetchone()

            if existing:
                ep_id, old_return = existing

                # Update existing episode
                cur.execute("""
                    UPDATE episodes
                    SET avg_vix = %s, avg_cpi = %s, avg_fed_rate = %s,
                        avg_yield_spread = %s, avg_unemployment = %s,
                        total_return = %s, max_drawdown = %s,
                        spy_return_6m_after = %s,
                        last_updated = NOW(),
                        is_closed = CASE
                            WHEN (CURRENT_DATE - end_date) > 180 THEN TRUE
                            ELSE is_closed
                        END
                    WHERE id = %s
                """, (avg_vix, avg_cpi, avg_fed, avg_yield, avg_unemploy,
                      float(total_return), float(max_drawdown), spy_return_6m, ep_id))

                # Log change if return changed
                if old_return is not None and spy_return_6m is not None:
                    if abs(old_return - spy_return_6m) > 0.01:
                        cur.execute("""
                            INSERT INTO episode_changes
                            (episode_id, event_type, old_return_6m, new_return_6m, changed_at)
                            VALUES (%s, 'extended', %s, %s, NOW())
                        """, (ep_id, old_return, spy_return_6m))

                updated_count += 1
                logger.info(f"Updated episode {ep_id} ({regime}): {start_date} to {end_date}")

            else:
                # Create new episode
                cur.execute("""
                    INSERT INTO episodes
                    (start_date, end_date, regime, avg_vix, avg_cpi, avg_fed_rate,
                     avg_yield_spread, avg_unemployment, total_return, max_drawdown,
                     spy_return_6m_after, episode_created_date, last_updated)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                    RETURNING id
                """, (start_date, end_date, regime, avg_vix, avg_cpi, avg_fed,
                      avg_yield, avg_unemploy, float(total_return),
                      float(max_drawdown), spy_return_6m))

                new_ep_id = cur.fetchone()[0]

                # Log creation
                cur.execute("""
                    INSERT INTO episode_changes (episode_id, event_type, changed_at)
                    VALUES (%s, 'created', NOW())
                """, (new_ep_id,))

                new_count += 1
                logger.info(f"Created episode {new_ep_id} ({regime}): {start_date} to {end_date}")

        # 8. Close old episodes (>180 days without update)
        cutoff_closed = datetime.now() - timedelta(days=180)
        cur.execute("""
            UPDATE episodes
            SET is_closed = TRUE
            WHERE is_closed = FALSE AND last_updated < %s
        """, (cutoff_closed,))

        closed_count = cur.rowcount
        conn.commit()

        result = {
            'new_episodes_count': new_count,
            'updated_episodes_count': updated_count,
            'closed_episodes_count': closed_count
        }
        logger.info(f"✅ Incremental detection complete: {result}")
        return result

    except Exception as e:
        conn.rollback()
        logger.error(f"Incremental detection failed: {e}", exc_info=True)
        return {'error': str(e)}

    finally:
        cur.close()
        conn.close()


def calculate_max_drawdown(prices: np.ndarray) -> float:
    """Calculate maximum drawdown for price series"""
    cummax = np.maximum.accumulate(prices)
    drawdown = (prices - cummax) / cummax * 100
    return float(np.min(drawdown))


def fit_markov_switching(returns: np.ndarray) -> np.ndarray:
    """Fit 4-state Markov Switching model (Guidolin & Timmermann 2007)

    States:
    0: HIGH_RET_LOW_VOL (BULL)
    1: HIGH_RET_HIGH_VOL (RECOVERY)
    2: LOW_RET_LOW_VOL (STAGNATION)
    3: LOW_RET_HIGH_VOL (BEAR)

    Returns: ndarray of regime states or None on failure
    """
    try:
        if len(returns) < 50:
            logger.warning(f"Insufficient returns data ({len(returns)} < 50), cannot fit Markov")
            return None

        model = MarkovRegression(returns, k_regimes=4, trend='c')
        result = model.fit(disp=False)

        regimes = np.argmax(result.smoothed_marginal_probabilities, axis=1)
        distribution = np.bincount(regimes, minlength=4)
        logger.info(f"Markov model fitted. Regimes: BULL={distribution[0]}, "
                   f"RECOVERY={distribution[1]}, STAGNATION={distribution[2]}, BEAR={distribution[3]}")
        return regimes
    except Exception as e:
        logger.warning(f"Markov fitting failed: {e}")
        return None


def classify_regime_markov_simple(markov_states: np.ndarray) -> str:
    """Classify regime based on dominant Markov state

    Markov states (0-3) mapped to regimes:
    0 → BULL
    1 → RECOVERY
    2 → STAGNATION
    3 → BEAR
    """
    if len(markov_states) == 0:
        return "STAGNATION"

    state_counts = np.bincount(markov_states.astype(int), minlength=4)
    dominant_state = np.argmax(state_counts)

    state_to_regime = {
        0: "BULL",
        1: "RECOVERY",
        2: "STAGNATION",
        3: "BEAR"
    }
    return state_to_regime.get(dominant_state, "STAGNATION")


if __name__ == '__main__':
    db_url = os.getenv('DATABASE_URL', 'postgresql://localhost/finmem')
    result = incremental_detect_episodes(db_url, days_back=30)
    print(f"Result: {result}")
