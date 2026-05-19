import os
import re
import typer
import pandas as pd
from datetime import date
from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich import box
from finmem.data.loaders import load_all
from finmem.data.schemas import MarketState
from finmem.memory.retrieval import retrieve
from finmem.memory.store import get_table, count_episodes
from finmem.reasoning.engine import reason
from finmem.interface.dashboard import render_dashboard

app     = Console()
console = Console()
cli     = typer.Typer(help="FinMem — Financial Episodic Memory")

_df_cache: pd.DataFrame | None = None


def _get_df() -> pd.DataFrame:
    global _df_cache
    if _df_cache is None:
        _df_cache = load_all()
    return _df_cache


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


def _state_at(df: pd.DataFrame, target_date: str) -> MarketState | None:
    try:
        idx = pd.Timestamp(target_date)
        if idx not in df.index:
            idx = df.index[df.index.searchsorted(idx)]
        row = df.loc[idx]
        return MarketState(
            date=idx.date(),
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
    except Exception:
        return None


def _handle_command(cmd: str, df: pd.DataFrame, state: MarketState) -> bool:
    cmd = cmd.strip().lower()

    if cmd == "/today":
        result = retrieve(state)
        render_dashboard(state, result)
        return True

    if cmd.startswith("/compare "):
        target = cmd.split("/compare ", 1)[1].strip()
        target_state = _state_at(df, target)
        if not target_state:
            console.print(f"[red]Date not found: {target}[/red]")
            return True
        result_now    = retrieve(state)
        result_target = retrieve(target_state)
        console.print(Panel(
            f"[bold]TODAY ({state.date})[/bold]  vs  [bold]{target_state.date}[/bold]\n\n"
            f"SPY:   {state.spy_price:.2f}  vs  {target_state.spy_price:.2f}\n"
            f"VIX:   {state.vix:.1f}  vs  {target_state.vix:.1f}\n"
            f"CPI:   {state.cpi:.1f}%  vs  {target_state.cpi:.1f}%\n"
            f"Fed:   {state.fed_rate:.2f}%  vs  {target_state.fed_rate:.2f}%\n"
            f"Curve: {state.yield_spread:+.2f}%  vs  {target_state.yield_spread:+.2f}%\n\n"
            f"Top match to TODAY:   {result_now.retrieved[0].episode.start_date}  ({result_now.retrieved[0].final_score:.0%})\n"
            f"Top match to {target}: {result_target.retrieved[0].episode.start_date}  ({result_target.retrieved[0].final_score:.0%})",
            title="[bold]COMPARISON[/bold]",
            border_style="dim",
            box=box.SIMPLE_HEAD,
        ))
        return True

    if cmd.startswith("/episodes "):
        query_text = cmd.split("/episodes ", 1)[1].strip()
        table = get_table()
        df_ep = table.to_pandas()
        filtered = df_ep
        if "cpi" in query_text:
            match = re.search(r"cpi\s*[><=]+\s*([\d.]+)", query_text)
            if match:
                thresh = float(match.group(1))
                op     = re.search(r"[><=]+", query_text.split("cpi")[1]).group()
                if ">" in op:   filtered = filtered[filtered["cpi"] > thresh]
                elif "<" in op: filtered = filtered[filtered["cpi"] < thresh]
        if "fed" in query_text or "hiking" in query_text:
            filtered = filtered[filtered["fed_rate"] > filtered["fed_rate"].shift(1).fillna(0)]
        if "vix" in query_text:
            match = re.search(r"vix\s*[><=]+\s*([\d.]+)", query_text)
            if match:
                thresh = float(match.group(1))
                filtered = filtered[filtered["vix_level"] > thresh]
        filtered = filtered.head(10)
        console.print(f"\n[dim]Found {len(filtered)} episodes matching: {query_text}[/dim]\n")
        for _, row in filtered.iterrows():
            out = f"{row['spy_return_6m_after']:+.1%}" if row["spy_return_6m_after"] else "N/A"
            console.print(
                f"  [cyan]{row['start_date']}[/cyan] → {row['end_date']}  "
                f"CPI {row['cpi']:.1f}%  Fed {row['fed_rate']:.2f}%  "
                f"VIX {row['vix_level']:.1f}  SPY 6m: [{'red' if '-' in out else 'green'}]{out}[/]"
            )
        return True

    if cmd == "/memory":
        n = count_episodes()
        table = get_table()
        df_ep = table.to_pandas()
        console.print(
            f"\n[bold]Memory Stats[/bold]\n"
            f"  Episodes indexed: [green]{n}[/green]\n"
            f"  Coverage: {df_ep['start_date'].min()} → {df_ep['end_date'].max()}\n"
            f"  Regimes: {', '.join(df_ep['regime'].value_counts().index.tolist())}\n"
        )
        return True

    if cmd == "/explain":
        console.print(
            "\n[dim]Last retrieval breakdown:[/dim]\n"
            "  base_sim  =  cosine similarity (structured + text hybrid embedding)\n"
            "  +0.10     =  regime label match bonus\n"
            "  -0.05     =  recency penalty (episodes > 15yr old)\n"
            "  confidence threshold: HIGH ≥ 0.65 | UNCERTAIN 0.45–0.65 | NO ANALOG < 0.45\n"
        )
        return True

    if cmd in ("/help", "/?"):
        console.print(
            "\n[bold]Commands:[/bold]\n"
            "  [cyan]/today[/cyan]             Current market state + top matches\n"
            "  [cyan]/compare[/cyan] [date]    Side-by-side: today vs historical date\n"
            "  [cyan]/episodes[/cyan] [query]  Filter episodes (e.g. cpi > 4 AND vix > 25)\n"
            "  [cyan]/memory[/cyan]            Memory stats\n"
            "  [cyan]/explain[/cyan]           How retrieval scoring works\n"
            "  [cyan]/exit[/cyan]              Quit\n"
        )
        return True

    return False


@cli.command()
def chat():
    """Start interactive episodic memory chat."""
    console.print("\n[bold green]FINMEM[/bold green] [dim]Financial Episodic Memory[/dim]")
    console.print(f"[dim]{count_episodes()} episodes indexed · type /help for commands · /exit to quit[/dim]\n")

    df    = _get_df()
    state = _latest_state(df)
    result = retrieve(state)
    history: list[dict] = []

    while True:
        try:
            user_input = console.input("[bold green]›[/bold green] ").strip()
        except (EOFError, KeyboardInterrupt):
            break

        if not user_input:
            continue

        if user_input.lower() in ("/exit", "/quit", "exit", "quit"):
            break

        if user_input.startswith("/"):
            _handle_command(user_input, df, state)
            continue

        result = retrieve(state)
        console.print(f"\n[dim]Retrieving... (confidence: {result.confidence:.0%} · {result.latency_ms:.0f}ms)[/dim]\n")
        console.print("[bold green]FINMEM[/bold green] ", end="")

        history.append({"role": "user", "content": user_input})
        response = reason(result, user_input, stream=True)
        history.append({"role": "assistant", "content": response})
        console.print()


@cli.command()
def dashboard():
    """Show the full live dashboard."""
    df     = _get_df()
    state  = _latest_state(df)
    result = retrieve(state)
    render_dashboard(state, result)


if __name__ == "__main__":
    cli()
