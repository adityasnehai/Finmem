# FinMem Project Overview

## What FinMem Is

FinMem is a financial episodic memory system. It turns decades of daily market and macro data into historical episodes, embeds those episodes, and retrieves the closest structural analogs to today's market state before generating grounded answers.

The core idea is simple:
- do not ask a language model to remember market history from weights alone
- retrieve the most similar historical period first
- answer only from those retrieved episodes
- refuse when no strong analog exists

## High-Level Architecture

FinMem has four main layers:

1. Data ingestion
2. Episodic memory construction
3. Retrieval and reasoning
4. User interfaces and evaluation

### Data Sources

- `yfinance` for SPY and VIX
- FRED for CPI, Fed funds rate, 10Y-2Y spread, and unemployment
- Local cache in `data/market_cache.parquet` to avoid repeated remote fetches in deployments that cannot reliably access Yahoo Finance

### Pipeline Summary

1. Load daily market and macro data.
2. Detect market episode boundaries with PELT changepoint detection.
3. Label each episode with an HMM-derived regime.
4. Compute episode features and forward returns.
5. Generate a prose summary for each episode with GPT-4o-mini.
6. Embed each episode into a 519-dimensional hybrid vector.
7. Whitening removes the dominant global financial direction.
8. Store everything in LanceDB.

## Memory Model

### Episode Schema

The canonical data models live in `finmem/data/schemas.py`.

- `MarketState`: live market snapshot used for retrieval
- `Episode`: historical episode with macro features, returns, regime, summary, and optional embedding
- `RetrievalResult`: matched episode plus similarity bookkeeping
- `QueryResult`: query snapshot, retrieved episodes, confidence, and latency

### Episode Construction

`finmem/data/episode_builder.py`:

- builds episodes from contiguous market segments
- uses `ruptures.Pelt(model="rbf")`
- auto-selects a penalty to target roughly 50-100 episodes
- computes:
  - average daily return
  - total return
  - max drawdown
  - rolling volatility
  - VIX level
  - CPI
  - Fed rate
  - yield spread
  - unemployment
  - 1-month, 3-month, and 6-month forward SPY returns
- generates a two-sentence prose summary with GPT-4o-mini, falling back to a template if the API call fails

### Regime Labeling

`finmem/memory/regime.py` uses a Gaussian HMM with 7 components trained on:

- daily SPY return
- 21-day rolling volatility
- VIX
- CPI
- Fed rate
- yield spread

The hidden states are deterministically mapped to human-readable regimes:

- `STABLE`
- `BULL`
- `CRISIS`
- `SELLOFF`
- `TIGHTENING`
- `TIGHTENING+SLOWDOWN`
- `EASING+RECOVERY`

The same model is used in three places:

- episode labeling during ingest
- live regime display for today's market
- retrieval reranking bonus when the episode regime matches today's regime

### Embeddings

`finmem/memory/embeddings.py` creates a 519-dim hybrid embedding:

- 7 structural dimensions from normalized macro/price features
- 512 dimensions from `text-embedding-3-small`

The structural and text parts are weighted and concatenated, then L2-normalized.

Design choices:

- structural signal keeps numeric market state aligned
- text signal preserves semantic similarity from episode summaries
- 512-dim text truncation follows Matryoshka-style compression

### Storage

`finmem/memory/store.py` uses LanceDB as the vector store.

Stored fields include:

- episode metadata
- macro values
- forward returns
- prose summary
- the 519-dim vector

It also maintains an in-memory cache for the whitening transform and whitened vectors.

### Whitening

FinMem applies an all-but-the-top transform:

- compute the mean vector across all episodes
- find the top principal component
- subtract the projection onto that component
- renormalize

This reduces the “everything looks like a market episode” collapse that often happens with raw cosine similarity.

## Retrieval and Reasoning

### Retrieval Flow

`finmem/memory/retrieval.py` does the live search:

1. Embed the current `MarketState`
2. Apply the same whitening transform used on episodes
3. Compute cosine similarity against all episode vectors
4. Take top candidates
5. Rerank by:
   - similarity
   - `+0.10` if the regime matches today's regime
   - `-0.05` if the episode is older than 15 years
6. Return the top 5

### Confidence Gate

`finmem/reasoning/confidence.py` and `finmem/reasoning/engine.py` enforce a refusal policy:

- `>= 0.27`: strong analog, answer normally
- `0.15 to 0.27`: answer with a moderate-confidence warning
- `< 0.15`: refuse and say no confident historical analog was found

This is one of the most important project constraints. FinMem is designed to stay silent when the data is weak rather than synthesize a convincing but unsupported answer.

### Reasoning Prompt

The reasoning layer:

- sends only retrieved episodes to GPT-4o
- requires episode date ranges and similarity scores in the response
- keeps answers short and grounded
- falls back to a templated response if the model call fails

### CLI Flow

`finmem/interface/chat.py` provides a terminal interface with commands such as:

- `/today`
- `/compare <date>`
- `/episodes <filter>`
- `/memory`
- `/explain`
- `/help`

`finmem/interface/dashboard.py` renders the Rich dashboard used by the CLI.

`finmem/interface/watch.py` implements periodic market monitoring and alerting when the current market is highly similar to a historical episode.

## Backend API

`api/main.py` is the primary FastAPI application.

### Core Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/state` | Current market state plus top retrieved episodes |
| `GET /api/memory` | Episode count, date range, regime breakdown |
| `GET /api/episodes` | List episodes with optional regime filter |
| `GET /api/episodes/search` | Filter episodes by CPI, VIX, Fed rate, regime |
| `GET /api/episodes/export` | Export episode rows for download |
| `GET /api/episodes/{episode_id}` | Full detail for one episode |
| `GET /api/episodes/{id1}/compare/{id2}` | Side-by-side comparison |
| `POST /api/chat/stream` | SSE streaming chat endpoint |
| `GET /api/ablation` | Load saved ablation results if present |
| `GET /api/episodes/{episode_id}/precursors` | Precursor analysis for a specific episode |
| `GET /api/regime-transitions` | Regime transition probabilities |
| `GET /api/precursor-frequencies` | Frequency of precursor signals before transitions |
| `GET /api/outcomes/distribution` | Outcome statistics for charts |
| `GET /api/data-quality` | Coverage and completeness metrics |
| `GET /api/health` | Simple health check |
| `GET /api/eval/calibration` | Leave-one-out retrieval calibration metrics |
| `GET /api/eval/compression` | PCA compression ablation results |

### API Behavior Notes

- The server warms up by loading cached market data and prefetching live data when fresh enough.
- CORS is restricted through `ALLOWED_ORIGIN`.
- Chat is rate limited with `slowapi`.
- Market data is cached locally to reduce startup fragility.

## Evaluation Layer

The repo includes explicit benchmark and profiling scripts.

### `eval/benchmark.py`

- 20 question benchmark
- compares:
  - FinMem RAG
  - fixed 90-day context
  - prompt-only baseline
- uses GPT-4o as a judge
- reports:
  - average quality score
  - grounded percentage
  - latency p50/p95

### `eval/ablation.py`

- runs the benchmark across all three systems
- writes `results/ablation.json`
- prints a summary table

### `eval/latency.py`

- profiles retrieval latency over repeated runs
- reports p50/p95/mean/min/max
- notes approximate extra latency for the GPT-4o API call

### `tests/test_confidence.py`

- verifies confidence thresholds
- checks:
  - strong analog passes cleanly
  - moderate confidence adds warning text
  - weak analog refuses
  - exact threshold behavior is stable

## Frontend

The `web/` directory is a Next.js 16 app with Tailwind and shadcn-based primitives.

### Global Styling

`web/app/globals.css` defines:

- a light mint-green visual theme
- typography tokens
- chart and regime color palettes
- card, glow, skeleton, and motion utilities
- reduced-motion support

`web/app/layout.tsx` sets the fonts and metadata.

### Landing Page

`web/app/page.tsx` builds the public marketing page. The section structure includes:

- hero
- workflow
- feature cards
- comparison section
- testimonials
- FAQ
- footer CTA

Supporting homepage components:

- `web/components/homepage/Header.tsx`
- `web/components/homepage/HeroSection.tsx`
- `web/components/homepage/FeatureCards.tsx`
- `web/components/homepage/HowItWorks.tsx`
- `web/components/homepage/Testimonials.tsx`
- `web/components/homepage/FaqSection.tsx`
- `web/components/homepage/FooterCta.tsx`
- `web/components/homepage/Footer.tsx`

The landing page emphasizes the retrieval-first story: analog search, grounded answers, regime awareness, and refusal on weak matches.

### Workspace Shell

`web/components/SidebarLayout.tsx` provides the app shell with sections for:

- Overview
- Research
- System

The sidebar is wired for routes such as:

- `/dashboard`
- `/today`
- `/memory`
- `/chat`
- `/analytics`
- `/data`

The visible checked-in tree mainly contains the landing page plus shared shell and component code; the workspace route pages themselves are not present in the current file list.

### Workspace Components

Current reusable panels include:

- `ChatPanel.tsx` - streaming chat UI with suggested queries
- `EpisodeMatches.tsx` - ranked historical analog cards
- `MarketState.tsx` - compact live state summary
- `MacroPanel.tsx` - macro indicators and regime coverage

These components are designed to display:

- current market state
- memory matches
- macro coverage
- model confidence
- forward returns

### API Client

`web/lib/api.ts` centralizes browser-side calls and SSE streaming.

It includes:

- `fetchState`
- `fetchMemory`
- `fetchEpisodes`
- `fetchAllEpisodes`
- `fetchEpisodeDetail`
- `fetchCompareEpisodes`
- `fetchOutcomesDistribution`
- `fetchEpisodePrecursors`
- `fetchRegimeTransitions`
- `fetchPrecursorFrequencies`
- `fetchAblation`
- `fetchCalibration`
- `fetchCompression`
- `fetchEpisodesExport`
- `fetchDataQuality`
- `streamChat`

The client uses a 15-second timeout and proxies chat through the Next.js app route to avoid browser-to-backend connectivity problems.

### Shared Constants

`web/lib/constants.ts` defines:

- regime color mappings
- human-readable regime labels
- ablation labels and colors
- the full regime list

## Scripts

### `scripts/ingest.py`

The main end-to-end build:

1. load data
2. fit HMM
3. build episodes
4. store embeddings

### `scripts/demo.py`

Runs a curated 5-query showcase over the current market state.

### `scripts/init_db.py`

Database initialization entrypoint for the legacy/SQL-backed pieces.

## Legacy / Alternate Query Path

`api/query_engine.py` is a separate query engine implementation that combines LanceDB with PostgreSQL metadata filtering. It looks like a later or alternate phase of the project:

- semantic search over episode text
- metadata filters by regime and date
- episode outcome lookup from PostgreSQL
- construction of richer `SimilarEpisode` objects

This file is not the primary retrieval path used by `api/main.py`, but it shows the project's broader direction toward hybrid semantic + relational querying.

## Top-Level Commands

`Makefile` exposes the common workflows:

- `make ingest`
- `make api`
- `make chat`
- `make dashboard`
- `make watch`
- `make eval`
- `make latency`
- `make demo`
- `make test`
- `make lint`
- `make clean`

## Setup and Deployment

### Local Setup

- Python 3.11+
- Node.js 20+
- OpenAI API key
- FRED API key

Typical flow:

1. install Python dependencies
2. copy `.env.example` to `.env`
3. set `OPENAI_API_KEY` and `FRED_API_KEY`
4. run ingest
5. start the API
6. start the frontend

### Deployment Model

- API: Render
- frontend: Vercel

The API needs:

- `OPENAI_API_KEY`
- `FRED_API_KEY`
- `ALLOWED_ORIGIN`

The frontend needs:

- `NEXT_PUBLIC_API_URL`

## Important Constraints

- Yahoo Finance can be unreliable from cloud datacenters, so the project keeps a local parquet cache.
- Episodes ending within the last 6 months do not yet have valid 6-month forward returns.
- HMM re-fitting can slightly shift regimes on each re-ingest.
- Retrieval is still brute-force cosine scan, which is fine for the current scale but not for very large episode counts.
- The public web app shell and the backend API are more complete than the workspace route pages visible in this checkout.
- Some marketing components still contain older copy or labels from an earlier phase of the project, so not every bit of UI text matches the current 7-regime HMM backend exactly.

## One-Sentence Summary

FinMem is a retrieval-first financial research system that turns market history into labeled episodes, retrieves the closest structural analogs to today's regime, and refuses to guess when the historical signal is weak.
