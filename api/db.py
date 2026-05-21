"""
Database connection pooling and utility functions for PostgreSQL + TimescaleDB
"""

import os
from contextlib import contextmanager
from typing import Generator

import psycopg
from psycopg import sql
from psycopg_pool import ConnectionPool

# Initialize connection pool
pool: ConnectionPool = None


def init_pool():
    """Initialize the connection pool."""
    global pool
    db_url = os.getenv('DATABASE_URL', 'postgresql://localhost/finmem')
    pool = ConnectionPool(db_url, min_size=5, max_size=20)
    print(f"Connection pool initialized with URL: {db_url}")


def close_pool():
    """Close the connection pool."""
    global pool
    if pool:
        pool.close()


@contextmanager
def get_connection() -> Generator[psycopg.Connection, None, None]:
    """Get a connection from the pool."""
    global pool
    if not pool:
        init_pool()
    conn = pool.getconn()
    try:
        yield conn
    finally:
        pool.putconn(conn)


@contextmanager
def get_cursor(conn: psycopg.Connection):
    """Get a cursor from a connection."""
    cur = conn.cursor()
    try:
        yield cur
    finally:
        cur.close()


def get_latest_market_state() -> dict:
    """Fetch the latest market state from the database."""
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                SELECT
                    date, spy_price, spy_return_1d, spy_return_5d,
                    spy_return_21d, vix, rolling_vol_21d, cpi,
                    fed_rate, yield_spread, unemployment
                FROM market_state
                ORDER BY date DESC
                LIMIT 1
            """)
            row = cur.fetchone()

            if not row:
                return None

            return {
                'date': row[0].isoformat() if row[0] else None,
                'spy_price': row[1],
                'spy_return_1d': row[2],
                'spy_return_5d': row[3],
                'spy_return_21d': row[4],
                'vix': row[5],
                'rolling_vol_21d': row[6],
                'cpi': row[7],
                'fed_rate': row[8],
                'yield_spread': row[9],
                'unemployment': row[10],
            }


def get_market_history(days: int = 30) -> list:
    """Fetch market state for the last N days."""
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                SELECT
                    date, spy_price, spy_return_1d, vix, cpi, fed_rate,
                    yield_spread, unemployment
                FROM market_state
                WHERE date >= CURRENT_DATE - INTERVAL %s
                ORDER BY date DESC
            """, (f'{days} days',))

            results = cur.fetchall()
            return [
                {
                    'date': row[0].isoformat() if row[0] else None,
                    'spy_price': row[1],
                    'spy_return_1d': row[2],
                    'vix': row[3],
                    'cpi': row[4],
                    'fed_rate': row[5],
                    'yield_spread': row[6],
                    'unemployment': row[7],
                }
                for row in results
            ]


def get_data_quality_metrics() -> list:
    """Fetch recent data quality metrics."""
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                SELECT metric_name, data_points_count, missing_values,
                       quality_score, check_date
                FROM data_quality
                ORDER BY check_date DESC
                LIMIT 10
            """)

            results = cur.fetchall()
            return [
                {
                    'metric_name': row[0],
                    'data_points_count': row[1],
                    'missing_values': row[2],
                    'quality_score': row[3],
                    'check_date': row[4].isoformat() if row[4] else None,
                }
                for row in results
            ]


def get_data_sources() -> list:
    """Fetch data source metadata."""
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                SELECT source_name, metric_name, series_id, last_synced,
                       records_count, status
                FROM data_sources
                ORDER BY last_synced DESC
            """)

            results = cur.fetchall()
            return [
                {
                    'source_name': row[0],
                    'metric_name': row[1],
                    'series_id': row[2],
                    'last_synced': row[3].isoformat() if row[3] else None,
                    'records_count': row[4],
                    'status': row[5],
                }
                for row in results
            ]
