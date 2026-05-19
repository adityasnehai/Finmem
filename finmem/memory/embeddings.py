import numpy as np
from sentence_transformers import SentenceTransformer
from finmem.data.schemas import Episode, MarketState

_model: SentenceTransformer | None = None

STRUCT_DIM  = 7
TEXT_DIM    = 384
STRUCT_W    = 0.6
TEXT_W      = 0.4
EMBED_DIM   = STRUCT_DIM + TEXT_DIM   # 391 total, stored as-is


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def _struct_vec(
    avg_return: float,
    vol: float,
    cpi: float,
    fed_rate: float,
    yield_spread: float,
    vix: float,
    unemployment: float,
) -> np.ndarray:
    raw = np.array([avg_return, vol, cpi / 10, fed_rate / 10, yield_spread / 5, vix / 50, unemployment / 10], dtype=np.float32)
    norm = np.linalg.norm(raw)
    return raw / (norm + 1e-8)


def embed_episode(ep: Episode) -> np.ndarray:
    struct = _struct_vec(
        ep.avg_daily_return,
        ep.rolling_vol,
        ep.cpi,
        ep.fed_rate,
        ep.yield_spread,
        ep.vix_level,
        ep.unemployment,
    )
    text_vec = _get_model().encode(ep.prose_summary, normalize_embeddings=True).astype(np.float32)
    hybrid   = np.concatenate([struct * STRUCT_W, text_vec * TEXT_W])
    return hybrid.astype(np.float32)


def embed_state(state: MarketState) -> np.ndarray:
    struct = _struct_vec(
        state.spy_return_21d / 21,
        state.rolling_vol_21d,
        state.cpi,
        state.fed_rate,
        state.yield_spread,
        state.vix,
        state.unemployment,
    )
    desc = (
        f"Current market: SPY {state.spy_return_21d:.1%} over 21 days, "
        f"VIX {state.vix:.1f}, CPI {state.cpi:.1f}%, Fed rate {state.fed_rate:.2f}%, "
        f"yield curve {state.yield_spread:.2f}%, unemployment {state.unemployment:.1f}%."
    )
    text_vec = _get_model().encode(desc, normalize_embeddings=True).astype(np.float32)
    hybrid   = np.concatenate([struct * STRUCT_W, text_vec * TEXT_W])
    return hybrid.astype(np.float32)
