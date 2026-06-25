# FinMem Interview Guide

This file is the compact, interview-focused explanation of FinMem.

It covers:

- the problem statement
- what Henry was really asking for
- the product idea
- the data used
- the architecture
- the key algorithms
- why each design decision was made
- the gaps and limitations
- a toy example you can use to explain every step end to end

---

## 1. What Problem FinMem Solves

FinMem solves this problem:

> Financial history is long, structured, and repetitive, but language models often answer market questions from vague priors instead of grounded historical analogs.

The system is built to answer:

> “When have conditions like this happened before, and what happened next?”

That is a much better problem than asking a model to predict markets from scratch.

### Why this matters

- LLMs can hallucinate market history
- keyword search misses structurally similar periods
- fixed recency windows miss older but more relevant analogs
- markets are about regimes and transitions, not just dates

FinMem turns market history into a searchable memory system.

---

## 2. What Henry Wanted

From the recruiter email, the important requirements were:

- build something non-trivial end to end
- decide the problem yourself
- define success yourself
- show structure
- show depth
- show version control / serious engineering
- make the repo stand on its own
- make the work reviewable as-is
- use external data if needed, but be clear about it

FinMem fits this well because it is:

- end to end
- data-driven
- technically layered
- explainable
- grounded in real external data
- evaluable

---

## 3. What FinMem Actually Is

FinMem is a **retrieval-first financial research system**.

It is not:

- a trading bot
- a prediction engine
- a generic chatbot

It is:

- a historical analog system
- an episodic memory system
- a grounded Q&A system for market history

The core product behavior:

1. load live market state
2. compare it to past episodes
3. retrieve the closest analogs
4. explain them with citations
5. refuse if the analog is weak

---

## 4. Data Used

FinMem uses daily market and macro data.

### Market data

- SPY price and volume from Yahoo Finance
- VIX from Yahoo Finance

### Macro data from FRED

- CPI: `CPIAUCSL`
- Fed funds rate: `FEDFUNDS`
- 10Y-2Y spread: `T10Y2Y`
- unemployment: `UNRATE`

### Time coverage

- starts around `1993-01-01`
- extends to the latest local cache / fetched date

### Why these signals

These signals capture the broad market state:

- equity trend
- volatility / fear
- inflation
- policy stance
- yield-curve shape
- labor-market weakness

That is enough to model market regimes without using intraday data or news.

---

## 5. High-Level Architecture

FinMem has four layers:

1. data ingestion
2. memory construction
3. retrieval and reasoning
4. user interfaces and evaluation

### A. Ingestion

Files:

- `scripts/ingest.py`
- `finmem/data/loaders.py`
- `finmem/data/episode_builder.py`
- `finmem/memory/regime.py`
- `finmem/memory/embeddings.py`
- `finmem/memory/store.py`

### B. Retrieval and reasoning

Files:

- `finmem/memory/retrieval.py`
- `finmem/reasoning/confidence.py`
- `finmem/reasoning/engine.py`

### C. Backend API

File:

- `api/main.py`

### D. Frontend

Files:

- `web/app/page.tsx`
- `web/components/*`
- `web/lib/api.ts`

---

## 6. The Core Pipeline in Order

This is the sequence you should remember for interviews.

### Step 1: load raw data

`finmem/data/loaders.py` fetches:

- SPY
- VIX
- FRED macro series

It then derives:

- 1-day return
- 5-day return
- 21-day return
- 21-day rolling volatility
- CPI year-over-year change

The result is one daily dataframe with all the market state features.

### Step 2: detect episode boundaries with PELT

`finmem/data/episode_builder.py` uses PELT changepoint detection on:

- daily SPY return
- rolling volatility

This splits the long history into episodes based on structural changes, not fixed windows.

### Step 3: fit the regime model

`finmem/memory/regime.py` fits a Gaussian HMM on:

- 1-day SPY return
- 21-day rolling volatility
- VIX
- CPI
- Fed rate
- yield spread

The HMM learns hidden market states over time.

Those states are mapped to readable regimes:

- `STABLE`
- `BULL`
- `CRISIS`
- `SELLOFF`
- `TIGHTENING`
- `TIGHTENING+SLOWDOWN`
- `EASING+RECOVERY`

### Step 4: compute episode statistics

For each episode, FinMem computes:

- start date
- end date
- duration
- average daily return
- total return
- max drawdown
- rolling volatility
- VIX level
- CPI
- Fed rate
- yield spread
- unemployment
- 1-month forward return
- 3-month forward return
- 6-month forward return

### Step 5: generate a prose summary

GPT-4o-mini writes a short factual episode summary.

If that fails, a template summary is used.

### Step 6: create the hybrid embedding

`finmem/memory/embeddings.py` turns the episode into a 519-dimensional vector:

- 7 structural features
- 512 text-embedding dimensions

### Step 7: store the episode

`finmem/memory/store.py` stores the episode in LanceDB with:

- metadata
- summary
- regime
- returns
- drawdown
- embedding vector

That is the long-term episodic memory.

---

## 7. Why These Algorithm Choices Were Made

### Why PELT

PELT is used because it finds real regime breaks in the data.

Why that is better than fixed windows:

- markets do not switch on calendar boundaries
- a 90-day calm period and a 90-day crisis are not equivalent
- the project wants structural episodes, not arbitrary slices

PELT is a standard changepoint algorithm from research, not a custom heuristic.

### Why HMM

The HMM is used because market regimes are hidden states that evolve over time.

It is better than a pure clustering model because:

- it respects time order
- it models transitions between states
- it gives interpretable regime labels

### Why hybrid embeddings

Numbers alone are too rigid.
Text alone is too loose.

So FinMem combines:

- structural numeric features
- semantic summary text

This helps retrieval match both market shape and market story.

### Why whitening

Raw embeddings tend to share a dominant common direction.

All-but-the-top whitening removes that shared direction so cosine similarity becomes more discriminative.

### Why LanceDB

LanceDB is a simple local vector store that fits the current scale.

It is enough for:

- episode storage
- vector retrieval
- offline analysis

### Why confidence gating

FinMem must refuse weak analogs instead of always answering.

That is important because in finance, a confident wrong answer is worse than a refusal.

---

## 8. How Memory Is Represented

FinMem stores each episode in two forms.

### Structured memory

The numeric side:

- returns
- volatility
- macro state
- regime
- forward outcomes

### Semantic memory

The text side:

- the prose episode summary

### Why both matter

- structured memory captures exact market shape
- semantic memory captures the narrative meaning

The system needs both to retrieve better analogs.

---

## 9. How Retrieval Works

The retrieval path is in `finmem/memory/retrieval.py`.

### Input

The live query is a `MarketState` built from the latest row of data.

### Step 1: embed today

Today’s market state is embedded using the same logic as the episode embeddings.

### Step 2: whiten the query

The query vector is transformed with the same whitening step used on the episode vectors.

### Step 3: compute similarity

Cosine similarity is computed between today and every episode.

### Step 4: rerank

Scores get small adjustments:

- regime match bonus
- recency penalty for very old episodes

### Step 5: confidence

The top score is used to decide whether the analog is strong enough.

Thresholds:

- `>= 0.27` strong analog
- `0.15 to 0.27` moderate analog
- `< 0.15` no confident analog

This is the refusal mechanism.

---

## 10. How Reasoning Works

The reasoning layer is in `finmem/reasoning/engine.py`.

### Important rule

The LLM is not allowed to answer from general market memory.

It only sees the retrieved episodes.

### Prompt behavior

The prompt forces the model to:

- use only retrieved episodes
- cite episode date ranges
- include similarity scores
- stay concise
- acknowledge uncertainty
- end with a source line

### Why this matters

This prevents the model from producing a plausible but ungrounded market explanation.

### Fallback behavior

If the OpenAI call fails, the system returns a templated response from the retrieved episodes.

That keeps the app functional even if the LLM is unavailable.

---

## 11. Backend API

`api/main.py` is the FastAPI backend.

Important endpoints:

- `GET /api/state`
- `GET /api/memory`
- `GET /api/episodes`
- `GET /api/episodes/search`
- `GET /api/episodes/export`
- `GET /api/episodes/{episode_id}`
- `GET /api/episodes/{id1}/compare/{id2}`
- `POST /api/chat/stream`
- `GET /api/episodes/{episode_id}/precursors`
- `GET /api/regime-transitions`
- `GET /api/precursor-frequencies`
- `GET /api/outcomes/distribution`
- `GET /api/data-quality`
- `GET /api/health`
- `GET /api/eval/calibration`
- `GET /api/eval/compression`

### API behavior worth mentioning

- market data is cached locally in `data/market_cache.parquet`
- chat is streamed via SSE
- CORS is restricted through `ALLOWED_ORIGIN`
- chat uses rate limiting

---

## 12. Frontend

The frontend is a Next.js app in `web/`.

### Public page

`web/app/page.tsx` is the marketing landing page.

### App shell

`web/components/SidebarLayout.tsx` creates the workspace shell.

### Workspace components

- `ChatPanel.tsx`
- `EpisodeMatches.tsx`
- `MarketState.tsx`
- `MacroPanel.tsx`

### API client

`web/lib/api.ts` handles browser-side fetching and streaming.

The UI is designed to show:

- current state
- historical analogs
- confidence
- outcomes
- data quality

---

## 13. Evaluation and Success Criteria

FinMem is evaluated as a retrieval system, not as a prediction engine.

### `eval/benchmark.py`

- 20 questions
- GPT-4o judge
- compares:
  - FinMem RAG
  - fixed 90-day window
  - prompt-only baseline

Metrics:

- average quality
- grounded percentage
- latency p50/p95

### `eval/latency.py`

- measures retrieval latency
- reports p50/p95/mean/min/max

### `finmem/reasoning/confidence.py`

- checks whether the system should answer or refuse

### Success criteria

FinMem succeeds if it:

- retrieves grounded analogs
- refuses weak cases
- beats baselines on quality
- keeps latency reasonable
- remains inspectable

---

## 14. Gaps and Limitations

You should be honest about these in interviews.

- only daily data, no intraday data
- no news or earnings
- no options surface
- no cross-asset features beyond the current set
- PELT boundary detection is a modeling choice
- HMM regime labels can shift on re-ingest
- retrieval is brute-force cosine scan, fine for current scale but not large scale
- recent episodes have incomplete future outcomes
- some UI copy still reflects older wording from an earlier phase

These are not fatal problems.
They are the natural limits of the current version.

---

## 15. The Definitive Toy Example

Use this example if you need to explain the full system end to end.

### User query

> “What happened after yield curve inversions deeper than -0.30%?”

### Step A: current state

The system reads today’s market snapshot:

- SPY return is weak
- VIX is elevated
- CPI is still high
- Fed rate is high
- yield spread is negative
- unemployment is rising slightly

This becomes a `MarketState`.

### Step B: embedding

The market snapshot is converted into the same 519-number fingerprint format used for episodes.

### Step C: retrieval

The system compares today’s fingerprint with every historical episode fingerprint.

Suppose the top episodes are:

- `2006-07 → 2007-01`
- `2019-08 → 2020-02`
- `2000-02 → 2000-09`

### Step D: reranking

If one of those episodes has the same regime as today, it gets a bonus.

If one is very old, it gets a small penalty.

### Step E: confidence gate

Suppose the top score is `0.31`.

That is above the strong threshold, so FinMem is allowed to answer.

If it were `0.12`, FinMem would refuse.

### Step F: reasoning

GPT-4o receives only those retrieved episodes and their summaries.

It might produce:

> Historical analogs show that deep yield-curve inversions often happened in tightening environments. The 2006-07 episode was followed by weakness, while the 2019 analog was more resilient in the short run. Confidence is moderate-to-strong because the analogs are structurally similar but not identical.  
> Source: [2006-07 → 2007-01] sim 0.31

### What the user learns

- which old periods looked similar
- how similar they were
- what happened afterward
- whether the answer is confident or not

That is the product.

---

## 16. The Main Technical Decisions, With Interview-Ready Reasons

### PELT

Why:

- find actual market change points
- avoid arbitrary fixed windows

### HMM

Why:

- regimes are hidden
- regimes evolve over time
- the output is interpretable

### Hybrid embeddings

Why:

- numbers capture structure
- text captures semantic meaning

### Whitening

Why:

- raw embeddings have a dominant common direction
- whitening makes similarity more useful

### LanceDB

Why:

- simple vector store
- good enough for current scale

### Confidence thresholds

Why:

- refusal is better than confident nonsense

### GPT-4o-mini summaries

Why:

- cheap enough for ingest
- good enough for concise episode summaries

### GPT-4o reasoning

Why:

- strong instruction following
- good for grounded response generation

---

## 17. What To Say In One Breath

FinMem is a retrieval-first financial research system that loads daily market and macro data, splits history into structural episodes with PELT, labels them with a Gaussian HMM regime model, summarizes and embeds them into a vector memory, retrieves the closest historical analogs to today’s market state, and only lets the model answer when the analog is strong enough to trust.

