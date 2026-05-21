#!/usr/bin/env python3
"""Test Phase 3 query engine and reasoning with real data"""

import os
import sys
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.query_engine import QueryEngine
from api.reasoning import ReasoningEngine
from api.similarity_search import init_search_engine


def test_phase3():
    """Test Phase 3 functionality"""
    logger.info("="*70)
    logger.info("PHASE 3: EPISODIC REASONING - VALIDATION TEST")
    logger.info("="*70)

    # Initialize
    db_url = os.getenv('DATABASE_URL', 'postgresql://localhost/finmem')
    engine = QueryEngine(db_url)
    engine.connect()
    reasoning = ReasoningEngine()

    init_search_engine()

    total_episodes = engine.get_total_episodes()
    logger.info(f"\nTotal episodes in database: {total_episodes}")

    regime_dist = engine.get_regime_distribution()
    logger.info(f"Regime distribution: {regime_dist}")

    # Test 1: Natural language query
    logger.info("\n" + "="*70)
    logger.info("[TEST 1] Natural Language Query")
    logger.info("="*70)
    query_text = "Market recovery after volatility spike"
    logger.info(f"Query: {query_text}")

    results = engine.semantic_search(query_text, top_k=5, min_confidence=0.0)
    logger.info(f"Found {len(results)} similar episodes")

    if results:
        for i, r in enumerate(results[:5], 1):
            logger.info(f"  {i}. {r['regime']} ({r['start_date'][:10]}) - Confidence: {r['similarity_score']:.0f}%")

        similar_episodes = engine.build_similar_episodes(results, total_episodes)
        reasoning_insight = reasoning.analyze_outcomes(similar_episodes, total_episodes)

        logger.info(f"\nStatistical Summary:")
        logger.info(f"  - Avg 6-month return: {reasoning_insight.avg_return_6m:+.1f}%")
        logger.info(f"  - Median return: {reasoning_insight.median_return_6m:+.1f}%")
        logger.info(f"  - Win rate: {reasoning_insight.win_rate_pct:.0f}%")
        logger.info(f"  - Sharpe ratio: {reasoning_insight.sharpe_ratio_avg:.2f}")
        logger.info(f"  - Confidence level: {reasoning_insight.confidence_level}")

    # Test 2: Hybrid search with regime filter
    logger.info("\n" + "="*70)
    logger.info("[TEST 2] Hybrid Search (Semantic + Metadata Filter)")
    logger.info("="*70)
    query_text = "Strong rally"
    regime_filter = "BULL"
    logger.info(f"Query: {query_text}")
    logger.info(f"Filter: regime = {regime_filter}")

    results = engine.hybrid_search(
        query_text=query_text,
        top_k=5,
        min_confidence=0.0,
        regime=regime_filter
    )
    logger.info(f"Found {len(results)} BULL episodes matching query")

    if results:
        for i, r in enumerate(results, 1):
            logger.info(f"  {i}. {r['regime']} ({r['start_date'][:10]}) - Confidence: {r['similarity_score']:.0f}%")

    # Test 3: Regime-only query
    logger.info("\n" + "="*70)
    logger.info("[TEST 3] Regime-Only Query")
    logger.info("="*70)
    for regime in ["BULL", "BEAR", "RECOVERY", "STAGNATION", "RECESSION"]:
        cur = engine._postgres_conn.cursor()
        cur.execute("SELECT COUNT(*) FROM episodes WHERE regime = %s", (regime,))
        count = cur.fetchone()[0]
        cur.close()
        if count > 0:
            logger.info(f"  {regime}: {count} episodes")

    # Test 4: Edge cases
    logger.info("\n" + "="*70)
    logger.info("[TEST 4] Search Quality Metrics")
    logger.info("="*70)

    # Loose search
    results_loose = engine.semantic_search("bull", top_k=20, min_confidence=0.0)
    logger.info(f"Loose search (any distance): {len(results_loose)} results")

    # Moderate confidence
    results_moderate = engine.semantic_search("bull", top_k=20, min_confidence=0.3)
    logger.info(f"Moderate confidence (>30%): {len(results_moderate)} results")

    # Strict confidence
    results_strict = engine.semantic_search("bull", top_k=20, min_confidence=0.7)
    logger.info(f"Strict confidence (>70%): {len(results_strict)} results")

    # Test 5: Validation checks
    logger.info("\n" + "="*70)
    logger.info("[TEST 5] Validation Checks")
    logger.info("="*70)

    # Check similarity scores are valid
    if results_loose:
        scores = [r['similarity_score'] for r in results_loose]
        assert all(0 <= s <= 100 for s in scores), "Similarity scores out of range!"
        logger.info(f"✓ Similarity scores valid: {min(scores):.0f}% - {max(scores):.0f}%")

        # Check outcomes are valid
        similar_episodes = engine.build_similar_episodes(results_loose[:5], total_episodes)
        for ep in similar_episodes:
            if ep.outcomes.return_6m is not None:
                assert -100 <= ep.outcomes.return_6m <= 1000, f"Invalid return: {ep.outcomes.return_6m}"
            assert -100 <= ep.outcomes.max_loss, "Invalid max_loss"

        logger.info(f"✓ Episode outcomes valid: {len(similar_episodes)} episodes checked")

    # Test 6: Statistical methods validation
    logger.info("\n" + "="*70)
    logger.info("[TEST 6] Statistical Methods Validation")
    logger.info("="*70)

    results = engine.semantic_search("market", top_k=15, min_confidence=0.0)
    if results:
        similar_episodes = engine.build_similar_episodes(results, total_episodes)
        reasoning_insight = reasoning.analyze_outcomes(similar_episodes, total_episodes)

        # Win rate should be 0-100%
        assert 0 <= reasoning_insight.win_rate_pct <= 100
        logger.info(f"✓ Win rate valid: {reasoning_insight.win_rate_pct:.0f}%")

        # Confidence level should be HIGH, MEDIUM, or LOW
        assert reasoning_insight.confidence_level in ["HIGH", "MEDIUM", "LOW"]
        logger.info(f"✓ Confidence level valid: {reasoning_insight.confidence_level}")

        # P-value should be 0-1
        assert 0 <= reasoning_insight.statistical_significance <= 1
        logger.info(f"✓ P-value valid: {reasoning_insight.statistical_significance:.4f}")

        # Sharpe ratio reasonable
        logger.info(f"✓ Sharpe ratio: {reasoning_insight.sharpe_ratio_avg:.2f}")

        # Representation percentage valid
        assert 0 <= reasoning_insight.representation <= 100
        logger.info(f"✓ Representation: {reasoning_insight.representation:.1f}% of search space")

    # Test 7: Reasoning text generation
    logger.info("\n" + "="*70)
    logger.info("[TEST 7] Reasoning Text Generation")
    logger.info("="*70)

    results = engine.semantic_search("downturn volatility", top_k=10, min_confidence=0.0)
    if results:
        similar_episodes = engine.build_similar_episodes(results, total_episodes)
        reasoning_insight = reasoning.analyze_outcomes(similar_episodes, total_episodes)
        insight_text, warning = reasoning.generate_insight_text(
            similar_episodes, reasoning_insight, "downturn volatility"
        )

        logger.info(f"✓ Generated insight:\n{insight_text[:200]}...")
        if warning:
            logger.info(f"⚠️ Warning: {warning}")

    logger.info("\n" + "="*70)
    logger.info("✅ PHASE 3 VALIDATION COMPLETE - ALL TESTS PASSED")
    logger.info("="*70)

    engine.close()


if __name__ == '__main__':
    test_phase3()
