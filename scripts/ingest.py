"""One-command full ingest pipeline: data → HMM fit → episodes → embeddings → LanceDB"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from finmem.data.loaders import load_all
from finmem.data.episode_builder import build_episodes
from finmem.memory.store import store_episodes, count_episodes
from finmem.memory.regime import fit_and_save
from rich.console import Console

console = Console()


def main():
    console.rule("[bold green]FINMEM INGEST[/bold green]")
    console.print("[dim]Step 1/4: Loading market data (yfinance + FRED)...[/dim]")
    df = load_all()

    console.print("\n[dim]Step 2/4: Fitting HMM regime model (Hamilton 1989)...[/dim]")
    fit_and_save(df)
    console.print("[green]HMM regime model fitted and saved.[/green]")

    console.print("\n[dim]Step 3/4: Building episodes (PELT changepoint detection + elbow pen selection)...[/dim]")
    episodes = build_episodes(df)

    console.print("\n[dim]Step 4/4: Embedding and storing in LanceDB...[/dim]")
    store_episodes(episodes)

    n = count_episodes()
    console.rule(f"[bold green]✓ Done — {n} episodes indexed[/bold green]")
    console.print("[dim]Run: finmem chat[/dim]")


if __name__ == "__main__":
    main()
