import time
import numpy as np
import pandas as pd
from finmem.data.schemas import Episode, MarketState, RetrievalResult, QueryResult
from finmem.memory.embeddings import embed_state
from finmem.memory.store import get_table

CONFIDENCE_HIGH   = 0.65
CONFIDENCE_LOW    = 0.45
REGIME_BONUS      = 0.10
RECENCY_CUTOFF_YR = 15
RECENCY_PENALTY   = 0.05
TOP_K             = 5
CANDIDATE_K       = 20


def _assign_regime(state: MarketState) -> str:
    if state.vix > 35:
        return "CRISIS"
    if state.vix > 25 and state.spy_return_21d < -0.08:
        return "SELLOFF"
    if state.cpi > 5 and state.fed_rate > 3:
        return "TIGHTENING"
    if state.yield_spread < -0.2 and state.fed_rate > 2:
        return "TIGHTENING+SLOWDOWN"
    if state.fed_rate < 1 and state.spy_return_21d > 0:
        return "EASING+RECOVERY"
    if state.spy_return_21d > 0.05 and state.vix < 20:
        return "BULL"
    return "STABLE"


def _row_to_episode(row: pd.Series) -> Episode:
    return Episode(
        id=row["id"],
        start_date=row["start_date"],
        end_date=row["end_date"],
        duration_days=int(row["duration_days"]),
        avg_daily_return=float(row["avg_daily_return"]),
        total_return=float(row["total_return"]),
        max_drawdown=float(row["max_drawdown"]),
        rolling_vol=float(row["rolling_vol"]),
        vix_level=float(row["vix_level"]),
        cpi=float(row["cpi"]),
        fed_rate=float(row["fed_rate"]),
        yield_spread=float(row["yield_spread"]),
        unemployment=float(row["unemployment"]),
        spy_return_1m_after=float(row["spy_return_1m_after"]) if row["spy_return_1m_after"] else None,
        spy_return_3m_after=float(row["spy_return_3m_after"]) if row["spy_return_3m_after"] else None,
        spy_return_6m_after=float(row["spy_return_6m_after"]) if row["spy_return_6m_after"] else None,
        regime=row["regime"],
        prose_summary=row["prose_summary"],
    )


def retrieve(state: MarketState, k: int = TOP_K) -> QueryResult:
    t0      = time.time()
    vec     = embed_state(state)
    table   = get_table()
    state_regime = _assign_regime(state)

    results = (
        table.search(vec.tolist())
             .metric("cosine")
             .limit(CANDIDATE_K)
             .to_pandas()
    )

    reranked: list[RetrievalResult] = []
    current_year = pd.Timestamp.now().year

    for _, row in results.iterrows():
        base_sim = float(1 - row["_distance"])  # cosine distance → similarity
        regime_bonus = REGIME_BONUS if row["regime"] == state_regime else 0.0
        ep_year = int(str(row["start_date"])[:4])
        years_ago = current_year - ep_year
        recency_pen = RECENCY_PENALTY if years_ago > RECENCY_CUTOFF_YR else 0.0
        final = base_sim + regime_bonus - recency_pen

        reranked.append(RetrievalResult(
            episode=_row_to_episode(row),
            similarity=round(base_sim, 4),
            regime_bonus=regime_bonus,
            recency_penalty=recency_pen,
            final_score=round(final, 4),
        ))

    reranked.sort(key=lambda r: r.final_score, reverse=True)
    top = reranked[:k]

    top_sim   = top[0].final_score if top else 0.0
    has_analog = top_sim >= CONFIDENCE_LOW
    confidence = min(top_sim, 1.0)

    return QueryResult(
        query_state=state,
        retrieved=top,
        confidence=round(confidence, 4),
        has_analog=has_analog,
        latency_ms=round((time.time() - t0) * 1000, 1),
    )
