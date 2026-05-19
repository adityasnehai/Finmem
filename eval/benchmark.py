"""
20-question evaluation benchmark for FinMem reasoning quality.
Each question has a reference answer graded by GPT-4o-as-judge (0-3 scale).
"""
import os
import json
import time
from openai import OpenAI
from finmem.data.loaders import load_all
from finmem.data.schemas import MarketState
from finmem.memory.retrieval import retrieve
from finmem.reasoning.engine import reason
import pandas as pd

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

QUESTIONS = [
    {"q": "What historically happened to equities after yield curve inversions deeper than -0.30%?",
     "ref": "Equities typically fell within 12-18 months. Examples: 2000 dot-com bust, 2007 pre-GFC."},
    {"q": "Find episodes where VIX exceeded 30 and the Fed was actively cutting rates.",
     "ref": "2008-2009 GFC, 2020 COVID crash. Both saw VIX spike above 40 with emergency Fed cuts."},
    {"q": "How did SPY perform 6 months after CPI peaked above 8%?",
     "ref": "1980: SPY equivalent fell sharply as Volcker hiked. 2022: SPY fell ~20% before recovering."},
    {"q": "What is the closest historical analog to the March 2020 COVID crash?",
     "ref": "2008 Lehman collapse — speed and magnitude most similar. VIX > 80, SPY -34% in weeks."},
    {"q": "What happened after the Fed paused rate hikes historically?",
     "ref": "1995 soft landing: SPY rallied. 2019: SPY rallied 30%. 2006: brief calm before 2008 crash."},
    {"q": "Show me episodes where unemployment rose above 6% and CPI was falling.",
     "ref": "2009 GFC recovery: unemployment peaked 10%, CPI fell to near-deflation. SPY bottomed March 2009."},
    {"q": "What typically happened in the 3 months following a VIX spike above 40?",
     "ref": "Short-term volatility compression. SPY historically +10-20% in 3 months after VIX > 40 peaks."},
    {"q": "When the yield curve re-steepened after a prolonged inversion, what happened to equities?",
     "ref": "Re-steepening often signals recession start. 2007-2008: re-steepening preceded SPY -50%."},
    {"q": "What episodes show a Fed pivot from hiking to cutting?",
     "ref": "1989, 1995, 2001, 2007, 2019, 2022-2023. Outcomes varied: 1995 soft landing vs 2001 recession."},
    {"q": "How did markets behave during episodes with both high CPI and high unemployment (stagflation)?",
     "ref": "1973-1975 and 1979-1982. SPY equivalent fell 40%+ in real terms. Gold and commodities outperformed."},
    {"q": "What was the average drawdown during CRISIS regime episodes?",
     "ref": "CRISIS episodes (VIX > 35) showed average max drawdowns of -25% to -50% depending on duration."},
    {"q": "Find episodes most similar to August 2015 China devaluation shock.",
     "ref": "1997 Asian financial crisis, 1998 LTCM. Short sharp selloff, VIX spike, quick recovery."},
    {"q": "What happened to fed rate after unemployment crossed 6% historically?",
     "ref": "Fed typically cut rates. 2001: Fed cut from 6.5% to 1.75%. 2008: cut from 5.25% to 0.25%."},
    {"q": "How many episodes had both inverted yield curve and Fed actively hiking?",
     "ref": "Rare: 2000 and 2006 are clearest examples. Both preceded recessions within 12-24 months."},
    {"q": "What is the typical duration of a CRISIS regime episode?",
     "ref": "Average 60-120 days. 2008 GFC lasted ~180 days. 2020 COVID: ~40 days before recovery began."},
    {"q": "When VIX was between 20-30 with falling CPI, how did SPY perform over 6 months?",
     "ref": "Moderate uncertainty, disinflationary: historically positive SPY returns 60-70% of the time."},
    {"q": "What episodes preceded the 2001 dot-com recession?",
     "ref": "2000: High valuations, Fed hiking, yield curve flattening. SPY peaked March 2000, fell 49%."},
    {"q": "How did the market react immediately after the first Fed rate cut in a hiking cycle?",
     "ref": "Initial rally common (relief). Sustained rally only if cutting cycle was preventative (1995, 2019). Continued decline if recession already started (2001, 2007)."},
    {"q": "What are the macro signatures of episodes that led to V-shaped recoveries?",
     "ref": "Fed cutting aggressively, no structural debt crisis, short duration shock. 1987, 1998, 2020."},
    {"q": "Compare current conditions to the pre-2008 period. What are the similarities and differences?",
     "ref": "Similarities: yield curve inversion, elevated rates. Differences: no housing bubble, bank capital stronger, CPI higher now."},
]

JUDGE_PROMPT = """You are evaluating a financial AI assistant's response.

Question: {question}
Reference answer (key facts): {reference}
AI response: {response}

Grade the AI response from 0-3:
3 = Factually accurate, cites specific episodes/dates, acknowledges uncertainty where appropriate
2 = Mostly accurate, some relevant citations, minor gaps
1 = Partially relevant but missing key facts or no citations
0 = Inaccurate, hallucinated, or completely off-topic

Respond with ONLY a single digit (0, 1, 2, or 3) followed by one sentence explanation."""


def grade_response(question: str, reference: str, response: str) -> tuple[int, str]:
    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": JUDGE_PROMPT.format(
            question=question, reference=reference, response=response
        )}],
        max_tokens=100,
        temperature=0,
    )
    text  = resp.choices[0].message.content.strip()
    score = int(text[0]) if text and text[0].isdigit() else 0
    explanation = text[2:].strip() if len(text) > 2 else ""
    return score, explanation


def run_benchmark(system: str = "rag") -> dict:
    """
    system: 'rag' | 'fixed_window' | 'prompt_only'
    """
    from finmem.data.loaders import load_all
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

    scores, explanations, latencies = [], [], []

    for i, qa in enumerate(QUESTIONS):
        print(f"Q{i+1:02d}/{len(QUESTIONS)}: {qa['q'][:60]}...")
        t0 = time.time()

        if system == "rag":
            result   = retrieve(state)
            response = reason(result, qa["q"], stream=False)

        elif system == "fixed_window":
            context = (
                f"Market context (last 90 days): SPY {state.spy_return_21d:.1%} 21d, "
                f"VIX {state.vix:.1f}, CPI {state.cpi:.1f}%, Fed {state.fed_rate:.2f}%, "
                f"Yield curve {state.yield_spread:+.2f}%, Unemp {state.unemployment:.1f}%."
            )
            resp = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a financial analyst. Answer based only on the context provided."},
                    {"role": "user",   "content": f"{context}\n\n{qa['q']}"},
                ],
                max_tokens=300, temperature=0.3,
            )
            response = resp.choices[0].message.content.strip()

        else:  # prompt_only
            resp = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a financial analyst. Answer from your training knowledge."},
                    {"role": "user",   "content": qa["q"]},
                ],
                max_tokens=300, temperature=0.3,
            )
            response = resp.choices[0].message.content.strip()

        latency = (time.time() - t0) * 1000
        score, explanation = grade_response(qa["q"], qa["ref"], response)
        scores.append(score)
        explanations.append(explanation)
        latencies.append(latency)
        print(f"  Score: {score}/3 | Latency: {latency:.0f}ms")

    return {
        "system":        system,
        "avg_quality":   round(sum(scores) / len(scores), 2),
        "grounded_pct":  round(sum(1 for s in scores if s >= 2) / len(scores) * 100, 1),
        "lat_p50_ms":    round(sorted(latencies)[len(latencies) // 2], 0),
        "lat_p95_ms":    round(sorted(latencies)[int(len(latencies) * 0.95)], 0),
        "scores":        scores,
        "explanations":  explanations,
    }


if __name__ == "__main__":
    results = {}
    for sys in ["rag", "fixed_window", "prompt_only"]:
        print(f"\n{'='*60}\nRunning benchmark: {sys}\n{'='*60}")
        results[sys] = run_benchmark(sys)

    os.makedirs("results", exist_ok=True)
    with open("results/benchmark.json", "w") as f:
        json.dump(results, f, indent=2)

    print("\n\nABLATION RESULTS")
    print(f"{'System':<16} {'Quality/3':<12} {'Grounded%':<12} {'Lat p50':<10} {'Lat p95'}")
    for sys, r in results.items():
        print(f"{sys:<16} {r['avg_quality']:<12} {r['grounded_pct']:<12} {r['lat_p50_ms']:<10} {r['lat_p95_ms']}")
