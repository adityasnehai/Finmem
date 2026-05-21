import os
import uuid
import numpy as np
import pandas as pd
import ruptures as rpt
from openai import OpenAI
from rich.console import Console
from rich.progress import track
from finmem.data.schemas import Episode
from finmem.memory.regime import predict_sequence_regime

console = Console()

def _get_client() -> OpenAI:
    return OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))


def _compute_forward_returns(df: pd.DataFrame, end_idx: int) -> dict:
    close = df["spy_close"]
    base  = close.iloc[end_idx]
    out   = {}
    for days, key in [(21, "spy_return_1m_after"), (63, "spy_return_3m_after"), (126, "spy_return_6m_after")]:
        target_idx = end_idx + days
        if target_idx < len(close):
            out[key] = round((close.iloc[target_idx] - base) / base, 4)
        else:
            out[key] = None
    return out


def _summarize_episode(ep: dict) -> str:
    """Generate prose summary via GPT-4o-mini; falls back to template if quota exceeded."""
    prompt = (
        f"Write a 2-sentence factual summary of this market episode for a financial analyst. "
        f"Date range: {ep['start_date']} to {ep['end_date']}. "
        f"Regime: {ep['regime']}. "
        f"SPY total return: {ep['total_return']:.1%}. "
        f"Max drawdown: {ep['max_drawdown']:.1%}. "
        f"VIX: {ep['vix_level']:.1f}. "
        f"CPI: {ep['cpi']:.1f}%. "
        f"Fed rate: {ep['fed_rate']:.2f}%. "
        f"Yield curve (10Y-2Y): {ep['yield_spread']:.2f}%. "
        f"Unemployment: {ep['unemployment']:.1f}%. "
        f"SPY 6m after: {ep.get('spy_return_6m_after', 'N/A')}. "
        f"Be factual and concise. No predictions, no opinions."
    )
    try:
        resp = _get_client().chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=120,
            temperature=0.2,
        )
        return resp.choices[0].message.content.strip()
    except Exception:
        fwd = ep.get("spy_return_6m_after")
        fwd_str = f"SPY returned {fwd:.1%} in the following 6 months." if fwd is not None else ""
        return (
            f"{ep['regime']} episode from {ep['start_date']} to {ep['end_date']} "
            f"({ep['duration_days']} days). SPY returned {ep['total_return']:.1%} with max drawdown "
            f"{ep['max_drawdown']:.1%}; VIX averaged {ep['vix_level']:.1f}, CPI {ep['cpi']:.1f}%, "
            f"Fed funds {ep['fed_rate']:.2f}%. {fwd_str}"
        )


def _select_pen(algo: rpt.Pelt, n_days: int, target_lo: int = 50, target_hi: int = 100) -> float:
    """
    Target-count pen selection: find the smallest penalty that keeps episode
    count in [target_lo, target_hi]. For 8000+ trading days, 50-100 episodes
    means one structural change every 3-8 months — semantically meaningful.
    """
    for pen in [1, 2, 3, 5, 8, 13, 21, 34]:
        n = len(algo.predict(pen=pen)) - 1
        if target_lo <= n <= target_hi:
            return pen
    # fallback: pen=3 reliably gives ~70 episodes on 8000-day datasets
    return 3


def build_episodes(df: pd.DataFrame, min_size: int = 15) -> list[Episode]:
    signal = df[["spy_return_1d", "rolling_vol_21d"]].fillna(0).values

    algo = rpt.Pelt(model="rbf", min_size=min_size).fit(signal)

    pen = _select_pen(algo, len(signal))
    n_bkps = len(algo.predict(pen=pen)) - 1
    console.print(f"[cyan]PELT pen={pen} → {n_bkps} breakpoints[/cyan]")
    bkps = algo.predict(pen=pen)

    boundaries = [0] + bkps
    episodes: list[Episode] = []

    console.print(f"[cyan]Building {len(boundaries)-1} episodes...[/cyan]")

    for i in track(range(len(boundaries) - 1), description="Building episodes"):
        s_idx = boundaries[i]
        e_idx = boundaries[i + 1] - 1
        if e_idx <= s_idx:
            continue

        chunk = df.iloc[s_idx:e_idx + 1]
        if len(chunk) < min_size:
            continue

        close     = chunk["spy_close"]
        returns   = chunk["spy_return_1d"].dropna()
        drawdowns = (close / close.cummax() - 1)

        ep_dict = {
            "start_date":       chunk.index[0].date(),
            "end_date":         chunk.index[-1].date(),
            "duration_days":    len(chunk),
            "avg_daily_return": float(returns.mean()),
            "total_return":     float((close.iloc[-1] - close.iloc[0]) / close.iloc[0]),
            "max_drawdown":     float(drawdowns.min()),
            "rolling_vol":      float(chunk["rolling_vol_21d"].mean()),
            "vix_level":        float(chunk["vix"].mean()),
            "cpi":              float(chunk["cpi"].iloc[0]),
            "fed_rate":         float(chunk["fed_rate"].iloc[0]),
            "yield_spread":     float(chunk["yield_spread"].iloc[0]),
            "unemployment":     float(chunk["unemployment"].iloc[0]),
        }
        ep_dict["regime"] = predict_sequence_regime(df, chunk.index[0], chunk.index[-1])
        ep_dict.update(_compute_forward_returns(df, e_idx))

        ep_dict["prose_summary"] = _summarize_episode(ep_dict)
        ep_dict["id"] = str(uuid.uuid4())

        episodes.append(Episode(**ep_dict))

    console.print(f"[green]Built {len(episodes)} episodes[/green]")
    return episodes
