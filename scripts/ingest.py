"""One-command full ingest pipeline: data → episodes → embeddings → LanceDB"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from finmem.data.loaders import load_all
from finmem.data.episode_builder import build_episodes
from finmem.memory.store import store_episodes, count_episodes
from rich.console import Console

console = Console()


def main():
    console.rule("[bold green]FINMEM INGEST[/bold green]")
    console.print("[dim]Step 1/3: Loading market data (yfinance + FRED)...[/dim]")
    df = load_all()

    console.print(f"\n[dim]Step 2/3: Building episodes (PELT changepoint detection)...[/dim]")
    episodes = build_episodes(df)

    console.print(f"\n[dim]Step 3/3: Embedding and storing in LanceDB...[/dim]")
    store_episodes(episodes)

    n = count_episodes()
    console.rule(f"[bold green]✓ Done — {n} episodes indexed[/bold green]")
    console.print("[dim]Run: finmem chat[/dim]")


if __name__ == "__main__":
    main()
