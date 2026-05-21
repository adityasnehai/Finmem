import time
import numpy as np
import pandas as pd
from finmem.data.schemas import Episode, MarketState, RetrievalResult, QueryResult
from finmem.memory.embeddings import embed_state
from finmem.memory.store import get_table, get_whitened_state
from finmem.memory.regime import predict_state_regime

# Thresholds calibrated for text-embedding-3-small + all-but-the-top whitening.
# Pairwise similarity distribution across episodes: median≈0, p75≈0.22, p90≈0.42.
# A query sim of 0.15+ is meaningful signal; 0.27+ is a strong match.
CONFIDENCE_HIGH   = 0.27
CONFIDENCE_LOW    = 0.15
REGIME_BONUS      = 0.10
RECENCY_CUTOFF_YR = 15
RECENCY_PENALTY   = 0.05
TOP_K             = 5
CANDIDATE_K       = 20


def _whiten_query(vec: np.ndarray, mean_vec: np.ndarray, top_pcs: np.ndarray) -> np.ndarray:
    """Apply all-but-the-top transform to a single query vector."""
    centered = vec - mean_vec
    proj     = centered @ top_pcs.T @ top_pcs
    whitened = centered - proj
    norm     = np.linalg.norm(whitened)
    return (whitened / (norm + 1e-8)).astype(np.float32)


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
    raw_vec = embed_state(state)

    # Load pre-whitened episode vectors and apply same transform to the query.
    # all-but-the-top (Mu & Viswanath, ICLR 2018): removes the dominant
    # 'financial episode' direction so cosine similarity is actually discriminative.
    whitened_ep_vecs, df_ep, mean_vec, top_pcs = get_whitened_state()
    whitened_query = _whiten_query(raw_vec, mean_vec, top_pcs)

    # Cosine similarity: both sides are L2-normalised by get_whitened_state / _whiten_query
    sims = whitened_ep_vecs @ whitened_query

    # Take top CANDIDATE_K for reranking
    top_candidate_idx = np.argsort(sims)[-CANDIDATE_K:][::-1]

    state_regime = predict_state_regime(state)
    reranked: list[RetrievalResult] = []
    current_year = pd.Timestamp.now().year

    for idx in top_candidate_idx:
        row      = df_ep.iloc[int(idx)]
        base_sim = float(sims[idx])
        regime_bonus = REGIME_BONUS if row["regime"] == state_regime else 0.0
        ep_year  = int(str(row["start_date"])[:4])
        years_ago = current_year - ep_year
        recency_pen = RECENCY_PENALTY if years_ago > RECENCY_CUTOFF_YR else 0.0
        final    = base_sim + regime_bonus - recency_pen

        reranked.append(RetrievalResult(
            episode=_row_to_episode(row),
            similarity=round(base_sim, 4),
            regime_bonus=regime_bonus,
            recency_penalty=recency_pen,
            final_score=round(final, 4),
        ))

    reranked.sort(key=lambda r: r.final_score, reverse=True)
    top = reranked[:k]

    top_sim    = top[0].final_score if top else 0.0
    has_analog = top_sim >= CONFIDENCE_LOW
    confidence = min(top_sim, 1.0)

    return QueryResult(
        query_state=state,
        retrieved=top,
        confidence=round(confidence, 4),
        has_analog=has_analog,
        latency_ms=round((time.time() - t0) * 1000, 1),
    )
