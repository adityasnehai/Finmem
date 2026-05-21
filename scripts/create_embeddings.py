#!/usr/bin/env python3
"""Create vector embeddings for episodes using FinBERT"""

import os
import logging
import psycopg
from transformers import AutoTokenizer, AutoModel
import torch
import numpy as np

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def create_embeddings(db_url: str):
    """Generate embeddings for all episodes using FinBERT (768-dim, finance-trained)"""
    logger.info("Starting embedding generation...")

    # Load FinBERT model
    logger.info("Loading FinBERT model (768-dim, 10M financial documents)...")
    model_name = "ProsusAI/finbert"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModel.from_pretrained(model_name)
    model.eval()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    logger.info(f"FinBERT loaded on {device}")

    conn = psycopg.connect(db_url)
    try:
        cur = conn.cursor()

        # Fetch all episodes
        logger.info("Fetching episodes...")
        cur.execute("""
            SELECT id, start_date, end_date, regime, avg_vix, avg_cpi,
                   avg_fed_rate, avg_yield_spread, avg_unemployment,
                   total_return, max_drawdown, spy_return_6m_after
            FROM episodes
            ORDER BY start_date
        """)

        episodes = cur.fetchall()
        if not episodes:
            logger.warning("No episodes found")
            return

        logger.info(f"Generating embeddings for {len(episodes)} episodes...")

        # Create embeddings table if not exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS episode_embeddings (
                episode_id BIGINT PRIMARY KEY REFERENCES episodes(id) ON DELETE CASCADE,
                embedding FLOAT8[] NOT NULL,
                prose_summary TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        """)
        conn.commit()

        # Clear old embeddings
        cur.execute("DELETE FROM episode_embeddings;")
        conn.commit()

        # Generate embeddings
        processed = 0
        for episode in episodes:
            ep_id = episode[0]
            start_date, end_date, regime = episode[1], episode[2], episode[3]
            avg_vix, avg_cpi, avg_fed = episode[4], episode[5], episode[6]
            avg_yield, avg_unemployment = episode[7], episode[8]
            total_return, max_drawdown, spy_return_6m = episode[9], episode[10], episode[11]

            # Create prose summary
            prose = generate_prose(
                regime, start_date, end_date,
                avg_vix, avg_cpi, avg_fed, avg_yield, avg_unemployment,
                total_return, max_drawdown, spy_return_6m
            )

            # Generate embedding via FinBERT
            embedding = generate_embedding(prose, tokenizer, model, device)
            embedding_list = embedding.tolist()

            # Insert embedding
            cur.execute("""
                INSERT INTO episode_embeddings (episode_id, embedding, prose_summary)
                VALUES (%s, %s, %s)
            """, (ep_id, embedding_list, prose))

            processed += 1
            if processed % 10 == 0:
                conn.commit()
                logger.info(f"Processed {processed}/{len(episodes)} episodes")

        conn.commit()
        logger.info(f"Successfully created embeddings for {processed} episodes")

    finally:
        cur.close()
        conn.close()


def generate_prose(regime: str, start_date, end_date, avg_vix: float, avg_cpi: float,
                  avg_fed: float, avg_yield: float, avg_unemployment: float,
                  total_return: float, max_drawdown: float, spy_return_6m: float) -> str:
    """Generate natural language description of episode"""

    duration_days = (end_date - start_date).days

    # Build description
    parts = []
    parts.append(f"Market regime: {regime}")
    parts.append(f"Period: {duration_days} days ({start_date} to {end_date})")

    if avg_vix:
        parts.append(f"Average VIX (volatility): {avg_vix:.1f}")
    if avg_cpi:
        parts.append(f"Average inflation (CPI): {avg_cpi:.2f}%")
    if avg_fed:
        parts.append(f"Average federal funds rate: {avg_fed:.2f}%")
    if avg_yield:
        if avg_yield < 0:
            parts.append(f"Yield curve inverted: {avg_yield:.2f}% (10Y-2Y)")
        else:
            parts.append(f"Normal yield curve: {avg_yield:.2f}% (10Y-2Y)")
    if avg_unemployment:
        parts.append(f"Average unemployment: {avg_unemployment:.2f}%")

    parts.append(f"Total return: {total_return:+.1f}%")
    parts.append(f"Maximum drawdown: {max_drawdown:.1f}%")

    if spy_return_6m:
        parts.append(f"Following 6 months return: {spy_return_6m:+.1f}%")

    return ". ".join(parts)


def generate_embedding(text: str, tokenizer, model, device) -> np.ndarray:
    """Generate 768-dim embedding using FinBERT"""
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.no_grad():
        outputs = model(**inputs)
        # Use [CLS] token embedding
        embedding = outputs.last_hidden_state[:, 0, :].cpu().numpy()[0]

    return embedding.astype(np.float32)


if __name__ == '__main__':
    db_url = os.getenv('DATABASE_URL', 'postgresql://localhost/finmem')
    create_embeddings(db_url)
