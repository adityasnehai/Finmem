"""Runs full compression ablation and saves results/ablation.json"""
import json
import os
from eval.benchmark import run_benchmark
from rich.console import Console
from rich.table import Table
from rich import box

console = Console()


def run_ablation() -> dict:
    systems = ["rag", "fixed_window", "prompt_only"]
    results = {}

    for sys in systems:
        console.print(f"\n[cyan]Running: {sys}[/cyan]")
        results[sys] = run_benchmark(sys)

    os.makedirs("results", exist_ok=True)
    with open("results/ablation.json", "w") as f:
        json.dump(results, f, indent=2)

    tbl = Table(box=box.SIMPLE_HEAD, title="COMPRESSION ABLATION RESULTS")
    tbl.add_column("System",       style="bold")
    tbl.add_column("Quality /3",   justify="right")
    tbl.add_column("Grounded %",   justify="right")
    tbl.add_column("Lat p50 ms",   justify="right")
    tbl.add_column("Lat p95 ms",   justify="right")

    labels = {"rag": "FinMem RAG", "fixed_window": "Fixed 90d Win", "prompt_only": "Prompt Only"}
    for sys, r in results.items():
        tbl.add_row(
            labels[sys],
            str(r["avg_quality"]),
            f"{r['grounded_pct']}%",
            str(r["lat_p50_ms"]),
            str(r["lat_p95_ms"]),
        )
    console.print(tbl)

    best = max(results, key=lambda s: results[s]["avg_quality"])
    console.print(
        f"\n[bold green]Finding:[/bold green] {labels[best]} wins on quality "
        f"({results[best]['avg_quality']}/3). "
        f"RAG costs {results['rag']['lat_p50_ms']:.0f}ms vs "
        f"{results['prompt_only']['lat_p50_ms']:.0f}ms for prompt-only.\n"
    )
    return results


if __name__ == "__main__":
    run_ablation()
