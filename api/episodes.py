#!/usr/bin/env python3
"""Episode CRUD operations and queries"""

import psycopg
from typing import List, Dict, Optional
from datetime import date
import logging

logger = logging.getLogger(__name__)


def get_all_episodes(db_url: str) -> List[Dict]:
    """Fetch all episodes"""
    try:
        with psycopg.connect(db_url) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, start_date, end_date, regime, avg_vix, avg_cpi,
                           avg_fed_rate, avg_yield_spread, avg_unemployment,
                           total_return, max_drawdown, spy_return_6m_after
                    FROM episodes
                    ORDER BY start_date DESC
                """)
                results = cur.fetchall()
                return [
                    {
                        'id': r[0],
                        'start_date': str(r[1]),
                        'end_date': str(r[2]),
                        'regime': r[3],
                        'avg_vix': r[4],
                        'avg_cpi': r[5],
                        'avg_fed_rate': r[6],
                        'avg_yield_spread': r[7],
                        'avg_unemployment': r[8],
                        'total_return': r[9],
                        'max_drawdown': r[10],
                        'spy_return_6m_after': r[11]
                    }
                    for r in results
                ]
    except Exception as e:
        logger.error(f"Failed to fetch episodes: {e}")
        return []


def get_episodes_by_regime(db_url: str, regime: str) -> List[Dict]:
    """Fetch episodes by regime type"""
    try:
        with psycopg.connect(db_url) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, start_date, end_date, regime, total_return,
                           max_drawdown, spy_return_6m_after
                    FROM episodes
                    WHERE regime = %s
                    ORDER BY start_date DESC
                """, (regime,))
                results = cur.fetchall()
                return [
                    {
                        'id': r[0],
                        'start_date': str(r[1]),
                        'end_date': str(r[2]),
                        'regime': r[3],
                        'total_return': r[4],
                        'max_drawdown': r[5],
                        'spy_return_6m_after': r[6]
                    }
                    for r in results
                ]
    except Exception as e:
        logger.error(f"Failed to fetch episodes by regime: {e}")
        return []


def get_episode_statistics(db_url: str) -> Dict:
    """Get aggregate statistics about all episodes"""
    try:
        with psycopg.connect(db_url) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT
                        COUNT(*) as total_episodes,
                        COUNT(DISTINCT regime) as num_regimes,
                        AVG(total_return) as avg_return,
                        AVG(max_drawdown) as avg_drawdown,
                        AVG(spy_return_6m_after) as avg_forward_return,
                        MIN(start_date) as earliest_episode,
                        MAX(end_date) as latest_episode
                    FROM episodes
                """)
                row = cur.fetchone()
                return {
                    'total_episodes': row[0],
                    'num_regimes': row[1],
                    'avg_return': row[2],
                    'avg_drawdown': row[3],
                    'avg_forward_return': row[4],
                    'earliest_episode': str(row[5]),
                    'latest_episode': str(row[6])
                }
    except Exception as e:
        logger.error(f"Failed to fetch episode statistics: {e}")
        return {}


def get_regime_distribution(db_url: str) -> Dict[str, int]:
    """Get count of episodes by regime"""
    try:
        with psycopg.connect(db_url) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT regime, COUNT(*) as count
                    FROM episodes
                    GROUP BY regime
                    ORDER BY count DESC
                """)
                results = cur.fetchall()
                return {r[0]: r[1] for r in results}
    except Exception as e:
        logger.error(f"Failed to fetch regime distribution: {e}")
        return {}


def get_episode_by_date(db_url: str, query_date: date) -> Optional[Dict]:
    """Get episode containing a specific date"""
    try:
        with psycopg.connect(db_url) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, start_date, end_date, regime, total_return,
                           max_drawdown, spy_return_6m_after
                    FROM episodes
                    WHERE start_date <= %s AND end_date >= %s
                    LIMIT 1
                """, (query_date, query_date))
                row = cur.fetchone()
                if not row:
                    return None
                return {
                    'id': row[0],
                    'start_date': str(row[1]),
                    'end_date': str(row[2]),
                    'regime': row[3],
                    'total_return': row[4],
                    'max_drawdown': row[5],
                    'spy_return_6m_after': row[6]
                }
    except Exception as e:
        logger.error(f"Failed to fetch episode by date: {e}")
        return None
