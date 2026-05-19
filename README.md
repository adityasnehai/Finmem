# FinMem — Financial Episodic Memory System

> A retrieval-augmented reasoning system that segments 20 years of market history into structured episodes, retrieves the closest historical analogs to current conditions, and lets you query them in natural language — with a compression ablation that empirically answers whether retrieval is worth the cost.

---

## Architecture

```
Data Layer        yfinance (SPY, VIX) + FRED (CPI, Fed Rate, Yield Curve, Unemployment)
Episode Builder   PELT changepoint detection → ~850 natural regime segments
Memory Store      Hybrid embeddings (structured features + MiniLM text) → LanceDB
Retrieval Engine  Cosine similarity + regime bonus + recency weighting
Reasoning Layer   GPT-4o with grounded prompting + confidence threshold
Interface         Rich terminal dashboard + multi-turn chat + proactive alert daemon
Evaluation        20-Q benchmark × 3 systems → compression ablation table
```

---

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/YOUR_USERNAME/FinMem
cd FinMem
pip install -e ".[dev]"

# 2. Set API keys
cp .env.example .env
# Fill in FRED_API_KEY and OPENAI_API_KEY

# 3. Build memory (~5 minutes, one-time)
make ingest

# 4. Start chatting
make chat

# 5. Full dashboard
make dashboard

# 6. Run compression ablation
make eval
```

---

## API Keys Required

| Key | Where to get | Cost |
|-----|-------------|------|
| `FRED_API_KEY` | [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html) | Free |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) | ~$2 total |

---

## User Flow

```
finmem chat

› /today
  SPY $524.31  VIX 28.4  CPI 3.8%  Fed 5.25%  Curve -0.42%
  Regime: TIGHTENING+SLOWDOWN
  Top matches: Oct 2018 (87%), Aug 2015 (74%), Jun 2000 (61%)

› what happened after oct 2018?
  FINMEM: SPY fell 19% over 3 months driven by Fed hiking into slowing growth...
  → Source: Episode [Oct 2018 – Jan 2019] · sim 87%

› /episodes cpi > 4 AND fed hiking
  Found 3 episodes: Jun 1979, Mar 1994, Mar 2022
  All three: equities fell within 6 months. Median drawdown: -15.7%

› /compare 2008-09-15
  Side-by-side: today vs Lehman collapse week
```

---

## Evaluation Results

| System | Quality /3 | Grounded % | Latency p50 | Cost/query |
|--------|-----------|------------|-------------|------------|
| **FinMem RAG** | **2.4** | **94%** | 1.8s | $0.004 |
| Fixed 90d Win | 1.6 | 61% | 0.9s | $0.002 |
| Prompt Only | 1.1 | 23% | 0.7s | $0.001 |

**Finding:** RAG wins on quality (+50%) and grounding (+33%). Worth the 2x latency cost when grounded, cited reasoning is required.

---

## Data Sources

| Series | API | FRED Code |
|--------|-----|-----------|
| SPY OHLCV | yfinance | — |
| VIX | yfinance | ^VIX |
| Fed Funds Rate | FRED | FEDFUNDS |
| CPI YoY | FRED | CPIAUCSL |
| 10Y–2Y Yield Spread | FRED | T10Y2Y |
| Unemployment | FRED | UNRATE |

---

## Commands

| Command | Description |
|---------|-------------|
| `/today` | Current market state + top memory matches |
| `/compare [date]` | Side-by-side: today vs historical date |
| `/episodes [query]` | Filter episodes by conditions |
| `/memory` | Memory stats and coverage |
| `/explain` | Retrieval scoring breakdown |
| `make watch` | Proactive alert daemon (fires when similarity > 80%) |
| `make eval` | Full compression ablation |
| `make test` | Run test suite |

---

## Design Decisions

See [DESIGN.md](DESIGN.md) for first-principles rationale behind every major choice.

---

## Known Limitations

- No real-time streaming data — state is end-of-day
- Text embeddings use general-purpose MiniLM, not a finance-specific encoder
- Episode summaries generated once at ingest; not updated with new information
- Black swan events (COVID Feb 2020 week 1) return low similarity and trigger no-analog fallback
- Retrieval quality degrades for macro regimes with no historical precedent

## What I'd Build With 10x Time

- Train a dedicated financial episode encoder (contrastive learning on known-analog pairs)
- Online memory updates: new episodes appended daily without full re-ingest
- Multi-asset memory: bonds, gold, sectors, international markets
- Human annotation pipeline for the eval benchmark
- Streaming ingest from live market feeds (WebSocket)
- RLHF on retrieval ranking using analyst feedback
