"""Latency profiling — p50/p95 across 50 queries."""
import time
import statistics
from finmem.data.loaders import load_all
from finmem.data.schemas import MarketState
from finmem.memory.retrieval import retrieve
from rich.console import Console
from rich.table import Table
from rich import box

console = Console()

SAMPLE_QUERIES = [
    "What happened after yield curve inversions?",
    "Show me crisis episodes with VIX above 40.",
    "What did the Fed do during high CPI periods?",
    "Find episodes similar to 2008.",
    "What followed Fed rate pauses historically?",
]


def profile_latency(n_runs: int = 50) -> dict:
    df  = load_all()
    row = df.iloc[-1]
    state = MarketState(
        date=row.name.date(),
        spy_price=float(row["spy_close"]),
        spy_return_1d=float(row["spy_return_1d"]),
        spy_return_5d=float(row["spy_return_5d"]),
        spy_return_21d=float(row["spy_return_21d"]),
        vix=float(row["vix"]),
        cpi=float(row["cpi"]),
        fed_rate=float(row["fed_rate"]),
        yield_spread=float(row["yield_spread"]),
        unemployment=float(row["unemployment"]),
        rolling_vol_21d=float(row["rolling_vol_21d"]),
    )

    retrieval_times = []
    console.print(f"[cyan]Profiling retrieval latency ({n_runs} runs)...[/cyan]")
    for i in range(n_runs):
        t0     = time.perf_counter()
        result = retrieve(state)
        elapsed = (time.perf_counter() - t0) * 1000
        retrieval_times.append(elapsed)
        if (i + 1) % 10 == 0:
            console.print(f"  {i+1}/{n_runs} done")

    sorted_r = sorted(retrieval_times)
    stats = {
        "retrieval_p50": round(sorted_r[n_runs // 2], 1),
        "retrieval_p95": round(sorted_r[int(n_runs * 0.95)], 1),
        "retrieval_mean": round(statistics.mean(retrieval_times), 1),
        "retrieval_min":  round(min(retrieval_times), 1),
        "retrieval_max":  round(max(retrieval_times), 1),
    }

    tbl = Table(box=box.SIMPLE_HEAD, title="LATENCY PROFILE (retrieval only)")
    tbl.add_column("Metric", style="dim")
    tbl.add_column("ms", justify="right")
    for k, v in stats.items():
        tbl.add_row(k.replace("retrieval_", ""), str(v))
    console.print(tbl)
    console.print("[dim]Note: add ~1500ms for GPT-4o API call (streaming, first token ~300ms)[/dim]")
    return stats


if __name__ == "__main__":
    profile_latency()
