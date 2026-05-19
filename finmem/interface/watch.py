import time
import schedule
from datetime import datetime
from rich.console import Console
from finmem.data.loaders import load_all
from finmem.data.schemas import MarketState
from finmem.memory.retrieval import retrieve
import pandas as pd

console = Console()
ALERT_THRESHOLD = 0.80


def _latest_state(df: pd.DataFrame) -> MarketState:
    row = df.iloc[-1]
    return MarketState(
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


def check_alerts(threshold: float = ALERT_THRESHOLD) -> None:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M")
    console.print(f"[dim][{ts}] Checking market state...[/dim]")

    df     = load_all()
    state  = _latest_state(df)
    result = retrieve(state)

    if not result.retrieved:
        return

    top = result.retrieved[0]
    if top.final_score >= threshold:
        ep = top.episode
        console.print(
            f"\n[bold yellow]⚠  ALERT  [{ts}][/bold yellow]\n"
            f"  Current state [bold]{top.final_score:.0%}[/bold] similar to [cyan]{ep.start_date}[/cyan]\n"
            f"  Regime: {ep.regime}\n"
            f"  Matched: VIX {ep.vix_level:.1f} | CPI {ep.cpi:.1f}% | Fed {ep.fed_rate:.2f}% | Curve {ep.yield_spread:+.2f}%\n"
            f"  SPY 6m after that episode: "
            f"[{'red' if ep.spy_return_6m_after and ep.spy_return_6m_after < 0 else 'green'}]"
            f"{ep.spy_return_6m_after:+.1%}[/]\n"
            f"  → Run: [bold]finmem chat[/bold] then [bold]/compare {ep.start_date}[/bold]\n"
        )
    else:
        console.print(f"[dim]  Top similarity: {top.final_score:.2%} — below threshold {threshold:.0%}. No alert.[/dim]")


def run_watch(threshold: float = ALERT_THRESHOLD, interval_hours: int = 1) -> None:
    console.print(
        f"[bold green]FINMEM WATCH[/bold green] [dim]monitoring every {interval_hours}h · threshold {threshold:.0%}[/dim]\n"
        f"[dim]Press Ctrl+C to stop[/dim]\n"
    )
    check_alerts(threshold)
    schedule.every(interval_hours).hours.do(check_alerts, threshold=threshold)
    try:
        while True:
            schedule.run_pending()
            time.sleep(60)
    except KeyboardInterrupt:
        console.print("\n[dim]Watch stopped.[/dim]")
