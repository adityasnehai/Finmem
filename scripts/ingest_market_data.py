#!/usr/bin/env python3
"""
Data Ingestion Script for FinMem Phase 1: Market Data Collection
Fetches historical market data from yfinance and FRED API
Populates PostgreSQL + TimescaleDB with normalized market state
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional
import json

import psycopg
import yfinance as yf
import pandas as pd
import numpy as np
from fredapi import Fred

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MarketDataIngester:
    def __init__(self, db_url: str, fred_api_key: str):
        """Initialize data ingester with database connection and FRED API key."""
        self.db_url = db_url
        self.fred = Fred(api_key=fred_api_key)
        self.conn = None

    def connect(self):
        """Establish database connection."""
        try:
            self.conn = psycopg.connect(self.db_url)
            logger.info("Connected to PostgreSQL database")
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            raise

    def close(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()
            logger.info("Database connection closed")

    def fetch_spy_data(self, start_date: str = "1993-01-01") -> pd.DataFrame:
        """Fetch SPY price and returns from yfinance."""
        logger.info(f"Fetching SPY data (last 30+ years)...")
        try:
            spy = yf.Ticker("SPY").history(period="30y")
            if spy.empty:
                raise ValueError("No SPY data retrieved")

            # Get adjusted close
            close_prices = spy['Adj Close'] if 'Adj Close' in spy.columns else spy['Close']

            spy_data = pd.DataFrame({
                'date': pd.to_datetime(close_prices.index.date),
                'spy_price': close_prices.values,
            })

            # Remove timezone info
            spy_data['date'] = spy_data['date'].dt.date

            spy_data['spy_return_1d'] = spy_data['spy_price'].pct_change() * 100
            spy_data['spy_return_5d'] = spy_data['spy_price'].pct_change(5) * 100
            spy_data['spy_return_21d'] = spy_data['spy_price'].pct_change(21) * 100
            spy_data['rolling_vol_21d'] = spy_data['spy_return_1d'].rolling(21).std()

            logger.info(f"Fetched {len(spy_data)} SPY records")
            return spy_data
        except Exception as e:
            logger.error(f"SPY fetch failed: {e}")
            raise

    def fetch_vix_data(self, start_date: str = "1993-01-01") -> pd.DataFrame:
        """Fetch VIX data from yfinance."""
        logger.info(f"Fetching VIX data (last 30+ years)...")
        try:
            vix = yf.Ticker("^VIX").history(period="30y")
            if vix.empty:
                raise ValueError("No VIX data retrieved")

            close_prices = vix['Close']

            vix_data = pd.DataFrame({
                'date': pd.to_datetime(vix.index.date),
                'vix': close_prices.values,
            })

            # Remove timezone info
            vix_data['date'] = vix_data['date'].dt.date

            logger.info(f"Fetched {len(vix_data)} VIX records")
            return vix_data
        except Exception as e:
            logger.error(f"VIX fetch failed: {e}")
            raise

    def fetch_fred_series(self, series_id: str, start_date: str = "1993-01-01") -> pd.DataFrame:
        """Fetch a single FRED series."""
        logger.info(f"Fetching FRED series {series_id}...")
        try:
            data = self.fred.get_series(series_id, start_date=start_date)
            df = pd.DataFrame({
                'date': data.index.date,
                series_id.lower(): data.values,
            })
            logger.info(f"Fetched {len(df)} {series_id} records")
            return df
        except Exception as e:
            logger.error(f"Failed to fetch {series_id}: {e}")
            return pd.DataFrame()

    def fetch_all_macro_data(self) -> pd.DataFrame:
        """Fetch all macro indicators from FRED."""
        logger.info("Fetching macro indicators from FRED...")

        fred_series = {
            'CPIAUCSL': 'cpi',          # CPI for all urban consumers
            'FEDFUNDS': 'fed_rate',     # Federal funds rate
            'T10Y2Y': 'yield_spread',   # 10Y - 2Y Treasury spread
            'UNRATE': 'unemployment',   # Unemployment rate
        }

        macro_data = None
        for series_id, col_name in fred_series.items():
            df = self.fred.get_series(series_id, start_date="1993-01-01")
            df_monthly = pd.DataFrame({
                'date': df.index.date,
                col_name: df.values,
            })

            if macro_data is None:
                macro_data = df_monthly
            else:
                macro_data = pd.merge(
                    macro_data, df_monthly, on='date', how='outer'
                )

        logger.info(f"Fetched macro data: {len(macro_data)} records")
        return macro_data

    def merge_all_data(self, spy: pd.DataFrame, vix: pd.DataFrame,
                      macro: pd.DataFrame) -> pd.DataFrame:
        """Merge all data sources into single daily records."""
        logger.info("Merging all market data sources...")

        market_state = pd.merge(spy, vix, on='date', how='outer')
        market_state = pd.merge(market_state, macro, on='date', how='outer')

        market_state = market_state.sort_values('date').reset_index(drop=True)
        market_state['date'] = pd.to_datetime(market_state['date'])

        logger.info(f"Merged dataset: {len(market_state)} total records")
        return market_state

    def insert_market_state(self, market_state: pd.DataFrame,
                           batch_size: int = 1000):
        """Insert market state data into PostgreSQL."""
        logger.info(f"Inserting {len(market_state)} market state records...")

        if not self.conn:
            raise RuntimeError("Database connection not established")

        cur = self.conn.cursor()

        # Remove existing data to avoid duplicates
        cur.execute("DELETE FROM market_state WHERE date >= %s AND date <= %s",
                   (market_state['date'].min(), market_state['date'].max()))

        inserted = 0
        for idx, row in market_state.iterrows():
            try:
                cur.execute("""
                    INSERT INTO market_state (
                        date, spy_price, spy_return_1d, spy_return_5d, spy_return_21d,
                        vix, rolling_vol_21d, cpi, fed_rate, yield_spread, unemployment,
                        created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                """, (
                    row['date'],
                    float(row['spy_price']) if pd.notna(row['spy_price']) else None,
                    float(row['spy_return_1d']) if pd.notna(row['spy_return_1d']) else None,
                    float(row['spy_return_5d']) if pd.notna(row['spy_return_5d']) else None,
                    float(row['spy_return_21d']) if pd.notna(row['spy_return_21d']) else None,
                    float(row['vix']) if pd.notna(row['vix']) else None,
                    float(row['rolling_vol_21d']) if pd.notna(row['rolling_vol_21d']) else None,
                    float(row['cpi']) if pd.notna(row['cpi']) else None,
                    float(row['fed_rate']) if pd.notna(row['fed_rate']) else None,
                    float(row['yield_spread']) if pd.notna(row['yield_spread']) else None,
                    float(row['unemployment']) if pd.notna(row['unemployment']) else None,
                ))
                inserted += 1

                if inserted % batch_size == 0:
                    self.conn.commit()
                    logger.info(f"Inserted {inserted} records...")
            except Exception as e:
                logger.error(f"Error inserting row {idx}: {e}")
                self.conn.rollback()
                continue

        self.conn.commit()
        logger.info(f"Successfully inserted {inserted} market state records")

    def record_data_quality(self):
        """Record data quality metrics after ingestion."""
        logger.info("Recording data quality metrics...")

        if not self.conn:
            raise RuntimeError("Database connection not established")

        cur = self.conn.cursor()

        # Count records by metric
        cur.execute("SELECT COUNT(*) FROM market_state")
        total = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM market_state WHERE spy_price IS NOT NULL")
        spy_count = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM market_state WHERE vix IS NOT NULL")
        vix_count = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM market_state WHERE cpi IS NOT NULL")
        cpi_count = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM market_state WHERE fed_rate IS NOT NULL")
        fed_count = cur.fetchone()[0]

        metrics = {
            'spy_price': {'count': spy_count, 'missing': total - spy_count},
            'vix': {'count': vix_count, 'missing': total - vix_count},
            'cpi': {'count': cpi_count, 'missing': total - cpi_count},
            'fed_rate': {'count': fed_count, 'missing': total - fed_count},
        }

        for metric_name, counts in metrics.items():
            quality_score = (counts['count'] / total * 100) if total > 0 else 0

            cur.execute("""
                INSERT INTO data_quality (check_date, metric_name, data_points_count,
                                         missing_values, quality_score, notes)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                datetime.now().date(),
                metric_name,
                counts['count'],
                counts['missing'],
                quality_score,
                f"Data freshness check on {datetime.now().isoformat()}"
            ))

        self.conn.commit()
        logger.info("Data quality metrics recorded")

    def record_data_source(self, source_name: str, metric_name: str,
                          records_count: int, series_id: Optional[str] = None):
        """Record data source metadata."""
        if not self.conn:
            raise RuntimeError("Database connection not established")

        cur = self.conn.cursor()
        cur.execute("""
            INSERT INTO data_sources (source_name, metric_name, series_id,
                                     last_synced, records_count, status)
            VALUES (%s, %s, %s, NOW(), %s, %s)
            ON CONFLICT (source_name, metric_name) DO UPDATE SET
                last_synced = NOW(),
                records_count = %s,
                status = 'active'
        """, (
            source_name, metric_name, series_id, records_count, 'active', records_count
        ))
        self.conn.commit()

    def run(self):
        """Execute full data ingestion pipeline."""
        try:
            self.connect()

            # Fetch all data
            spy_data = self.fetch_spy_data()
            vix_data = self.fetch_vix_data()
            macro_data = self.fetch_all_macro_data()

            # Merge and insert
            market_state = self.merge_all_data(spy_data, vix_data, macro_data)
            self.insert_market_state(market_state)

            # Record metadata
            self.record_data_quality()
            self.record_data_source('yfinance', 'SPY', len(spy_data))
            self.record_data_source('yfinance', 'VIX', len(vix_data))
            self.record_data_source('FRED', 'CPI', len(macro_data), 'CPIAUCSL')
            self.record_data_source('FRED', 'FED_RATE', len(macro_data), 'FEDFUNDS')
            self.record_data_source('FRED', 'YIELD_SPREAD', len(macro_data), 'T10Y2Y')
            self.record_data_source('FRED', 'UNEMPLOYMENT', len(macro_data), 'UNRATE')

            logger.info("Data ingestion completed successfully")

        except Exception as e:
            logger.error(f"Data ingestion failed: {e}")
            raise
        finally:
            self.close()


def main():
    """Entry point for data ingestion script."""
    # Configuration from environment variables
    db_url = os.getenv('DATABASE_URL',
                      'postgresql://localhost/finmem')
    fred_api_key = os.getenv('FRED_API_KEY', '')

    if not fred_api_key:
        raise ValueError("FRED_API_KEY environment variable not set")

    ingester = MarketDataIngester(db_url, fred_api_key)
    ingester.run()


if __name__ == '__main__':
    main()
