# FinMem — Financial Episodic Memory System

![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?style=flat&logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat&logo=nextdotjs&logoColor=white)
![LanceDB](https://img.shields.io/badge/LanceDB-Vector_DB-FF6B35?style=flat)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=flat&logo=openai&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat)
![CI](https://github.com/adityasnehai/Finmem/actions/workflows/ci.yml/badge.svg)

---

## What is FinMem?

FinMem is a **retrieval-augmented financial research system** that answers questions about markets by finding the most structurally similar historical periods — not by guessing from a language model's weights.

Instead of asking "what do you think will happen?", FinMem asks: *"When have conditions like this occurred before, and what happened next?"*

Every answer is grounded in a retrieved historical episode with a similarity score, a confidence rating, and the actual forward returns that followed.

---

## The Problem

Large language models hallucinate financial history. They fabricate dates, misremember regime conditions, and produce confident answers with no grounding. Existing tools either:
- Use a fixed recency window (last 90 days) — missing structural analogs from decades ago
- Rely on LLM memory alone — no citations, no verifiability
- Retrieve by keyword — missing periods that are numerically similar but described differently

**The core insight:** markets repeat structural patterns, not calendar dates. A 2024 yield curve inversion is more similar to 2006 than to 2023, regardless of how they are described in text.

---

## How It Works

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES                            │
│   yfinance (SPY, VIX)          FRED API (CPI, Fed Rate,        │
│   1993 → today, daily          Yield Spread, Unemployment)      │
└───────────────┬────────────────────────┬────────────────────────┘
                │                        │
                ▼                        ▼
┌──────────────────────────────────────────────────────────────────┐
│                   INGEST PIPELINE  (scripts/ingest.py)           │
│                                                                  │
│  1. Load all data → merged daily DataFrame (1993–today)          │
│                                                                  │
│  2. PELT Changepoint Detection                                   │
│     ruptures library, RBF kernel on [return, volatility]         │
│     Penalty auto-tuned to produce 50–100 episodes               │
│                                                                  │
│  3. Gaussian HMM Regime Labeling  (Hamilton 1989)                │
│     7 latent states on 6 features                                │
│     States mapped to labels by emission mean inspection          │
│     Labels: STABLE · BULL · CRISIS · SELLOFF · TIGHTENING       │
│             TIGHTENING+SLOWDOWN · EASING+RECOVERY               │
│                                                                  │
│  4. Episode Feature Extraction                                   │
│     avg return, max drawdown, VIX, CPI, fed rate,               │
│     yield spread, unemployment, 1m/3m/6m forward returns        │
│                                                                  │
│  5. GPT-4o-mini Prose Summary per episode                        │
│                                                                  │
│  6. 519-dim Hybrid Embedding                                     │
│     7-dim structural vector (normalized macro + price)           │
│     512-dim Matryoshka text embedding (text-embedding-3-small)   │
│     Weighted concat: struct×0.6 + text×0.4 → L2-normalized      │
│                                                                  │
│  7. All-But-The-Top Whitening  (Mu & Viswanath, ICLR 2018)      │
│     Removes dominant "financial episode" direction via PCA       │
│     Makes cosine similarity discriminative                       │
│                                                                  │
│  8. LanceDB Storage (on-disk vector database)                    │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    QUERY PIPELINE  (FastAPI)                      │
│                                                                  │
│  User question                                                   │
│       │                                                          │
│       ▼                                                          │
│  Embed today's market state → 519-dim hybrid vector             │
│       ▼                                                          │
│  Apply same whitening transform to query vector                  │
│       ▼                                                          │
│  Cosine similarity against all whitened episode vectors          │
│  Top-20 candidates → reranking                                   │
│       + regime bonus  (+0.10 if episode regime matches today)    │
│       - recency penalty (-0.05 if episode > 15 years old)       │
│       ▼                                                          │
│  Confidence gate                                                 │
│  sim ≥ 0.27 → reason freely                                     │
│  sim ≥ 0.15 → reason with uncertainty warning                   │
│  sim < 0.15 → refuse, return "no analog found"                  │
│       ▼                                                          │
│  GPT-4o reasons ONLY from retrieved episodes                     │
│  Cites episode date ranges + similarity scores                   │
│  Streams response via SSE                                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Key Technical Decisions

| Decision | What we chose | Why |
|---|---|---|
| Episode detection | PELT changepoint detection (RBF kernel) | Finds structural breaks in return + vol signal — no arbitrary fixed windows |
| Regime labeling | Gaussian HMM (Hamilton 1989, 7 states) | Data-driven, no hand-coded thresholds; labels assigned by emission mean inspection |
| Embedding | 519-dim hybrid (7 structural + 512 text) | Structural catches numeric similarity; text catches semantic similarity |
| Text embedding | text-embedding-3-small, Matryoshka 512-dim | Cheaper storage vs full 1536-dim, same quality for this task |
| Post-processing | All-but-the-top whitening (Mu & Viswanath) | Raw cosine on financial embeddings is near-isotropic; whitening makes it discriminative |
| Retrieval | Cosine similarity + reranking | Regime bonus rewards same macro context; recency penalty avoids over-weighting old episodes |
| Confidence | Threshold gate (0.27 / 0.15) | Calibrated on actual pairwise similarity distribution — refuses rather than hallucinating |
| LLM reasoning | GPT-4o with strict system prompt | Reasons only from retrieved context; cites sources; refuses to invent |
| LLM summaries | GPT-4o-mini | Cost-quality tradeoff: mini sufficient for structured 2-sentence summaries |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Data | yfinance, FRED API |
| Episode detection | ruptures (PELT) |
| Regime labeling | hmmlearn (Gaussian HMM) |
| Embeddings | OpenAI text-embedding-3-small |
| Vector store | LanceDB |
| Backend | FastAPI + uvicorn |
| Frontend | Next.js 16, Tailwind CSS, Recharts |
| CI/CD | GitHub Actions |
| Hosting | Render (API) + Vercel (frontend) |

---

## Features

### Today's Analog
Compares today's market state against all historical episodes and surfaces the top 5 most similar periods with similarity scores and the forward returns that followed.

### Episode Browser
Full searchable database of all detected market episodes. Filter by regime, date, or keyword. Each episode shows macro conditions at entry, total return, max drawdown, and 1m / 3m / 6m SPY forward returns.

### Chat
Free-form questions about market history. Every answer is generated strictly from retrieved episodes — the system prompt forbids the LLM from using knowledge outside retrieved context. Confidence score shown per response.

### Analytics
Retrieval quality benchmark comparing three systems — FinMem RAG vs. Recency Window (90d) vs. No Retrieval. PCA compression ablation on stored embeddings.

### Insights
Regime transition matrix with historical probabilities. Precursor frequency analysis — which signals (VIX spike, yield inversion, Fed tightening) preceded each regime shift.

### Episode Compare
Side-by-side comparison of any two episodes across all features and forward returns.

---

## How Similarity is Calculated

```
Ingest (per episode):
  struct_vec = normalize([avg_return, vol, cpi/10, fed/10, spread/5, vix/50, unemp/10])
  text_vec   = openai_embed(prose_summary, dims=512)
  hybrid     = normalize(struct_vec × 0.6 ‖ text_vec × 0.4)   # 519-dim

Whitening (across all episode vectors):
  centered   = hybrid - mean(all_hybrids)
  top_pc     = PCA(n=1).fit(centered).components_
  whitened   = normalize(centered - centered @ top_pc.T @ top_pc)

Query time:
  query_vec  = embed(today's market state)     # same 519-dim pipeline
  query_w    = apply_same_whiten(query_vec)
  similarity = dot(query_w, episode_w)         # both L2-normalized = cosine

Reranking:
  final_score = similarity
                + 0.10  (if episode regime == today's HMM regime)
                - 0.05  (if episode start year < current_year - 15)
```

---

## Success Criteria

| Criteria | How measured |
|---|---|
| Retrieval is grounded | Every response cites episode date range + similarity score |
| Confidence is calibrated | Thresholds set from empirical pairwise similarity distribution, not guessed |
| System refuses when uncertain | `confidence_gate()` returns refusal below sim 0.15 — never hallucinates |
| Retrieval beats baselines | `make eval` runs ablation: RAG vs. fixed window vs. no retrieval |
| Forward returns are real | Computed from actual SPY closing prices |
| Regime labels are data-driven | HMM fitted on data; no hand-coded thresholds |

---

## Limitations

- **Free tier cold start**: Render free tier spins down after 15 min — first request takes ~30s
- **yfinance rate limits**: Yahoo Finance throttles on cold start — resolves in 1–2 min
- **Recent episodes have no forward returns**: Episodes ending within last 6 months have null 6m forward returns (expected)
- **HMM is non-deterministic across re-ingests**: Re-fitting shifts regime boundaries slightly
- **Single-node vector search**: Brute-force cosine scan — adequate for ~100 episodes, needs ANN index at scale
- **No intraday data**: Daily resolution only; ingest runs once per day
- **FRED data is monthly**: CPI, unemployment, fed rate are forward-filled from monthly releases

---

## External Data

| Source | Series | Frequency |
|---|---|---|
| yfinance | SPY (price, volume), ^VIX | Daily |
| FRED | CPIAUCSL (CPI), FEDFUNDS (Fed rate), T10Y2Y (yield spread), UNRATE (unemployment) | Monthly → forward-filled |

FRED API key is free at [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html).

---

## Local Setup

**Prerequisites:** Python 3.11+, Node.js 20+, OpenAI API key, FRED API key

```bash
# 1. Clone and install
git clone https://github.com/adityasnehai/Finmem.git
cd Finmem
pip install -e ".[dev]"

# 2. Set environment variables
cp .env.example .env
# Edit .env: add OPENAI_API_KEY and FRED_API_KEY

# 3. Run ingest (fetches data, fits HMM, builds episodes, embeds, stores)
# Takes ~5–10 min on first run
make ingest

# 4. Start API
make api
# → http://localhost:8000
# → http://localhost:8000/docs

# 5. Start frontend (new terminal)
cd web && npm install && npm run dev
# → http://localhost:3000
```

---

## Deploy to Render + Vercel

### API → Render

1. [render.com](https://render.com) → **New Web Service** → connect this repo
2. Settings: Runtime `Python 3`, Build `pip install -r requirements.txt`, Start `uvicorn api.main:app --host 0.0.0.0 --port $PORT`, Branch `main`
3. Environment variables: `OPENAI_API_KEY`, `FRED_API_KEY`, `ALLOWED_ORIGIN` (your Vercel URL)
4. Verify: `https://your-api.onrender.com/api/health` → `{"status":"ok"}`

### Frontend → Vercel

1. [vercel.com](https://vercel.com) → **New Project** → import this repo
2. Root directory: `web`
3. Environment variable: `NEXT_PUBLIC_API_URL` = your Render URL
4. Deploy

---

## CI/CD

GitHub Actions on every push to `main`:
- Backend: `pip install -r requirements.txt` → `pytest tests/`
- Frontend: `npm ci` → `npm run build`

Secrets needed in repo settings: `OPENAI_API_KEY`, `NEXT_PUBLIC_API_URL`

---

## Project Structure

```
FinMem/
├── api/
│   ├── main.py              # FastAPI — all endpoints
│   └── query_engine.py      # Precursor/transition queries
├── finmem/
│   ├── data/
│   │   ├── loaders.py       # yfinance + FRED fetch
│   │   ├── episode_builder.py  # PELT + episode construction
│   │   └── schemas.py       # Pydantic models
│   ├── memory/
│   │   ├── embeddings.py    # 519-dim hybrid embedding
│   │   ├── regime.py        # Gaussian HMM regime detector
│   │   ├── retrieval.py     # Cosine search + reranking
│   │   └── store.py         # LanceDB + whitening cache
│   └── reasoning/
│       ├── confidence.py    # Confidence gate + refusal
│       └── engine.py        # GPT-4o prompt + streaming
├── eval/
│   ├── ablation.py          # Retrieval quality benchmark
│   ├── benchmark.py         # Questions + LLM grader
│   ├── latency.py           # Latency profiler
│   └── local_ablation.py    # Local ablation (no DB)
├── scripts/
│   ├── ingest.py            # Full pipeline entrypoint
│   ├── init_db.py           # DB schema init
│   └── demo.py              # 5-query showcase
├── tests/
│   └── test_confidence.py   # Confidence gate tests
├── web/                     # Next.js frontend
│   ├── app/
│   │   ├── page.tsx         # Landing page
│   │   └── (app)/           # All app pages
│   └── lib/
│       ├── api.ts           # API client (15s timeout)
│       └── constants.ts     # Shared regime constants
├── .github/workflows/ci.yml
├── render.yaml
├── pyproject.toml
└── Makefile
```

---

## Commands

```bash
make ingest    # Full pipeline: fetch → HMM → episodes → embed → store
make api       # Start FastAPI dev server
make eval      # Run retrieval quality ablation
make latency   # Profile retrieval latency
make test      # Run tests
make lint      # Ruff linter
make demo      # 5-query showcase
make clean     # Remove generated files
```

---

## Scaling

Current architecture is single-node. For production scale:
- **Vector search**: Enable LanceDB IVF-PQ index for 1M+ episodes
- **API workers**: `gunicorn -k uvicorn.workers.UvicornWorker -w 4`
- **Ingest scheduling**: Celery beat task triggered after market close daily
- **Embedding cache**: Cache query vectors by market state hash
