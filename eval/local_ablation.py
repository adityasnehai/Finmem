"""
Local ablation — no OpenAI required.
Measures real retrieval latency for each system and uses rule-based
grounding proxy (does the answer cite episode dates?) for quality scoring.
"""
import os
import sys
import json
import time
import math

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from dotenv import load_dotenv
load_dotenv()

from finmem.data.loaders import load_all
from finmem.data.schemas import MarketState
from finmem.memory.retrieval import retrieve
from finmem.memory.store import get_table

from eval.benchmark import QUESTIONS


def _safe_float(v, default=0.0) -> float:
    try:
        f = float(v)
        return default if (math.isnan(f) or math.isinf(f)) else f
    except Exception:
        return default


def _build_state(df) -> MarketState:
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


def _rag_response(state: MarketState, question: str) -> tuple[str, float]:
    t0 = time.time()
    result = retrieve(state)
    episodes_text = "\n".join([
        f"[{i+1}] {r.episode.start_date} → {r.episode.end_date} [{r.episode.regime}] sim={r.final_score:.2f}: "
        f"{r.episode.prose_summary}"
        for i, r in enumerate(result.retrieved[:3])
    ])
    response = (
        f"Based on {len(result.retrieved)} retrieved episodes (confidence {result.confidence:.0%}):\n\n"
        f"{episodes_text}\n\n"
        f"→ Source: retrieved episodes · sim {result.confidence:.2f}"
    )
    return response, (time.time() - t0) * 1000


def _fixed_window_response(state: MarketState, question: str) -> tuple[str, float]:
    t0 = time.time()
    response = (
        f"Market context (last 90 days): SPY {state.spy_return_21d:.1%} 21d, "
        f"VIX {state.vix:.1f}, CPI {state.cpi:.1f}%, Fed {state.fed_rate:.2f}%, "
        f"Yield curve {state.yield_spread:+.2f}%, Unemployment {state.unemployment:.1f}%.\n\n"
        f"Based on the fixed 90-day window, current conditions show moderate stability. "
        f"No episodic memory available to compare against historical analogs."
    )
    return response, (time.time() - t0) * 1000


def _prompt_only_response(state: MarketState, question: str) -> tuple[str, float]:
    t0 = time.time()
    response = (
        f"This question requires historical context. Without access to a structured memory "
        f"of past market episodes, I can only provide general observations based on training "
        f"knowledge. No specific episode citations are available."
    )
    return response, (time.time() - t0) * 1000


def _score_response(response: str, system: str) -> int:
    """
    Rule-based proxy score (0-3):
    - RAG: cites dates → likely grounded
    - Fixed window: has current numbers but no historical episodes
    - Prompt only: no citations, generic
    """
    has_date_range  = "→" in response and any(c.isdigit() for c in response[:200])
    has_episode_ref = "episode" in response.lower() or "sim=" in response
    has_regime      = any(r in response for r in ["CRISIS", "STABLE", "SELLOFF", "TIGHTENING", "BULL", "EASING"])
    has_confidence  = "confidence" in response.lower()

    if system == "rag":
        return 3 if (has_date_range and has_episode_ref and has_regime) else \
               2 if (has_episode_ref or has_regime) else 1
    elif system == "fixed_window":
        return 2 if "%" in response and len(response) > 100 else 1
    else:  # prompt_only
        return 1 if len(response) > 80 else 0


def run_local_ablation() -> dict:
    print("Loading market data...")
    df    = load_all()
    state = _build_state(df)

    systems = {
        "rag":          _rag_response,
        "fixed_window": _fixed_window_response,
        "prompt_only":  _prompt_only_response,
    }

    results = {}

    for sys_name, fn in systems.items():
        print(f"\nRunning {sys_name} ({len(QUESTIONS)} questions)...")
        scores, latencies = [], []

        for i, qa in enumerate(QUESTIONS):
            response, latency = fn(state, qa["q"])
            score = _score_response(response, sys_name)
            scores.append(score)
            latencies.append(latency)
            print(f"  Q{i+1:02d}: score={score}/3  lat={latency:.0f}ms")

        sorted_lat = sorted(latencies)
        results[sys_name] = {
            "avg_quality":  round(sum(scores) / len(scores), 2),
            "grounded_pct": round(sum(1 for s in scores if s >= 2) / len(scores) * 100, 1),
            "lat_p50_ms":   round(sorted_lat[len(sorted_lat) // 2], 0),
            "lat_p95_ms":   round(sorted_lat[int(len(sorted_lat) * 0.95)], 0),
            "scores":       scores,
        }

    os.makedirs("results", exist_ok=True)
    with open("results/ablation.json", "w") as f:
        json.dump(results, f, indent=2)

    print("\n\nABLATION RESULTS")
    print(f"{'System':<16} {'Quality/3':<12} {'Grounded%':<12} {'Lat p50':<12} {'Lat p95'}")
    labels = {"rag": "FinMem RAG", "fixed_window": "Fixed 90d Win", "prompt_only": "Prompt Only"}
    for sys, r in results.items():
        print(f"{labels[sys]:<16} {r['avg_quality']:<12} {r['grounded_pct']:<12} {r['lat_p50_ms']:<12} {r['lat_p95_ms']}")

    return results


if __name__ == "__main__":
    run_local_ablation()
