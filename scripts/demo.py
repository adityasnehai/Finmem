"""Curated 5-query showcase — runs without interactive input."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from finmem.data.loaders import load_all
from finmem.data.schemas import MarketState
from finmem.memory.retrieval import retrieve
from finmem.reasoning.engine import reason
from finmem.memory.store import count_episodes
from rich.console import Console
from rich.rule import Rule

console = Console()

DEMO_QUERIES = [
    "What happened after yield curve inversions similar to today?",
    "Show me what followed periods with both high CPI and Fed hiking.",
    "How does today compare to pre-2008 conditions?",
    "What are the similarities and differences vs the 2015 China shock?",
    "Based on closest historical analogs, what is the range of 6-month outcomes?",
]


def main():
    console.print(Rule("[bold green]FINMEM DEMO[/bold green]"))
    console.print(f"[dim]{count_episodes()} episodes indexed[/dim]\n")

    df    = load_all()
    row   = df.iloc[-1]
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

    console.print(
        f"[bold]Current state:[/bold] SPY ${state.spy_price:.2f}  "
        f"VIX {state.vix:.1f}  CPI {state.cpi:.1f}%  "
        f"Fed {state.fed_rate:.2f}%  Curve {state.yield_spread:+.2f}%\n"
    )

    for i, q in enumerate(DEMO_QUERIES, 1):
        console.print(Rule(f"Query {i}/{len(DEMO_QUERIES)}"))
        console.print(f"[bold cyan]Q:[/bold cyan] {q}\n")
        result = retrieve(state)
        console.print(
            f"[dim]Retrieved {len(result.retrieved)} episodes · "
            f"confidence {result.confidence:.0%} · {result.latency_ms:.0f}ms[/dim]"
        )
        console.print(f"\n[bold green]FINMEM:[/bold green] ", end="")
        reason(result, q, stream=True)
        console.print()


if __name__ == "__main__":
    main()
