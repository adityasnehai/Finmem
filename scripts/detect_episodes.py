#!/usr/bin/env python3
"""Episode detection using changepoint detection + Markov Switching regimes"""

import os
import logging
import psycopg
import pandas as pd
import numpy as np
import ruptures as rpt
from statsmodels.tsa.regime_switching.markov_regression import MarkovRegression
from fredapi import Fred

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
fred = Fred(api_key=os.getenv('FRED_API_KEY'))


def detect_episodes(db_url: str, min_episode_length: int = 10, incremental: bool = False, days_back: int = 30):
    """Detect market episodes using changepoint detection + Markov Switching regimes

    Args:
        db_url: PostgreSQL connection string
        min_episode_length: Minimum episode duration in days
        incremental: If True, run incremental detection on recent data; if False, full rebuild
        days_back: For incremental mode, days of recent data to analyze
    """
    # Route to incremental detection if requested
    if incremental:
        from scripts.detect_episodes_incremental import incremental_detect_episodes
        return incremental_detect_episodes(db_url, days_back=days_back, min_episode_length=min_episode_length)

    logger.info("Starting full episode detection...")

    conn = psycopg.connect(db_url)
    try:
        cur = conn.cursor()

        # Fetch market data
        logger.info("Fetching market data...")
        cur.execute("""
            SELECT date, spy_price, vix, cpi, fed_rate, yield_spread, unemployment
            FROM market_state
            WHERE spy_price IS NOT NULL
            ORDER BY date ASC
        """)

        rows = cur.fetchall()
        if not rows:
            logger.error("No market data found")
            return

        dates = [row[0] for row in rows]
        spy_prices_list = [row[1] for row in rows]
        vix_list = [row[2] for row in rows]
        cpi_list = [row[3] for row in rows]
        fed_list = [row[4] for row in rows]
        yield_list = [row[5] for row in rows]
        unemploy_list = [row[6] for row in rows]

        spy_prices = np.array(spy_prices_list)

        # Calculate returns for changepoint detection
        returns = np.diff(np.log(spy_prices)) * 100
        returns = np.concatenate([[0], returns])

        # Calculate rolling volatility (21-day)
        rolling_vol = pd.Series(returns).rolling(window=21).std().fillna(0).values

        # Combine features for detection
        features = np.column_stack([returns, rolling_vol])

        # Detect changepoints
        logger.info("Running changepoint detection...")
        algo = rpt.Pelt(model="l2", min_size=min_episode_length).fit(features)
        changepoints = algo.predict(pen=10)

        # Fit 4-state Markov Switching model (Guidolin & Timmermann 2007)
        logger.info("Fitting Markov Switching model (4-state)...")
        markov_states = fit_markov_switching(returns)

        # Fetch Fed Recession Probability
        logger.info("Fetching Fed recession probability data...")
        recession_probs = fetch_recession_probability(dates)

        # Convert to dates
        episode_boundaries = [0] + changepoints
        logger.info(f"Detected {len(changepoints)} changepoints, creating {len(changepoints)} episodes")

        # Create episodes
        cur.execute("DELETE FROM episodes;")
        conn.commit()

        for i in range(len(episode_boundaries) - 1):
            start_idx = episode_boundaries[i]
            end_idx = episode_boundaries[i + 1]

            if end_idx > len(dates):
                end_idx = len(dates)

            start_date = dates[start_idx]
            end_date = dates[end_idx - 1]

            # Extract episode data
            ep_spy = spy_prices[start_idx:end_idx]
            ep_vix = np.array([vix_list[j] if vix_list[j] is not None else np.nan for j in range(start_idx, end_idx)])
            ep_cpi = np.array([cpi_list[j] if cpi_list[j] is not None else np.nan for j in range(start_idx, end_idx)])
            ep_fed = np.array([fed_list[j] if fed_list[j] is not None else np.nan for j in range(start_idx, end_idx)])
            ep_yield = np.array([yield_list[j] if yield_list[j] is not None else np.nan for j in range(start_idx, end_idx)])
            ep_unemploy = np.array([unemploy_list[j] if unemploy_list[j] is not None else np.nan for j in range(start_idx, end_idx)])

            # Calculate metrics
            total_return = ((ep_spy[-1] - ep_spy[0]) / ep_spy[0]) * 100
            max_drawdown = calculate_max_drawdown(ep_spy)

            avg_vix = np.nanmean(ep_vix)
            avg_cpi = np.nanmean(ep_cpi)
            avg_fed = np.nanmean(ep_fed)
            avg_yield = np.nanmean(ep_yield)
            avg_unemploy = np.nanmean(ep_unemploy)

            # Determine regime: Use Markov state, overlay with Fed recession prob
            regime = classify_regime_markov(
                markov_states[start_idx:end_idx],
                start_date, end_date,
                recession_probs
            )

            # Get forward 6-month return (if data exists)
            spy_return_6m = None
            six_months_later_idx = end_idx + 126
            if six_months_later_idx < len(spy_prices):
                spy_return_6m = ((spy_prices[six_months_later_idx] - spy_prices[end_idx]) / spy_prices[end_idx]) * 100

            # Insert episode
            cur.execute("""
                INSERT INTO episodes
                (start_date, end_date, regime, avg_vix, avg_cpi, avg_fed_rate,
                 avg_yield_spread, avg_unemployment, total_return, max_drawdown, spy_return_6m_after)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                start_date, end_date, regime,
                float(avg_vix) if not np.isnan(avg_vix) else None,
                float(avg_cpi) if not np.isnan(avg_cpi) else None,
                float(avg_fed) if not np.isnan(avg_fed) else None,
                float(avg_yield) if not np.isnan(avg_yield) else None,
                float(avg_unemploy) if not np.isnan(avg_unemploy) else None,
                float(total_return),
                float(max_drawdown),
                float(spy_return_6m) if spy_return_6m else None
            ))
            conn.commit()

        cur.execute("SELECT COUNT(*) FROM episodes;")
        episode_count = cur.fetchone()[0]
        logger.info(f"Successfully created {episode_count} episodes")

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
    """
    try:
        model = MarkovRegression(returns, k_regimes=4, trend='c')
        result = model.fit(disp=False)

        regimes = np.argmax(result.smoothed_marginal_probabilities, axis=1)
        logger.info(f"Markov model fitted. Regimes distribution: {np.bincount(regimes, minlength=4)}")
        return regimes
    except Exception as e:
        logger.warning(f"Markov fitting failed: {e}, using simple classification")
        return np.zeros(len(returns))


def fetch_recession_probability(dates: list) -> dict:
    """Fetch Fed Recession Probability (RECPROUSM156N) from FRED

    Returns: dict mapping date to recession probability (0-1)
    """
    try:
        logger.info("Fetching Fed recession probability from FRED...")
        rec_prob = fred.get_series('RECPROUSM156N')

        # Convert to daily by forward-filling monthly data
        date_range = pd.date_range(dates[0], dates[-1], freq='D')
        rec_prob_daily = pd.Series(index=date_range)
        for date, value in rec_prob.items():
            rec_prob_daily[date:] = value
        rec_prob_daily = rec_prob_daily.ffill().bfill()

        return rec_prob_daily.to_dict()
    except Exception as e:
        logger.warning(f"Failed to fetch recession probability: {e}")
        return {}


def classify_regime_markov(markov_states: np.ndarray, start_date, end_date,
                          recession_probs: dict) -> str:
    """Classify regime using Markov states + Fed recession overlay

    Markov states (0-3) are mapped to regimes:
    0 → BULL
    1 → RECOVERY
    2 → STAGNATION
    3 → BEAR

    If Fed recession prob > 50% during episode → RECESSION
    """
    if len(markov_states) == 0:
        return "STAGNATION"

    # Get dominant Markov state
    state_counts = np.bincount(markov_states.astype(int), minlength=4)
    dominant_state = np.argmax(state_counts)

    # Map states to regimes
    state_to_regime = {
        0: "BULL",
        1: "RECOVERY",
        2: "STAGNATION",
        3: "BEAR"
    }
    regime = state_to_regime.get(dominant_state, "STAGNATION")

    # Check Fed recession probability during episode
    try:
        date_range = pd.date_range(start_date, end_date, freq='D')
        recession_values = [recession_probs.get(d.date(), 0) for d in date_range]
        avg_recession_prob = np.mean(recession_values) if recession_values else 0

        if avg_recession_prob > 0.50:
            return "RECESSION"
    except:
        pass

    return regime


if __name__ == '__main__':
    db_url = os.getenv('DATABASE_URL', 'postgresql://localhost/finmem')
    detect_episodes(db_url)
