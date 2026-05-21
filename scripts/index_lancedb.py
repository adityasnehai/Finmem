#!/usr/bin/env python3
"""Create LanceDB vector index for fast similarity search"""

import os
import logging
import psycopg
import lancedb
import pandas as pd

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def index_episodes_lancedb(db_url: str, lancedb_path: str = "./finmem_lancedb"):
    """Create LanceDB index for episode embeddings"""
    logger.info("Starting LanceDB indexing...")

    # Create LanceDB connection
    db = lancedb.connect(lancedb_path)
    logger.info(f"Connected to LanceDB at {lancedb_path}")

    # Fetch embeddings from PostgreSQL
    logger.info("Fetching episode embeddings from PostgreSQL...")
    conn = psycopg.connect(db_url)
    try:
        cur = conn.cursor()

        cur.execute("""
            SELECT e.id, e.start_date, e.end_date, e.regime,
                   e.total_return, e.max_drawdown, e.spy_return_6m_after,
                   ee.embedding, ee.prose_summary
            FROM episodes e
            JOIN episode_embeddings ee ON e.id = ee.episode_id
            ORDER BY e.start_date
        """)

        rows = cur.fetchall()
        if not rows:
            logger.error("No episodes with embeddings found")
            return

        logger.info(f"Fetched {len(rows)} episodes")

        # Prepare data for LanceDB
        data = []
        for row in rows:
            data.append({
                'episode_id': row[0],
                'start_date': str(row[1]),
                'end_date': str(row[2]),
                'regime': row[3],
                'total_return': row[4],
                'max_drawdown': row[5],
                'spy_return_6m_after': row[6],
                'vector': row[7],  # Vector (renamed from embedding for LanceDB compatibility)
                'prose_summary': row[8]
            })

        # Create DataFrame
        df = pd.DataFrame(data)

        # Create LanceDB table
        logger.info("Creating LanceDB table...")
        table = db.create_table("episodes", data=df, mode="overwrite")
        logger.info(f"Created LanceDB table with {len(data)} episodes")

        # Create index on vector column (skip if not enough data for PQ)
        logger.info("Creating vector index...")
        try:
            table.create_index(metric="cosine")
            logger.info("Vector index created successfully")
        except Exception as e:
            if "Not enough rows" in str(e):
                logger.info("Skipping vector index (requires 256+ rows, dataset has 61)")
            else:
                raise

        # Test search
        logger.info("Testing similarity search...")
        test_query = data[0]['vector']  # Use first episode as test
        results = table.search(test_query).limit(5).to_list()
        logger.info(f"Test search found {len(results)} similar episodes")

        logger.info("LanceDB indexing completed successfully")

    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    db_url = os.getenv('DATABASE_URL', 'postgresql://localhost/finmem')
    index_episodes_lancedb(db_url)
