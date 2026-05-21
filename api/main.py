import os
import sys
import json
import math
import asyncio
import logging
from datetime import datetime
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)


def _check_env() -> None:
    missing = [k for k in ("OPENAI_API_KEY",) if not os.environ.get(k)]
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")


def _clean(v):
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v

from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
load_dotenv()
_check_env()

from finmem.data.loaders import load_all
from finmem.data.schemas import MarketState
from finmem.memory.retrieval import retrieve
from finmem.memory.store import get_table, count_episodes, episode_date_range, get_whitened_state
from finmem.memory.regime import predict_state_regime
from finmem.reasoning.confidence import confidence_gate
from openai import OpenAI
import pandas as pd
import numpy as np
from datetime import date as _date

_ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "http://localhost:3000")

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="FinMem API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[_ALLOWED_ORIGIN],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

_df: pd.DataFrame | None = None
_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"), timeout=30.0)

_CACHE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "market_cache.parquet")


def _save_cache(df: pd.DataFrame) -> None:
    try:
        os.makedirs(os.path.dirname(_CACHE_PATH), exist_ok=True)
        df.to_parquet(_CACHE_PATH)
        logger.info("Market data cached to %s", _CACHE_PATH)
    except Exception as e:
        logger.warning("Could not save market cache: %s", e)


def _load_cache() -> pd.DataFrame | None:
    try:
        if os.path.exists(_CACHE_PATH):
            df = pd.read_parquet(_CACHE_PATH)
            logger.info("Loaded market data from cache (%s rows, last=%s)", len(df), df.index[-1].date())
            return df
    except Exception as e:
        logger.warning("Could not read market cache: %s", e)
    return None


@app.on_event("startup")
async def _warmup():
    """Pre-load market data and sentence-transformer model so first request is fast."""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _warmup_sync)


def _cache_is_fresh(df: pd.DataFrame, max_age_days: int = 4) -> bool:
    """Cache is fresh if last row is within max_age_days (handles weekends + holidays)."""
    from datetime import timedelta
    return df.index[-1].date() >= (_date.today() - timedelta(days=max_age_days))


def _warmup_sync():
    global _df
    cached = _load_cache()
    if cached is not None:
        _df = cached
        if _cache_is_fresh(cached):
            logger.info("Cache is fresh (last=%s), skipping yfinance", cached.index[-1].date())
            return
    try:
        _df = load_all()
        _save_cache(_df)
    except Exception as e:
        logger.warning("yfinance unavailable on startup (%s); serving from cache", e)
        if _df is None:
            raise RuntimeError("No market data: yfinance failed and no cache found") from e


def get_df() -> pd.DataFrame:
    global _df
    if _df is None:
        cached = _load_cache()
        if cached is not None:
            _df = cached
    if _df is not None and _cache_is_fresh(_df):
        return _df
    try:
        _df = load_all()
        _save_cache(_df)
    except Exception as e:
        logger.warning("yfinance unavailable (%s); using cached data", e)
        if _df is None:
            raise RuntimeError("No market data: yfinance failed and no cache found") from e
    return _df


def _safe_float(v, default=0.0) -> float:
    try:
        f = float(v)
        return default if (math.isnan(f) or math.isinf(f)) else f
    except Exception:
        return default


def latest_state(df: pd.DataFrame) -> MarketState:
    row = df.iloc[-1]
    return MarketState(
        date=row.name.date(),
        spy_price=_safe_float(row["spy_close"]),
        spy_return_1d=_safe_float(row["spy_return_1d"]),
        spy_return_5d=_safe_float(row["spy_return_5d"]),
        spy_return_21d=_safe_float(row["spy_return_21d"]),
        vix=_safe_float(row["vix"]),
        cpi=_safe_float(row["cpi"]),
        fed_rate=_safe_float(row["fed_rate"]),
        yield_spread=_safe_float(row["yield_spread"]),
        unemployment=_safe_float(row["unemployment"]),
        rolling_vol_21d=_safe_float(row["rolling_vol_21d"]),
    )




# ── ENDPOINTS ─────────────────────────────────────────────────────────────────

@app.get("/api/state")
def get_state():
    df     = get_df()
    state  = latest_state(df)
    result = retrieve(state)

    episodes = []
    for r in result.retrieved:
        ep = r.episode
        episodes.append({
            "id":                 ep.id,
            "start_date":         str(ep.start_date),
            "end_date":           str(ep.end_date),
            "regime":             ep.regime,
            "similarity":         round(min(r.final_score, 1.0), 3),
            "similarity_pct":     f"{min(r.final_score, 1.0):.0%}",
            "spy_return_6m_after": _clean(ep.spy_return_6m_after),
            "total_return":       _clean(ep.total_return),
            "max_drawdown":       _clean(ep.max_drawdown),
            "vix_level":          _clean(ep.vix_level),
            "cpi":                _clean(ep.cpi),
            "fed_rate":           _clean(ep.fed_rate),
            "yield_spread":       _clean(ep.yield_spread),
            "prose_summary":      ep.prose_summary,
        })

    return {
        "state": {
            "date":           str(state.date),
            "spy_price":      round(state.spy_price, 2),
            "spy_return_1d":  round(state.spy_return_1d * 100, 2),
            "spy_return_5d":  round(state.spy_return_5d * 100, 2),
            "spy_return_21d": round(state.spy_return_21d * 100, 2),
            "vix":            round(state.vix, 1),
            "cpi":            round(state.cpi, 1),
            "fed_rate":       round(state.fed_rate, 2),
            "yield_spread":   round(state.yield_spread, 2),
            "unemployment":   round(state.unemployment, 1),
            "regime":         predict_state_regime(state) or "UNKNOWN",
        },
        "episodes":   episodes,
        "confidence": round(result.confidence, 3),
        "latency_ms": result.latency_ms,
    }


@app.get("/api/memory")
def get_memory():
    n    = count_episodes()
    s, e = episode_date_range()
    try:
        tbl  = get_table()
        df_ep = tbl.to_pandas()
        regimes = df_ep["regime"].value_counts().to_dict()
    except Exception:
        regimes = {}
    return {
        "total_episodes": n,
        "start_date":     s or "",
        "end_date":       e or "",
        "regimes":        regimes,
        "ready":          n > 0,
    }


@app.get("/api/episodes/search")
def search_episodes(
    cpi_gt:   float | None = Query(None),
    cpi_lt:   float | None = Query(None),
    vix_gt:   float | None = Query(None),
    fed_gt:   float | None = Query(None),
    regime:   str   | None = Query(None),
    limit:    int          = Query(10),
):
    try:
        tbl   = get_table()
        df_ep = tbl.to_pandas()
    except Exception:
        raise HTTPException(503, "Memory not initialized.")

    if cpi_gt  is not None: df_ep = df_ep[df_ep["cpi"]       > cpi_gt]
    if cpi_lt  is not None: df_ep = df_ep[df_ep["cpi"]       < cpi_lt]
    if vix_gt  is not None: df_ep = df_ep[df_ep["vix_level"] > vix_gt]
    if fed_gt  is not None: df_ep = df_ep[df_ep["fed_rate"]  > fed_gt]
    if regime  is not None: df_ep = df_ep[df_ep["regime"]    == regime.upper()]

    df_ep = df_ep.head(limit)
    rows  = []
    for _, row in df_ep.iterrows():
        rows.append({
            "start_date":          str(row["start_date"]),
            "end_date":            str(row["end_date"]),
            "regime":              row["regime"],
            "cpi":                 round(float(row["cpi"]), 1),
            "fed_rate":            round(float(row["fed_rate"]), 2),
            "vix_level":           round(float(row["vix_level"]), 1),
            "yield_spread":        round(float(row["yield_spread"]), 2),
            "unemployment":        round(float(row["unemployment"]), 1),
            "total_return":        round(float(row["total_return"]) * 100, 1),
            "max_drawdown":        round(float(row["max_drawdown"]) * 100, 1),
            "spy_return_6m_after": round(float(row["spy_return_6m_after"]) * 100, 1) if row["spy_return_6m_after"] else None,
            "prose_summary":       row["prose_summary"],
        })
    return {"episodes": rows, "count": len(rows)}


class ChatRequest(BaseModel):
    message: str
    episode_context: list[dict] | None = None


@app.post("/api/chat/stream")
@limiter.limit("10/minute")
async def chat_stream(request: Request, req: ChatRequest):
    df     = get_df()
    state  = latest_state(df)
    result = retrieve(state)

    should_reason, prefix = confidence_gate(result)

    if not should_reason:
        async def no_analog():
            yield f"data: {json.dumps({'text': prefix, 'done': False})}\n\n"
            yield f"data: {json.dumps({'done': True, 'confidence': result.confidence, 'latency_ms': result.latency_ms})}\n\n"
        return StreamingResponse(no_analog(), media_type="text/event-stream")

    def _fmt_episode(i: int, r) -> str:
        fwd = f"\n    SPY 6m after: {r.episode.spy_return_6m_after:+.1%}" if r.episode.spy_return_6m_after is not None else ""
        return (
            f"[{i+1}] {r.episode.start_date} → {r.episode.end_date} | {r.episode.regime} | sim {r.final_score:.2f}\n"
            f"    {r.episode.prose_summary}{fwd}"
        )
    episode_context = "\n".join([_fmt_episode(i, r) for i, r in enumerate(result.retrieved)])

    system_prompt = (
        "You are FinMem, a financial historian with episodic memory of market history.\n"
        "Reason ONLY from the retrieved episodes. Cite episode dates and similarity scores.\n"
        "If uncertain, say so. Keep responses to 3-5 sentences.\n"
        "Always end with: → Source: [episode dates] · sim [score]"
    )
    user_content = f"{prefix}RETRIEVED EPISODES:\n{episode_context}\n\nQUESTION: {req.message}"

    async def stream_response():
        try:
            stream = _client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": user_content},
                ],
                max_tokens=400,
                temperature=0.3,
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    yield f"data: {json.dumps({'text': delta, 'done': False})}\n\n"
        except Exception as e:
            # Fallback: synthesize answer from retrieved episodes without LLM
            episodes_text = "\n".join([
                f"• {r.episode.start_date} → {r.episode.end_date} [{r.episode.regime}] "
                f"sim={r.final_score:.2f}: {r.episode.prose_summary}"
                for r in result.retrieved[:3]
            ])
            fallback = (
                f"[OpenAI unavailable — template response]\n\n"
                f"Based on {len(result.retrieved)} retrieved episodes (confidence: {result.confidence:.0%}):\n\n"
                f"{episodes_text}\n\n"
                f"→ Source: retrieved episodes · sim {result.confidence:.2f}"
            )
            yield f"data: {json.dumps({'text': fallback, 'done': False})}\n\n"
        yield f"data: {json.dumps({'done': True, 'confidence': result.confidence, 'latency_ms': result.latency_ms})}\n\n"

    return StreamingResponse(stream_response(), media_type="text/event-stream")


@app.get("/api/ablation")
def get_ablation():
    path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "results", "ablation.json")
    if not os.path.exists(path):
        return {"available": False}
    with open(path) as f:
        data = json.load(f)
    return {"available": True, "results": data}


@app.get("/api/episodes")
def list_all_episodes(
    regime: str | None = Query(None),
    limit: int = Query(100),
):
    """List all episodes with optional regime filter"""
    try:
        tbl = get_table()
        df_ep = tbl.to_pandas()
    except Exception:
        raise HTTPException(503, "Memory not initialized")

    if regime is not None:
        df_ep = df_ep[df_ep["regime"] == regime.upper()]

    df_ep = df_ep.head(limit)
    rows = []
    for idx, row in df_ep.iterrows():
        rows.append({
            "id": str(row["id"]) if "id" in row.index else str(idx),
            "start_date": str(row["start_date"]),
            "end_date": str(row["end_date"]),
            "regime": row["regime"],
            "cpi": _clean(_safe_float(row["cpi"])),
            "fed_rate": _clean(_safe_float(row["fed_rate"])),
            "vix_level": _clean(_safe_float(row["vix_level"])),
            "yield_spread": _clean(_safe_float(row["yield_spread"])),
            "unemployment": _clean(_safe_float(row["unemployment"])),
            "total_return": _clean(_safe_float(row["total_return"]) * 100),
            "max_drawdown": _clean(_safe_float(row["max_drawdown"]) * 100),
            "spy_return_6m_after": _clean(_safe_float(row["spy_return_6m_after"]) * 100 if row["spy_return_6m_after"] else None),
            "prose_summary": row["prose_summary"],
        })
    return {"episodes": rows, "count": len(rows)}


@app.get("/api/episodes/export")
def export_episodes(regime: str | None = Query(None)):
    """Export episodes data for download — must be before /{episode_id} to avoid route collision"""
    try:
        tbl = get_table()
        df_ep = tbl.to_pandas()
    except Exception:
        raise HTTPException(503, "Memory not initialized")

    if regime is not None:
        df_ep = df_ep[df_ep["regime"] == regime.upper()]

    rows = []
    for _, row in df_ep.iterrows():
        rows.append({
            "start_date": str(row["start_date"]),
            "end_date": str(row["end_date"]),
            "duration_days": (pd.to_datetime(row["end_date"]) - pd.to_datetime(row["start_date"])).days,
            "regime": row["regime"],
            "spy_return_%": round(float(row["total_return"]) * 100, 2),
            "max_drawdown_%": round(float(row["max_drawdown"]) * 100, 2),
            "spy_return_6m_after_%": round(float(row["spy_return_6m_after"]) * 100, 2) if row["spy_return_6m_after"] else None,
            "vix_avg": round(float(row["vix_level"]), 1),
            "cpi_%": round(float(row["cpi"]), 1),
            "fed_rate_%": round(float(row["fed_rate"]), 2),
            "yield_spread_%": round(float(row["yield_spread"]), 2),
            "unemployment_%": round(float(row["unemployment"]), 1),
            "summary": row["prose_summary"][:200] if row["prose_summary"] else "",
        })

    return {
        "episodes": rows,
        "count": len(rows),
        "regime_filter": regime or "ALL",
        "export_date": datetime.now().isoformat(),
    }


@app.get("/api/episodes/{episode_id}")
def get_episode_detail(episode_id: str):
    """Get detailed view of a single episode by UUID or row index"""
    try:
        tbl = get_table()
        df_ep = tbl.to_pandas()
    except Exception:
        raise HTTPException(503, "Memory not initialized")

    # Match by id column (UUID) first, fall back to row index for backwards compat
    if "id" in df_ep.columns:
        matches = df_ep[df_ep["id"] == episode_id]
        if not matches.empty:
            row = matches.iloc[0]
        else:
            # Try as integer row index fallback
            try:
                idx = int(episode_id)
                if idx < len(df_ep):
                    row = df_ep.iloc[idx]
                else:
                    raise HTTPException(404, "Episode not found")
            except ValueError:
                raise HTTPException(404, "Episode not found")
    else:
        try:
            idx = int(episode_id)
            if idx < len(df_ep):
                row = df_ep.iloc[idx]
            else:
                raise HTTPException(404, "Episode not found")
        except ValueError:
            raise HTTPException(404, "Episode not found")

    # Calculate multi-timeframe returns if not already in database
    returns_1m = _safe_float(row.get("spy_return_1m_after")) if "spy_return_1m_after" in row.index else None
    returns_3m = _safe_float(row.get("spy_return_3m_after")) if "spy_return_3m_after" in row.index else None
    returns_1y = _safe_float(row.get("spy_return_1y_after")) if "spy_return_1y_after" in row.index else None

    return {
        "id": episode_id,
        "start_date": str(row["start_date"]),
        "end_date": str(row["end_date"]),
        "regime": row["regime"],
        "duration_days": (pd.to_datetime(row["end_date"]) - pd.to_datetime(row["start_date"])).days,
        "cpi": _clean(_safe_float(row["cpi"])),
        "fed_rate": _clean(_safe_float(row["fed_rate"])),
        "vix_level": _clean(_safe_float(row["vix_level"])),
        "yield_spread": _clean(_safe_float(row["yield_spread"])),
        "unemployment": _clean(_safe_float(row["unemployment"])),
        "total_return": _clean(_safe_float(row["total_return"]) * 100),
        "max_drawdown": _clean(_safe_float(row["max_drawdown"]) * 100),
        "spy_return_1m_after": _clean(returns_1m * 100 if returns_1m else None),
        "spy_return_3m_after": _clean(returns_3m * 100 if returns_3m else None),
        "spy_return_6m_after": _clean(_safe_float(row["spy_return_6m_after"]) * 100 if row["spy_return_6m_after"] else None),
        "spy_return_1y_after": _clean(returns_1y * 100 if returns_1y else None),
        "prose_summary": row["prose_summary"],
    }


@app.get("/api/episodes/{id1}/compare/{id2}")
def compare_episodes(id1: int, id2: int):
    """Compare two episodes side-by-side"""
    try:
        tbl = get_table()
        df_ep = tbl.to_pandas()
    except Exception:
        raise HTTPException(503, "Memory not initialized")

    def get_ep(ep_id):
        if ep_id < len(df_ep):
            return df_ep.iloc[ep_id]
        if "id" in df_ep.columns:
            matches = df_ep[df_ep["id"] == ep_id]
            if not matches.empty:
                return matches.iloc[0]
        return None

    ep1 = get_ep(id1)
    ep2 = get_ep(id2)

    if ep1 is None or ep2 is None:
        raise HTTPException(404, "One or both episodes not found")

    def ep_dict(row, ep_id):
        return {
            "id": ep_id,
            "start_date": str(row["start_date"]),
            "end_date": str(row["end_date"]),
            "regime": row["regime"],
            "cpi": _clean(_safe_float(row["cpi"])),
            "fed_rate": _clean(_safe_float(row["fed_rate"])),
            "vix_level": _clean(_safe_float(row["vix_level"])),
            "yield_spread": _clean(_safe_float(row["yield_spread"])),
            "unemployment": _clean(_safe_float(row["unemployment"])),
            "total_return": _clean(_safe_float(row["total_return"]) * 100),
            "max_drawdown": _clean(_safe_float(row["max_drawdown"]) * 100),
            "spy_return_6m_after": _clean(_safe_float(row["spy_return_6m_after"]) * 100 if row["spy_return_6m_after"] else None),
        }

    return {
        "episode_1": ep_dict(ep1, id1),
        "episode_2": ep_dict(ep2, id2),
    }


@app.get("/api/episodes/{episode_id}/precursors")
def get_episode_precursors(episode_id: str):
    """Get precursor/indicator data for specific episode (what preceded this shift)"""
    try:
        from api.query_engine import QueryEngine
        qe = QueryEngine(os.environ.get("DATABASE_URL"))
        qe.connect()
        precursors = qe.get_historical_indicators(episode_id)
        qe.close()

        if not precursors:
            return {}

        return {
            "shift_from_regime": precursors.get("shift_from_regime"),
            "shift_to_regime": precursors.get("shift_to_regime"),
            "shift_date": precursors.get("shift_date"),
            "vix_5d_avg": _clean(_safe_float(precursors.get("vix_5d_avg"))),
            "vix_10d_avg": _clean(_safe_float(precursors.get("vix_10d_avg"))),
            "vix_20d_avg": _clean(_safe_float(precursors.get("vix_20d_avg"))),
            "yield_spread_5d": _clean(_safe_float(precursors.get("yield_spread_5d"))),
            "yield_inversion_detected": precursors.get("yield_inversion_detected"),
            "vix_spike_detected": precursors.get("vix_spike_detected"),
            "fed_tightening": precursors.get("fed_tightening"),
            "cpi_change_pct": _clean(_safe_float(precursors.get("cpi_change_pct"))),
            "fed_rate_change_bps": _clean(precursors.get("fed_rate_change_bps")),
        }
    except Exception as e:
        logger.error(f"Failed to get precursors: {e}")
        return {}


@app.get("/api/regime-transitions")
def get_regime_transitions():
    """Get regime transition probabilities (what happens after each regime)"""
    try:
        from api.query_engine import QueryEngine
        qe = QueryEngine(os.environ.get("DATABASE_URL"))
        qe.connect()

        # Get transitions with counts from precursor table
        cur = qe._postgres_conn.cursor()
        cur.execute("""
            SELECT shift_from_regime, shift_to_regime, COUNT(*) as count
            FROM historical_regime_indicators
            GROUP BY shift_from_regime, shift_to_regime
        """)

        rows = cur.fetchall()
        cur.close()

        # Build transition matrix with probabilities and counts
        transitions = {}
        for from_regime, to_regime, count in rows:
            if from_regime not in transitions:
                transitions[from_regime] = {}
            transitions[from_regime][to_regime] = {"count": count, "probability": 0}

        # Calculate probabilities
        for from_regime in transitions:
            total = sum(t["count"] for t in transitions[from_regime].values())
            for to_regime in transitions[from_regime]:
                transitions[from_regime][to_regime]["probability"] = float(
                    transitions[from_regime][to_regime]["count"] / total
                )

        qe.close()

        # Transform to array format for frontend
        result = []
        for from_regime, to_regimes in transitions.items():
            for to_regime, data in to_regimes.items():
                result.append({
                    "from_regime": from_regime,
                    "to_regime": to_regime,
                    "probability": data["probability"],
                    "count": data["count"],
                })

        return sorted(result, key=lambda x: (x["from_regime"], -x["probability"]))
    except Exception as e:
        logger.error(f"Failed to get regime transitions: {e}")
        return []


@app.get("/api/precursor-frequencies")
def get_precursor_frequencies(regime: str | None = Query(None)):
    """Get frequency of precursor indicators before regime shifts"""
    try:
        from api.query_engine import QueryEngine
        qe = QueryEngine(os.environ.get("DATABASE_URL"))
        qe.connect()

        # Get regime transitions data
        cur = qe._postgres_conn.cursor()
        cur.execute("""
            SELECT
                CONCAT(shift_from_regime, ' → ', shift_to_regime) as transition,
                ROUND(100.0 * SUM(CASE WHEN vix_spike_detected THEN 1 ELSE 0 END) / COUNT(*), 1) as vix_spike_freq,
                ROUND(100.0 * SUM(CASE WHEN yield_inversion_detected THEN 1 ELSE 0 END) / COUNT(*), 1) as yield_inversion_freq,
                ROUND(100.0 * SUM(CASE WHEN fed_tightening THEN 1 ELSE 0 END) / COUNT(*), 1) as fed_tightening_freq,
                ROUND(100.0 * SUM(CASE WHEN (fed_rate_change_bps IS NOT NULL AND fed_rate_change_bps < 0) THEN 1 ELSE 0 END) / COUNT(*), 1) as fed_easing_freq
            FROM historical_regime_indicators
            GROUP BY shift_from_regime, shift_to_regime
            ORDER BY shift_from_regime, shift_to_regime
        """)

        rows = cur.fetchall()
        cur.close()
        qe.close()

        result = {}
        for row in rows:
            transition = row[0]
            result[transition] = {
                "vix_spike_freq": _safe_float(row[1]),
                "yield_inversion_freq": _safe_float(row[2]),
                "fed_tightening_freq": _safe_float(row[3]),
                "fed_easing_freq": _safe_float(row[4]),
            }

        return result if result else {}
    except Exception as e:
        logger.error(f"Failed to get precursor frequencies: {e}")
        return {}


@app.get("/api/outcomes/distribution")
def get_outcomes_distribution(regime: str | None = Query(None)):
    """Get outcome statistics for distribution charts"""
    try:
        tbl = get_table()
        df_ep = tbl.to_pandas()
    except Exception:
        raise HTTPException(503, "Memory not initialized")

    if regime is not None:
        df_ep = df_ep[df_ep["regime"] == regime.upper()]

    # Exclude sentinel 0.0 values (stored when 6m window hasn't closed yet)
    returns = [_safe_float(r) * 100 for r in df_ep["spy_return_6m_after"] if pd.notna(r) and abs(float(r)) > 1e-6]
    drawdowns = [_safe_float(d) * 100 for d in df_ep["max_drawdown"] if pd.notna(d)]

    if not returns:
        return {
            "returns": {"episodes": [], "mean": None, "median": None, "std": None, "min": None, "max": None},
            "drawdowns": {"episodes": [], "mean": None, "median": None, "std": None, "min": None, "max": None},
            "by_regime": {},
        }

    regime_stats = {}
    for r in df_ep["regime"].unique():
        regime_df = df_ep[df_ep["regime"] == r]
        regime_returns = [_safe_float(ret) * 100 for ret in regime_df["spy_return_6m_after"] if pd.notna(ret) and abs(float(ret)) > 1e-6]
        if regime_returns:
            regime_stats[r] = {
                "mean": float(np.mean(regime_returns)),
                "median": float(np.median(regime_returns)),
                "count": len(regime_returns),
            }

    return {
        "returns": {
            "episodes": sorted(returns),
            "mean": float(np.mean(returns)),
            "median": float(np.median(returns)),
            "std": float(np.std(returns)),
            "min": float(np.min(returns)),
            "max": float(np.max(returns)),
        },
        "drawdowns": {
            "episodes": sorted(drawdowns),
            "mean": float(np.mean(drawdowns)),
            "median": float(np.median(drawdowns)),
            "std": float(np.std(drawdowns)),
            "min": float(np.min(drawdowns)),
            "max": float(np.max(drawdowns)),
        },
        "by_regime": regime_stats,
    }




@app.get("/api/data-quality")
def get_data_quality():
    """Get data quality metrics for research credibility"""
    try:
        tbl = get_table()
        df_ep = tbl.to_pandas()

        if len(df_ep) == 0:
            return {
                "status": "empty",
                "total_episodes": 0,
                "date_range": {"start": None, "end": None},
                "completeness": {},
                "last_updated": datetime.now().isoformat(),
                "data_sources": ["FRED API", "Yahoo Finance", "CBOE"],
            }

        # Calculate metrics
        total_episodes = len(df_ep)
        start_date = str(df_ep["start_date"].min())
        end_date = str(df_ep["end_date"].max())

        # Calculate completeness for key columns
        key_columns = ["vix_level", "cpi", "fed_rate", "yield_spread", "unemployment",
                      "total_return", "max_drawdown", "spy_return_6m_after", "prose_summary"]
        completeness = {}
        for col in key_columns:
            if col in df_ep.columns:
                non_null = df_ep[col].notna().sum()
                pct = round((non_null / total_episodes) * 100, 1)
                completeness[col.replace("_", " ").title()] = pct

        # Calculate overall completeness
        overall_completeness = round(
            sum(completeness.values()) / len(completeness), 1
        ) if completeness else 100

        return {
            "status": "ready",
            "total_episodes": total_episodes,
            "date_range": {
                "start": start_date,
                "end": end_date,
                "years_covered": (pd.to_datetime(end_date) - pd.to_datetime(start_date)).days / 365.25,
            },
            "episodes_by_regime": df_ep["regime"].value_counts().to_dict(),
            "completeness": completeness,
            "overall_completeness_pct": overall_completeness,
            "last_updated": datetime.now().isoformat(),
            "data_sources": [
                "FRED API (Economic data: CPI, unemployment, Fed rates)",
                "Yahoo Finance (SPY prices, VIX)",
                "US Treasury (Yield curve)",
            ],
            "coverage": {
                "start_year": pd.to_datetime(start_date).year,
                "end_year": pd.to_datetime(end_date).year,
                "years_span": int(pd.to_datetime(end_date).year - pd.to_datetime(start_date).year + 1),
            }
        }

    except Exception as e:
        logger.error(f"Failed to get data quality: {e}")
        return {"status": "error", "message": str(e)}


@app.get("/api/health")
def health():
    return {"status": "ok", "episodes": count_episodes()}


@app.get("/api/eval/calibration")
def get_calibration():
    """
    Leave-one-out calibration evaluation on stored embeddings.
    No recomputation — uses vectors already in LanceDB.
    Metrics: directional accuracy + bootstrap 95% CI, Brier score, MAE, ECE, reliability bins.
    """
    try:
        # Use whitened vectors — same transform applied at retrieval time
        all_vecs, df, mean_vec, top_pcs = get_whitened_state()
    except Exception:
        raise HTTPException(503, "Memory not initialized")

    # spy_return_6m_after stored as 0.0 when originally None — filter by |val| > 1e-4
    valid_mask = df["spy_return_6m_after"].notna() & (df["spy_return_6m_after"].abs() > 1e-4)
    valid_idx = df.index[valid_mask].tolist()

    if len(valid_idx) < 10:
        return {"available": False, "reason": f"Only {len(valid_idx)} episodes with known 6-month outcomes (need ≥ 10)"}

    K = 5

    directional_correct: list[int] = []
    brier_scores: list[float] = []
    confidence_scores: list[float] = []
    predicted_returns: list[float] = []
    actual_returns: list[float] = []

    for i in valid_idx:
        query_vec = all_vecs[i]
        actual = float(df.at[i, "spy_return_6m_after"])

        sims = (all_vecs @ query_vec).astype(float)
        sims[i] = -1.0  # exclude self

        top_k_pos = np.argpartition(sims, -K)[-K:]
        top_k_pos = top_k_pos[np.argsort(sims[top_k_pos])[::-1]]

        neighbor_rets: list[float] = []
        neighbor_sims: list[float] = []
        for pos in top_k_pos:
            ret_val = float(df.at[int(pos), "spy_return_6m_after"])
            if abs(ret_val) > 1e-4:
                neighbor_rets.append(ret_val)
                neighbor_sims.append(max(float(sims[pos]), 0.0))

        if not neighbor_rets:
            continue

        weights = np.array(neighbor_sims)
        if weights.sum() < 1e-8:
            weights = np.ones(len(weights))
        predicted = float(np.average(neighbor_rets, weights=weights))
        p_up = sum(1 for r in neighbor_rets if r > 0) / len(neighbor_rets)
        confidence = float(np.mean(sims[top_k_pos]))

        actual_up = 1 if actual > 0 else 0
        pred_up = 1 if predicted > 0 else 0

        directional_correct.append(int(pred_up == actual_up))
        brier_scores.append((p_up - actual_up) ** 2)
        confidence_scores.append(confidence)
        predicted_returns.append(predicted)
        actual_returns.append(actual)

    n = len(directional_correct)
    if n == 0:
        return {"available": False, "reason": "No valid leave-one-out comparisons found"}

    dir_acc = float(np.mean(directional_correct))

    rng = np.random.default_rng(42)
    boot_accs = [
        float(np.mean(rng.choice(directional_correct, size=n, replace=True)))
        for _ in range(2000)
    ]
    ci_lo = float(np.percentile(boot_accs, 2.5))
    ci_hi = float(np.percentile(boot_accs, 97.5))

    brier = float(np.mean(brier_scores))
    mae_pct = float(np.mean(np.abs(np.array(predicted_returns) - np.array(actual_returns)))) * 100

    n_bins = 5
    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    reliability_bins = []
    for lo, hi in zip(bin_edges[:-1], bin_edges[1:]):
        idxs = [j for j, c in enumerate(confidence_scores) if lo <= c < hi]
        if not idxs:
            continue
        mean_conf = float(np.mean([confidence_scores[j] for j in idxs]))
        mean_acc = float(np.mean([directional_correct[j] for j in idxs]))
        reliability_bins.append({
            "bin_center": round(float((lo + hi) / 2), 2),
            "mean_confidence": round(mean_conf, 3),
            "mean_accuracy": round(mean_acc, 3),
            "perfect": round(float((lo + hi) / 2), 2),
            "count": len(idxs),
        })

    ece = float(
        sum(b["count"] * abs(b["mean_accuracy"] - b["mean_confidence"]) for b in reliability_bins) / n
    )

    return {
        "available": True,
        "n": n,
        "k": K,
        "directional_accuracy": round(dir_acc, 4),
        "ci_lo": round(ci_lo, 4),
        "ci_hi": round(ci_hi, 4),
        "brier_score": round(brier, 4),
        "mae_pct": round(mae_pct, 2),
        "ece": round(ece, 4),
        "reliability_bins": reliability_bins,
        "note": f"Leave-one-out on {n} episodes with known 6-month outcomes. Bootstrap 95% CI (2,000 samples, seed=42).",
    }


@app.get("/api/eval/compression")
def get_compression():
    """
    PCA compression ablation on the stored 519-dim hybrid embeddings
    (512-dim Matryoshka text-embedding-3-small + 7 structural features).
    Measures Recall@K vs full system and directional accuracy at each compressed dimension.
    """
    from sklearn.decomposition import PCA
    import time

    try:
        tbl = get_table()
        df = tbl.to_pandas().reset_index(drop=True)
    except Exception:
        raise HTTPException(503, "Memory not initialized")

    N = len(df)
    if N < 10:
        return {"available": False, "reason": "Not enough episodes in memory"}

    valid_mask = df["spy_return_6m_after"].notna() & (df["spy_return_6m_after"].abs() > 1e-4)
    valid_idx = df.index[valid_mask].tolist()

    all_vecs = np.stack(df["vector"].values).astype(np.float32)
    full_dim = all_vecs.shape[1]
    K = 5

    # Precompute full-system top-K for each valid episode (ground truth reference for Recall@K)
    full_top_k: dict[int, set] = {}
    for i in valid_idx:
        sims = (all_vecs @ all_vecs[i]).astype(float)
        sims[i] = -1.0
        full_top_k[i] = set(int(x) for x in np.argpartition(sims, -K)[-K:])

    # PCA max n_components = min(N-1, features); for N=72 that is 71
    max_pca_dim = min(N - 1, full_dim)
    target_dims = [d for d in [64, 32, 16, 8] if d <= max_pca_dim]
    all_dims = [full_dim] + target_dims

    results = []
    for dim in all_dims:
        if dim >= full_dim:
            compressed = all_vecs.copy()
        else:
            pca = PCA(n_components=dim, random_state=42)
            compressed = pca.fit_transform(all_vecs).astype(np.float32)
            norms = np.linalg.norm(compressed, axis=1, keepdims=True)
            compressed /= np.where(norms < 1e-8, 1.0, norms)

        # Measure single-scan latency (N dot products)
        query = compressed[0].copy()
        t0 = time.perf_counter()
        for _ in range(500):
            _ = compressed @ query
        latency_us = (time.perf_counter() - t0) / 500 * 1e6

        recalls: list[float] = []
        dir_correct: list[int] = []

        for i in valid_idx:
            sims_comp = (compressed @ compressed[i]).astype(float)
            sims_comp[i] = -1.0
            comp_top_idx = np.argpartition(sims_comp, -K)[-K:]
            comp_top = set(int(x) for x in comp_top_idx)

            recalls.append(len(full_top_k[i] & comp_top) / K)

            neighbor_rets = []
            neighbor_sims = []
            for pos in comp_top:
                ret_val = float(df.at[pos, "spy_return_6m_after"])
                if abs(ret_val) > 1e-4:
                    neighbor_rets.append(ret_val)
                    neighbor_sims.append(max(float(sims_comp[pos]), 0.0))

            if neighbor_rets:
                weights = np.array(neighbor_sims)
                if weights.sum() < 1e-8:
                    weights = np.ones(len(weights))
                predicted = float(np.average(neighbor_rets, weights=weights))
                actual = float(df.at[i, "spy_return_6m_after"])
                dir_correct.append(int((predicted > 0) == (actual > 0)))

        results.append({
            "dim": dim,
            "recall_at_k": round(float(np.mean(recalls)), 4),
            "directional_accuracy": round(float(np.mean(dir_correct)), 4) if dir_correct else None,
            "storage_kb": round(dim * 4 * N / 1024, 1),
            "latency_us": round(latency_us, 1),
        })

    return {
        "available": True,
        "k": K,
        "n_episodes": N,
        "n_with_outcomes": len(valid_idx),
        "full_dim": full_dim,
        "results": results,
        "note": f"Recall@{K} vs full {full_dim}-dim system. PCA on stored normalized embeddings. Latency = single N-episode cosine scan.",
    }

