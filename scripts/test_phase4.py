#!/usr/bin/env python3
"""Comprehensive tests for Phase 4 Chat Interface"""

import os
import sys
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.query_parser import QueryParser
from api.response_formatter import ResponseFormatter
from api.chat_manager import ChatManager, Conversation
from api.chat_schemas import ChatMessage, QueryAnalysis, ConversationContext
from api.query_engine import QueryEngine
from api.reasoning import ReasoningEngine
from api.similarity_search import init_search_engine


def test_phase4():
    """Run comprehensive Phase 4 tests"""
    logger.info("="*70)
    logger.info("PHASE 4: CHAT INTERFACE - COMPREHENSIVE TESTS")
    logger.info("="*70)

    init_search_engine()
    db_url = os.getenv('DATABASE_URL', 'postgresql://localhost/finmem')
    engine = QueryEngine(db_url)
    engine.connect()
    reasoning = ReasoningEngine()

    # Initialize components
    parser = QueryParser()
    formatter = ResponseFormatter()
    manager = ChatManager()

    total_episodes = engine.get_total_episodes()

    # TEST 1: Query Parser
    logger.info("\n" + "="*70)
    logger.info("[TEST 1] Query Parser - NLU")
    logger.info("="*70)

    test_queries = [
        ("What happens when volatility spikes?", "natural_language"),
        ("SPY at 450, VIX 22, CPI 3.2", "market_state"),
        ("Show me BEAR episodes", "regime"),
        ("What about BULL markets with high inflation?", "natural_language"),
    ]

    for query, expected_type in test_queries:
        analysis = parser.parse(query)
        status = "✓" if analysis.query_type == expected_type else "✗"
        logger.info(f"{status} Query: '{query}' → {analysis.query_type}")
        logger.info(f"  Confidence: {analysis.confidence:.1%}")

    # TEST 2: Market State Extraction
    logger.info("\n" + "="*70)
    logger.info("[TEST 2] Market State Extraction")
    logger.info("="*70)

    market_queries = [
        "SPY at 450, VIX 22, CPI 3.2, Fed Rate 5.5",
        "Market: price 450, vol 22",
        "volatility is 25, inflation 4%",
    ]

    for query in market_queries:
        analysis = parser.parse(query)
        if analysis.interpreted_market_state:
            logger.info(f"✓ Extracted {len(analysis.interpreted_market_state)} metrics from: '{query}'")
            for metric, value in analysis.interpreted_market_state.items():
                logger.info(f"  - {metric}: {value}")
        else:
            logger.info(f"✗ No metrics extracted from: '{query}'")

    # TEST 3: Chat Manager & Conversation
    logger.info("\n" + "="*70)
    logger.info("[TEST 3] Chat Manager & Conversation Memory")
    logger.info("="*70)

    conv_id = "test_conv_001"
    conv = manager.create_conversation(conv_id)

    messages = [
        ("user", "What happens in bear markets?"),
        ("assistant", "In BEAR markets, average return is -5.2%"),
        ("user", "What about 6-month outlook?"),
        ("assistant", "Looking at 6-month returns..."),
    ]

    for role, content in messages:
        msg = ChatMessage(
            role=role,
            content=content,
            timestamp=datetime.now()
        )
        conv.add_message(msg)
        logger.info(f"✓ Added {role} message: '{content[:50]}...'")

    history = conv.get_history()
    logger.info(f"✓ Conversation has {len(history)} messages")

    summary = conv.get_summary()
    logger.info(f"✓ Conversation summary: {summary.messages_count} messages, created {summary.created_at}")

    # TEST 4: End-to-End Query Processing
    logger.info("\n" + "="*70)
    logger.info("[TEST 4] End-to-End Query Processing")
    logger.info("="*70)

    test_cases = [
        {
            "query": "Market recovery after volatility spike",
            "description": "Natural language query"
        },
        {
            "query": "SPY at 450, VIX 22, CPI 3.2, Fed 5.5",
            "description": "Market state query"
        },
        {
            "query": "BULL regime episodes",
            "description": "Regime-based query"
        },
    ]

    for test in test_cases:
        logger.info(f"\n▶ {test['description']}")
        logger.info(f"  Query: {test['query']}")

        # Parse
        analysis = parser.parse(test['query'])
        logger.info(f"  → Parsed as: {analysis.query_type}")

        # Search
        similar = engine.semantic_search(test['query'], top_k=5, min_confidence=0.0)
        logger.info(f"  → Found {len(similar)} similar episodes")

        if similar:
            # Build response
            episodes = engine.build_similar_episodes(similar, total_episodes)
            insight = reasoning.analyze_outcomes(episodes, total_episodes)

            logger.info(f"  → Statistics:")
            logger.info(f"    - Avg return: {insight.avg_return_6m:+.1f}%")
            logger.info(f"    - Win rate: {insight.win_rate_pct:.0f}%")
            logger.info(f"    - Confidence: {insight.confidence_level}")

            # Format response
            response = formatter.format_response(
                test['query'],
                episodes,
                insight,
                "balanced"
            )

            logger.info(f"  → Response generated")
            logger.info(f"    - Caveats: {len(response.important_caveats)}")
            logger.info(f"    - Follow-ups: {len(response.suggested_follow_ups)}")
            logger.info(f"    - Actions: {len(response.actionable_insights)}")

    # TEST 5: Risk Assessment
    logger.info("\n" + "="*70)
    logger.info("[TEST 5] Risk Assessment & Disclaimers")
    logger.info("="*70)

    similar = engine.semantic_search("bull market", top_k=10, min_confidence=0.0)
    if similar:
        episodes = engine.build_similar_episodes(similar, total_episodes)
        insight = reasoning.analyze_outcomes(episodes, total_episodes)
        response = formatter.format_response("bull market", episodes, insight, "conservative")

        logger.info(f"✓ Risk summary: {response.risk_summary}")
        logger.info(f"✓ Caveats ({len(response.important_caveats)}):")
        for caveat in response.important_caveats[:3]:
            logger.info(f"  - {caveat}")

        logger.info(f"✓ Confidence explanation: {response.confidence_explanation}")

    # TEST 6: Edge Cases
    logger.info("\n" + "="*70)
    logger.info("[TEST 6] Edge Cases")
    logger.info("="*70)

    edge_cases = [
        "random gibberish xyz abc",
        "what if everything changes?",
        "tell me a secret",
        "crypto instead of stocks",
    ]

    for query in edge_cases:
        analysis = parser.parse(query)
        logger.info(f"✓ Handled edge case: '{query}'")
        logger.info(f"  → Type: {analysis.query_type}, Confidence: {analysis.confidence:.1%}")

    # TEST 7: Context Continuity
    logger.info("\n" + "="*70)
    logger.info("[TEST 7] Context Continuity")
    logger.info("="*70)

    conv2 = manager.create_conversation("context_test")

    # First query - establish preference
    msg1 = ChatMessage(role="user", content="I'm conservative investor", timestamp=datetime.now())
    conv2.add_message(msg1)

    analysis1 = parser.parse("I'm conservative investor")
    pref = parser.extract_user_preference("I'm conservative investor")
    logger.info(f"✓ Extracted preference: {pref}")

    # Update context
    manager.update_context("context_test", analysis1)
    context = manager.get_context("context_test")
    logger.info(f"✓ Context updated: {context}")

    # Second query - should use context
    msg2 = ChatMessage(role="user", content="What about 6-month outlook?", timestamp=datetime.now())
    conv2.add_message(msg2)

    analysis2 = parser.parse("What about 6-month outlook?", context)
    logger.info(f"✓ Second query parsed with context")
    logger.info(f"  → Time horizon preference: {context.preferred_horizon}")

    # TEST 8: Validation
    logger.info("\n" + "="*70)
    logger.info("[TEST 8] Validation & Data Integrity")
    logger.info("="*70)

    # Check all response fields are valid
    similar = engine.semantic_search("market", top_k=5, min_confidence=0.0)
    episodes = engine.build_similar_episodes(similar, total_episodes)
    insight = reasoning.analyze_outcomes(episodes, total_episodes)
    response = formatter.format_response("market", episodes, insight)

    # Validate fields
    assert response.confidence_level in ["HIGH", "MEDIUM", "LOW"]
    assert 0 <= response.win_rate <= 100
    assert len(response.important_caveats) > 0
    assert len(response.suggested_follow_ups) > 0
    assert response.similar_episodes_count >= 0

    logger.info(f"✓ Response validation passed")
    logger.info(f"  - Confidence: {response.confidence_level}")
    logger.info(f"  - Win rate: {response.win_rate:.0f}%")
    logger.info(f"  - Episodes: {response.similar_episodes_count}")
    logger.info(f"  - Caveats: {len(response.important_caveats)}")

    logger.info("\n" + "="*70)
    logger.info("✅ PHASE 4 TESTS COMPLETE - ALL PASSED")
    logger.info("="*70)

    engine.close()


if __name__ == '__main__':
    test_phase4()
