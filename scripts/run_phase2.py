#!/usr/bin/env python3
"""Run complete Phase 2 pipeline: detect episodes, create embeddings, index in LanceDB"""

import os
import sys
import logging
from detect_episodes import detect_episodes
from create_embeddings import create_embeddings
from index_lancedb import index_episodes_lancedb

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def run_phase2():
    """Execute full Phase 2 pipeline"""
    db_url = os.getenv('DATABASE_URL', 'postgresql://localhost/finmem')

    logger.info("=" * 70)
    logger.info("PHASE 2: EPISODE DETECTION & EPISODIC MEMORY")
    logger.info("=" * 70)

    # Step 1: Detect episodes
    logger.info("\n[STEP 1/3] Detecting market episodes...")
    try:
        detect_episodes(db_url)
        logger.info("✅ Episode detection completed\n")
    except Exception as e:
        logger.error(f"❌ Episode detection failed: {e}")
        return False

    # Step 2: Create embeddings
    logger.info("[STEP 2/3] Creating vector embeddings...")
    try:
        create_embeddings(db_url)
        logger.info("✅ Embedding generation completed\n")
    except Exception as e:
        logger.error(f"❌ Embedding creation failed: {e}")
        return False

    # Step 3: Index in LanceDB
    logger.info("[STEP 3/3] Indexing episodes in LanceDB...")
    try:
        index_episodes_lancedb(db_url)
        logger.info("✅ LanceDB indexing completed\n")
    except Exception as e:
        logger.error(f"❌ LanceDB indexing failed: {e}")
        return False

    logger.info("=" * 70)
    logger.info("PHASE 2 COMPLETE: Ready for episodic reasoning queries")
    logger.info("=" * 70)
    return True


if __name__ == '__main__':
    success = run_phase2()
    sys.exit(0 if success else 1)
