"""Phase 3 FastAPI endpoints for episodic reasoning queries"""

import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from api.schemas import (
    QueryRequest, MarketStateQuery, RegimeQuery, QueryResponse,
    HealthCheck, MarketState
)
from api.query_engine import QueryEngine
from api.reasoning import ReasoningEngine
from api.similarity_search import init_search_engine, encode_text

logger = logging.getLogger(__name__)

app = FastAPI(title="FinMem Phase 3 - Episodic Reasoning", version="1.0.0")

# Global engine instances
_query_engine = None
_reasoning_engine = None


def get_query_engine():
    """Lazy initialization of query engine"""
    global _query_engine
    if _query_engine is None:
        db_url = os.getenv('DATABASE_URL', 'postgresql://localhost/finmem')
        _query_engine = QueryEngine(db_url)
        _query_engine.connect()
    return _query_engine


def get_reasoning_engine():
    """Lazy initialization of reasoning engine"""
    global _reasoning_engine
    if _reasoning_engine is None:
        _reasoning_engine = ReasoningEngine()
    return _reasoning_engine


@app.on_event("shutdown")
async def shutdown_event():
    """Close database connections on shutdown"""
    global _query_engine
    if _query_engine:
        _query_engine.close()


@app.get("/health", response_model=HealthCheck)
async def health_check():
    """Check Phase 3 readiness"""
    try:
        engine = get_query_engine()
        total_episodes = engine.get_total_episodes()

        return HealthCheck(
            status="ready",
            episodes_total=total_episodes,
            episodes_with_embeddings=total_episodes,
            lancedb_connected=True,
            phase3_ready=total_episodes > 0,
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthCheck(
            status="error",
            episodes_total=0,
            episodes_with_embeddings=0,
            lancedb_connected=False,
            phase3_ready=False,
        )


@app.post("/query", response_model=QueryResponse)
async def query_natural_language(request: QueryRequest):
    """Query by natural language with optional filters

    Example:
        {
            "query": "Market conditions similar to 2020 volatility spike",
            "regime_filter": "BEAR",
            "top_k": 5,
            "min_confidence": 0.5
        }
    """
    try:
        init_search_engine()
        engine = get_query_engine()
        reasoning = get_reasoning_engine()

        # Hybrid search
        similar_results = engine.hybrid_search(
            query_text=request.query,
            top_k=request.top_k,
            min_confidence=request.min_confidence,
            regime=request.regime_filter,
            date_from=request.date_from.isoformat() if request.date_from else None,
            date_to=request.date_to.isoformat() if request.date_to else None,
        )

        if not similar_results:
            return QueryResponse(
                query=request.query,
                similar_episodes=[],
                reasoning=reasoning.analyze_outcomes([], engine.get_total_episodes()),
                insight_text="No similar episodes found matching your query. Try broader search terms.",
                warning="No results",
            )

        # Build episode objects with outcomes
        total_episodes = engine.get_total_episodes()
        similar_episodes = engine.build_similar_episodes(similar_results, total_episodes)

        # Generate reasoning
        reasoning_insight = reasoning.analyze_outcomes(similar_episodes, total_episodes)
        insight_text, warning = reasoning.generate_insight_text(
            similar_episodes, reasoning_insight, request.query
        )

        return QueryResponse(
            query=request.query,
            similar_episodes=similar_episodes,
            reasoning=reasoning_insight,
            insight_text=insight_text,
            warning=warning,
        )

    except Exception as e:
        logger.error(f"Query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query/market-state", response_model=QueryResponse)
async def query_market_state(request: MarketStateQuery):
    """Query by structured market state

    Example:
        {
            "market_state": {
                "spy_price": 450,
                "vix": 22,
                "cpi": 3.2,
                "fed_rate": 5.5
            },
            "top_k": 5,
            "min_confidence": 0.5
        }
    """
    try:
        init_search_engine()
        engine = get_query_engine()
        reasoning = get_reasoning_engine()

        # Convert market state to natural language
        query_text = _market_state_to_text(request.market_state)

        # Hybrid search
        similar_results = engine.hybrid_search(
            query_text=query_text,
            top_k=request.top_k,
            min_confidence=request.min_confidence,
            regime=request.regime_filter,
        )

        total_episodes = engine.get_total_episodes()
        similar_episodes = engine.build_similar_episodes(similar_results, total_episodes)

        reasoning_insight = reasoning.analyze_outcomes(similar_episodes, total_episodes)
        insight_text, warning = reasoning.generate_insight_text(
            similar_episodes, reasoning_insight, query_text
        )

        return QueryResponse(
            query=query_text,
            similar_episodes=similar_episodes,
            reasoning=reasoning_insight,
            insight_text=insight_text,
            warning=warning,
        )

    except Exception as e:
        logger.error(f"Market state query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query/regime", response_model=QueryResponse)
async def query_by_regime(request: RegimeQuery):
    """Query episodes by regime only

    Example:
        {
            "regime": "BEAR",
            "top_k": 10
        }
    """
    try:
        engine = get_query_engine()
        reasoning = get_reasoning_engine()

        # Get episodes by regime directly from database
        cur = engine._postgres_conn.cursor()
        cur.execute("""
            SELECT id, regime, start_date, end_date, avg_vix, avg_cpi, avg_fed_rate,
                   total_return, max_drawdown, spy_return_6m_after
            FROM episodes
            WHERE regime = %s
            ORDER BY start_date DESC
            LIMIT %s
        """, (request.regime, request.top_k))

        rows = cur.fetchall()
        cur.close()

        if not rows:
            return QueryResponse(
                query=f"Regime: {request.regime}",
                similar_episodes=[],
                reasoning=reasoning.analyze_outcomes([], engine.get_total_episodes()),
                insight_text=f"No episodes found with regime: {request.regime}",
                warning="No results",
            )

        # Build episode objects (without similarity score, all equally valid for regime)
        from api.schemas import SimilarEpisode, EpisodeOutcome
        total_episodes = engine.get_total_episodes()
        similar_episodes = []

        for row in rows:
            ep_id, regime, start_date, end_date, vix, cpi, fed = row[0:7]
            total_return, max_dd, spy_ret_6m = row[7:10]

            duration = (end_date - start_date).days

            outcome = EpisodeOutcome(
                return_6m=spy_ret_6m,
                max_gain=max(0, total_return),
                max_loss=min(0, total_return),
                sharpe_ratio_6m=engine._calculate_sharpe(spy_ret_6m, max_dd),
            )

            similar_episodes.append(SimilarEpisode(
                episode_id=ep_id,
                regime=regime,
                start_date=str(start_date),
                end_date=str(end_date),
                duration_days=duration,
                avg_vix=vix,
                avg_cpi=cpi,
                avg_fed_rate=fed,
                similarity_score=100.0,  # All regime episodes equally valid
                l2_distance=0.0,  # Perfect match (regime query)
                outcomes=outcome,
            ))

        reasoning_insight = reasoning.analyze_outcomes(similar_episodes, total_episodes)
        insight_text, warning = reasoning.generate_insight_text(
            similar_episodes, reasoning_insight, f"Regime: {request.regime}"
        )

        return QueryResponse(
            query=f"Regime: {request.regime}",
            similar_episodes=similar_episodes,
            reasoning=reasoning_insight,
            insight_text=insight_text,
            warning=warning,
        )

    except Exception as e:
        logger.error(f"Regime query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _market_state_to_text(market_state: MarketState) -> str:
    """Convert structured market state to natural language query"""
    parts = ["Current market state:"]

    if market_state.spy_price:
        parts.append(f"SPY at {market_state.spy_price:.0f}")
    if market_state.vix:
        parts.append(f"VIX {market_state.vix:.1f}")
    if market_state.cpi:
        parts.append(f"CPI {market_state.cpi:.2f}%")
    if market_state.fed_rate:
        parts.append(f"Fed Rate {market_state.fed_rate:.2f}%")
    if market_state.yield_spread is not None:
        if market_state.yield_spread < 0:
            parts.append(f"Yield curve inverted {market_state.yield_spread:.2f}%")
        else:
            parts.append(f"Yield spread {market_state.yield_spread:.2f}%")
    if market_state.unemployment:
        parts.append(f"Unemployment {market_state.unemployment:.2f}%")

    return ". ".join(parts)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
