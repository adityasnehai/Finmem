#!/usr/bin/env python3
"""Database initialization script - creates schema"""

import os
import logging
import psycopg

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def init_database():
    """Initialize PostgreSQL schema"""
    db_url = os.getenv('DATABASE_URL', 'postgresql://localhost/finmem')

    conn = psycopg.connect(db_url)
    try:
        cur = conn.cursor()

        # Try TimescaleDB but don't fail
        logger.info("Creating TimescaleDB extension (optional)...")
        try:
            cur.execute("CREATE EXTENSION IF NOT EXISTS timescaledb;")
        except Exception as e:
            logger.warning(f"TimescaleDB not available: {e}")
        conn.commit()

        # Create market_state table
        logger.info("Creating market_state table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS market_state (
                id BIGSERIAL PRIMARY KEY,
                date DATE NOT NULL UNIQUE,
                spy_price FLOAT8,
                spy_return_1d FLOAT8,
                spy_return_5d FLOAT8,
                spy_return_21d FLOAT8,
                vix FLOAT8,
                rolling_vol_21d FLOAT8,
                cpi FLOAT8,
                fed_rate FLOAT8,
                yield_spread FLOAT8,
                unemployment FLOAT8,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        """)
        conn.commit()

        # Create indexes
        logger.info("Creating indexes...")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_market_state_date ON market_state (date DESC);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_market_state_vix ON market_state (vix) WHERE vix IS NOT NULL;")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_market_state_cpi ON market_state (cpi) WHERE cpi IS NOT NULL;")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_market_state_fed ON market_state (fed_rate) WHERE fed_rate IS NOT NULL;")
        conn.commit()

        # Create episodes table
        logger.info("Creating episodes table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS episodes (
                id BIGSERIAL PRIMARY KEY,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                regime VARCHAR(50) NOT NULL,
                avg_vix FLOAT8,
                avg_cpi FLOAT8,
                avg_fed_rate FLOAT8,
                avg_yield_spread FLOAT8,
                avg_unemployment FLOAT8,
                total_return FLOAT8,
                max_drawdown FLOAT8,
                spy_return_6m_after FLOAT8,
                prose_summary TEXT,
                episode_created_date TIMESTAMP DEFAULT NOW(),
                last_updated TIMESTAMP DEFAULT NOW(),
                is_closed BOOLEAN DEFAULT FALSE,
                data_completeness_pct FLOAT8 DEFAULT 100.0,
                causal_tags VARCHAR(500),
                dominant_precursor VARCHAR(50),
                created_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT valid_dates CHECK (end_date > start_date)
            );
        """)
        conn.commit()

        # Add new columns to episodes table if they don't exist (for existing databases)
        logger.info("Adding new columns to episodes table (if needed)...")
        try:
            cur.execute("ALTER TABLE episodes ADD COLUMN episode_created_date TIMESTAMP DEFAULT NOW();")
        except Exception as e:
            if "already exists" not in str(e):
                logger.warning(f"Could not add episode_created_date: {e}")

        try:
            cur.execute("ALTER TABLE episodes ADD COLUMN last_updated TIMESTAMP DEFAULT NOW();")
        except Exception as e:
            if "already exists" not in str(e):
                logger.warning(f"Could not add last_updated: {e}")

        try:
            cur.execute("ALTER TABLE episodes ADD COLUMN is_closed BOOLEAN DEFAULT FALSE;")
        except Exception as e:
            if "already exists" not in str(e):
                logger.warning(f"Could not add is_closed: {e}")

        try:
            cur.execute("ALTER TABLE episodes ADD COLUMN data_completeness_pct FLOAT8 DEFAULT 100.0;")
        except Exception as e:
            if "already exists" not in str(e):
                logger.warning(f"Could not add data_completeness_pct: {e}")

        try:
            cur.execute("ALTER TABLE episodes ADD COLUMN causal_tags VARCHAR(500);")
        except Exception as e:
            if "already exists" not in str(e):
                logger.warning(f"Could not add causal_tags: {e}")

        try:
            cur.execute("ALTER TABLE episodes ADD COLUMN dominant_precursor VARCHAR(50);")
        except Exception as e:
            if "already exists" not in str(e):
                logger.warning(f"Could not add dominant_precursor: {e}")

        conn.commit()

        logger.info("Creating episode indexes...")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_episodes_regime ON episodes (regime);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_episodes_dates ON episodes (start_date, end_date);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_episodes_is_closed ON episodes (is_closed);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_episodes_last_updated ON episodes (last_updated);")
        conn.commit()

        # Create episode_changes audit table (Phase 1: Real-Time Detection)
        logger.info("Creating episode_changes audit table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS episode_changes (
                id BIGSERIAL PRIMARY KEY,
                episode_id BIGINT REFERENCES episodes(id) ON DELETE CASCADE,
                event_type VARCHAR(20),
                old_return_6m FLOAT8,
                new_return_6m FLOAT8,
                changed_at TIMESTAMP DEFAULT NOW()
            );
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_episode_changes_episode_id ON episode_changes(episode_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_episode_changes_changed_at ON episode_changes(changed_at);")
        conn.commit()

        # Create regime_shift_precursors table (Phase 2: Causal Analysis)
        logger.info("Creating regime_shift_precursors table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS regime_shift_precursors (
                id BIGSERIAL PRIMARY KEY,
                episode_id BIGINT REFERENCES episodes(id) ON DELETE CASCADE,
                shift_from_regime VARCHAR(50),
                shift_to_regime VARCHAR(50),
                shift_date DATE,
                vix_5d_avg FLOAT8,
                vix_10d_avg FLOAT8,
                vix_20d_avg FLOAT8,
                vix_spike_pct FLOAT8,
                returns_5d FLOAT8,
                returns_10d FLOAT8,
                returns_20d FLOAT8,
                yield_spread_5d FLOAT8,
                yield_inversion_depth FLOAT8,
                cpi_change_pct FLOAT8,
                fed_rate_change_bps INT,
                vix_spike_detected BOOLEAN,
                yield_inversion_detected BOOLEAN,
                fed_tightening BOOLEAN,
                created_at TIMESTAMP DEFAULT NOW()
            );
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_precursors_episode_id ON regime_shift_precursors(episode_id);")
        conn.commit()

        # Create data_quality table
        logger.info("Creating data_quality table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS data_quality (
                id BIGSERIAL PRIMARY KEY,
                check_date DATE NOT NULL,
                metric_name VARCHAR(100) NOT NULL,
                data_points_count INT,
                missing_values INT,
                quality_score FLOAT8,
                notes TEXT,
                checked_at TIMESTAMP DEFAULT NOW()
            );
        """)
        conn.commit()

        # Create data_sources table
        logger.info("Creating data_sources table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS data_sources (
                id BIGSERIAL PRIMARY KEY,
                source_name VARCHAR(100) NOT NULL,
                metric_name VARCHAR(100) NOT NULL,
                series_id VARCHAR(100),
                last_synced TIMESTAMP,
                records_count INT,
                status VARCHAR(50),
                notes TEXT,
                UNIQUE (source_name, metric_name)
            );
        """)
        conn.commit()

        # Create views
        logger.info("Creating views...")
        cur.execute("""
            CREATE OR REPLACE VIEW latest_market_state AS
            SELECT date, spy_price, spy_return_1d, vix, cpi, fed_rate, yield_spread, unemployment
            FROM market_state ORDER BY date DESC LIMIT 1;
        """)
        cur.execute("""
            CREATE OR REPLACE VIEW market_snapshot_30d AS
            SELECT date, spy_price, vix, cpi, fed_rate, yield_spread, unemployment,
                   ROW_NUMBER() OVER (ORDER BY date DESC) as days_ago
            FROM market_state WHERE date >= CURRENT_DATE - INTERVAL '30 days' ORDER BY date DESC;
        """)
        cur.execute("""
            CREATE OR REPLACE VIEW regime_transitions AS
            SELECT start_date, end_date, regime, (end_date - start_date) as duration_days,
                   total_return, spy_return_6m_after FROM episodes ORDER BY start_date DESC;
        """)
        conn.commit()

        logger.info("Database initialization completed successfully")

    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    init_database()
