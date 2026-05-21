from datetime import date
from rich.console import Console
from rich.layout import Layout
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.columns import Columns
from rich import box
from finmem.data.schemas import MarketState, QueryResult
from finmem.memory.store import count_episodes, episode_date_range
from finmem.memory.regime import predict_state_regime

console = Console()


def _market_panel(state: MarketState) -> Panel:
    grid = Table.grid(padding=(0, 2))
    grid.add_column(style="dim", width=14)
    grid.add_column(width=14)
    grid.add_column(style="dim", width=14)
    grid.add_column(width=14)

    def _color_val(val: float, thresholds: tuple, labels: tuple, colors: tuple) -> Text:
        for t, label, color in zip(thresholds, labels, colors):
            if val >= t:
                return Text(label, style=color)
        return Text(labels[-1], style=colors[-1])

    spy_color  = "red" if state.spy_return_5d < 0 else "green"
    vix_color  = "red" if state.vix > 25 else ("yellow" if state.vix > 18 else "green")
    crv_color  = "red" if state.yield_spread < 0 else "green"

    regime = predict_state_regime(state)

    grid.add_row(
        "SPY",     Text(f"${state.spy_price:.2f}  {state.spy_return_5d:+.1%} 5d", style=spy_color),
        "VIX",     Text(f"{state.vix:.1f}  {'ELEVATED' if state.vix > 25 else 'NORMAL'}", style=vix_color),
    )
    grid.add_row(
        "CPI",     Text(f"{state.cpi:.1f}%  YoY", style="yellow" if state.cpi > 3 else "white"),
        "FED",     Text(f"{state.fed_rate:.2f}%  HOLDING"),
    )
    grid.add_row(
        "CURVE",   Text(f"{state.yield_spread:+.2f}%  {'INVERTED' if state.yield_spread < 0 else 'NORMAL'}", style=crv_color),
        "UNEMP",   Text(f"{state.unemployment:.1f}%"),
    )
    grid.add_row("", Text(""), "", Text(""))
    grid.add_row(
        "REGIME",  Text(regime, style="bold yellow"),
        "DATE",    Text(str(date.today()), style="dim"),
    )
    return Panel(grid, title="[bold]MARKET STATE[/bold]", border_style="dim", box=box.SIMPLE_HEAD)




def _episodes_panel(result: QueryResult) -> Panel:
    tbl = Table(box=box.SIMPLE_HEAD, show_header=True, header_style="dim", expand=True)
    tbl.add_column("#",         width=3,  style="dim")
    tbl.add_column("EPISODE",   width=12)
    tbl.add_column("REGIME",    width=20, style="dim")
    tbl.add_column("SIM",       width=8)
    tbl.add_column("SPY 6M",    width=12)

    for i, r in enumerate(result.retrieved, 1):
        ep  = r.episode
        bar = "█" * int(r.final_score * 10) + "░" * (10 - int(r.final_score * 10))
        sim = Text(f"{bar} {r.final_score:.0%}", style="green")

        outcome_str = f"{ep.spy_return_6m_after:+.1%}" if ep.spy_return_6m_after else "N/A"
        outcome_col = "red" if ep.spy_return_6m_after and ep.spy_return_6m_after < 0 else "green"

        tbl.add_row(
            str(i),
            f"{ep.start_date}",
            ep.regime,
            sim,
            Text(outcome_str, style=outcome_col),
        )
    return Panel(tbl, title="[bold]MEMORY MATCHES[/bold]", border_style="dim", box=box.SIMPLE_HEAD)


def _macro_panel(state: MarketState) -> Panel:
    tbl = Table(box=box.SIMPLE_HEAD, show_header=False, expand=True)
    tbl.add_column("SERIES",  style="dim", width=16)
    tbl.add_column("VALUE",   width=10)
    tbl.add_column("CODE",    style="dim", width=12)

    rows = [
        ("FED FUNDS RATE", f"{state.fed_rate:.2f}%",    "FEDFUNDS"),
        ("CPI YoY",        f"{state.cpi:.1f}%",          "CPIAUCSL"),
        ("10Y–2Y SPREAD",  f"{state.yield_spread:+.2f}%","T10Y2Y"),
        ("UNEMPLOYMENT",   f"{state.unemployment:.1f}%",  "UNRATE"),
    ]
    for series, val, code in rows:
        color = "red" if "-" in val and series != "FED FUNDS RATE" else "white"
        tbl.add_row(series, Text(val, style=color), code)

    n    = count_episodes()
    s, e = episode_date_range()
    tbl.add_row("", "", "")
    tbl.add_row("EPISODES", str(n),  "indexed")
    tbl.add_row("COVERAGE", f"{s[:7]} →",  f"{e[:7]}")
    return Panel(tbl, title="[bold]MACRO · FRED[/bold]", border_style="dim", box=box.SIMPLE_HEAD)


def _search_panel(rows: list[dict]) -> Panel:
    tbl = Table(box=box.SIMPLE_HEAD, show_header=True, header_style="dim", expand=True)
    tbl.add_column("#",       width=4,  style="dim")
    tbl.add_column("EPISODE", width=12)
    tbl.add_column("CPI",     width=8)
    tbl.add_column("FED",     width=8)
    tbl.add_column("SPY 6M",  width=10)

    for i, r in enumerate(rows, 1):
        outcome = r.get("spy_return_6m_after", None)
        out_str = f"{outcome:+.1%}" if outcome else "N/A"
        out_col = "red" if outcome and outcome < 0 else "green"
        tbl.add_row(
            str(i),
            r["start_date"],
            f"{r['cpi']:.1f}%",
            f"{r['fed_rate']:.2f}%",
            Text(out_str, style=out_col),
        )
    return Panel(tbl, title="[bold]EPISODE SEARCH[/bold]", border_style="dim", box=box.SIMPLE_HEAD)


def _ablation_panel(results: dict | None = None) -> Panel:
    tbl = Table(box=box.SIMPLE_HEAD, show_header=True, header_style="dim", expand=True)
    tbl.add_column("SYSTEM",       width=16)
    tbl.add_column("QUALITY/3",    width=10)
    tbl.add_column("GROUNDED",     width=10)
    tbl.add_column("LAT P50",      width=10)
    tbl.add_column("COST/Q",       width=10)

    if results:
        for row in results.get("rows", []):
            tbl.add_row(*[str(v) for v in row])
    else:
        tbl.add_row("FinMem RAG",    "—", "—", "—", "—")
        tbl.add_row("Fixed 90d Win", "—", "—", "—", "—")
        tbl.add_row("Prompt Only",   "—", "—", "—", "—")
        tbl.caption = "Run [bold]make eval[/bold] to populate"

    return Panel(tbl, title="[bold]ABLATION RESULTS[/bold]", border_style="dim", box=box.SIMPLE_HEAD)


def render_dashboard(
    state: MarketState,
    result: QueryResult,
    search_rows: list[dict] | None = None,
    ablation: dict | None = None,
    alert_msg: str | None = None,
) -> None:
    console.clear()
    console.rule(
        f"[bold green]FINMEM[/bold green]  [dim]Financial Episodic Memory[/dim]  "
        f"[dim]{count_episodes()} episodes · {date.today()}[/dim]"
    )

    if alert_msg:
        console.print(Panel(
            Text(f"⚠  {alert_msg}", style="bold yellow"),
            border_style="yellow",
            box=box.SIMPLE_HEAD,
        ))

    console.print(Columns([_market_panel(state), _episodes_panel(result)], equal=True))
    console.print(Columns([_macro_panel(state), _search_panel(search_rows or [])], equal=True))
    console.print(_ablation_panel(ablation))
