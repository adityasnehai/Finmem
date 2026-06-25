# FinMem Complete Guide

This document explains the FinMem project in the order the system actually works:

1. Why the project exists
2. What data it uses
3. How data becomes episodes
4. How episodes become memory
5. How retrieval works
6. How reasoning and refusal work
7. What the user sees
8. What problems this solves
9. What gaps still remain

---

## 1. What Problem FinMem Solves

FinMem is built for the case where a user wants to understand the current market by comparing it to historical market conditions, not by asking a language model to invent an answer from memory.

The problem it targets:

- financial history is long and repetitive in structure
- naive LLM answers can sound confident while being ungrounded
- simple recency windows miss older but more relevant analogs
- keyword search misses structurally similar periods that are described differently

So the project asks a different question:

- not "what do you predict?"
- but "when have conditions like this happened before, and what happened next?"

That is the core product idea.

---

## 2. What Data We Used

FinMem uses daily market and macro data.

### Market data

- `SPY` from Yahoo Finance
- `^VIX` from Yahoo Finance

### Macro data from FRED

- CPI: `CPIAUCSL`
- Fed funds rate: `FEDFUNDS`
- 10Y-2Y yield spread: `T10Y2Y`
- Unemployment: `UNRATE`

### Time coverage

- starts from `1993-01-01`
- extends to the latest available local cache / fetched date

### Why these signals

These signals capture a market state at a useful level:

- SPY tells you the equity market direction
- VIX tells you stress / implied volatility
- CPI tells you inflation pressure
- Fed funds rate tells you policy stance
- yield spread tells you curve shape and recession pressure
- unemployment tells you labor-market weakening or strength

This combination is enough to describe broad macro regimes without making the system too large.

---

## 3. What Kind of Data It Is

The project works with a mixture of:

- daily numerical time series
- forward-filled monthly macro data
- derived return features
- segmented historical episodes
- text summaries of episodes
- vector embeddings of those summaries and features

So the final system is not just a database of raw prices.
It is a memory system built from structured financial history.

---

## 4. The Data Pipeline In Sequence

The ingest flow is implemented in `scripts/ingest.py`.

### Step 1: load market data

`finmem/data/loaders.py`:

- downloads SPY price and volume
- downloads VIX
- pulls macro series from FRED
- forward-fills macro data to daily frequency
- computes derived features

Derived features include:

- `spy_return_1d`
- `spy_return_5d`
- `spy_return_21d`
- `rolling_vol_21d`
- CPI year-over-year change

### Step 2: merge into one daily table

The result is a single daily dataframe with:

- SPY price
- SPY returns
- VIX
- CPI
- Fed rate
- yield spread
- unemployment
- rolling volatility

This dataframe is the base input to the rest of the system.

### Step 3: fit the regime model

`finmem/memory/regime.py` fits a Gaussian HMM on:

- 1-day SPY return
- 21-day rolling volatility
- VIX
- CPI
- Fed rate
- yield spread

The model has 7 latent states.

Those hidden states are mapped to named regimes:

- `STABLE`
- `BULL`
- `CRISIS`
- `SELLOFF`
- `TIGHTENING`
- `TIGHTENING+SLOWDOWN`
- `EASING+RECOVERY`

### Step 4: detect episode boundaries

`finmem/data/episode_builder.py` uses PELT changepoint detection on:

- daily SPY return
- rolling volatility

This splits the full history into market episodes.

The goal is to find structural changes in behavior, not arbitrary fixed windows.

### Step 5: compute episode statistics

For each episode, the system computes:

- start date
- end date
- duration
- average daily return
- total return
- max drawdown
- rolling volatility
- average VIX
- CPI at episode start
- Fed rate at episode start
- yield spread at episode start
- unemployment at episode start
- 1-month forward return
- 3-month forward return
- 6-month forward return

### Step 6: assign regime labels to each episode

The episode range is passed through the HMM model to get a regime label.

This gives each episode a macro interpretation.

### Step 7: generate a prose summary

The system asks GPT-4o-mini to produce a short factual summary of the episode.

If that call fails, a template summary is used instead.

### Step 8: create the hybrid embedding

`finmem/memory/embeddings.py` builds a 519-dimensional vector:

- 7 structural features
- 512 text-embedding dimensions

The structural part is normalized and weighted.
The text part is embedded from the prose summary.
The two are concatenated and normalized.

### Step 9: store in LanceDB

`finmem/memory/store.py` stores each episode as a row in LanceDB with:

- metadata
- statistics
- regime
- summary
- embedding vector

That is the finished episodic memory.

---

## 5. What We Extracted From The Raw Data

From the original time series, the project extracts features at three levels.

### Market movement features

- daily return
- 5-day return
- 21-day return
- total episode return
- max drawdown
- rolling volatility

### Macro state features

- VIX
- CPI
- Fed funds rate
- yield spread
- unemployment

### Future outcome features

- SPY return 1 month after episode
- SPY return 3 months after episode
- SPY return 6 months after episode

### Semantic features

- prose summary of what the episode looked like

These features matter because the project is not just doing retrieval by date.
It is trying to retrieve by market shape and outcome.

---

## 6. How Memory Is Represented

FinMem stores memory in two forms.

### Structured memory

The structured side is the numeric feature set:

- returns
- volatility
- macro state
- regime
- forward outcomes

### Semantic memory

The prose summary gives the episode a language representation.

That helps the system match episodes that are numerically similar and also contextually similar.

### Why both are needed

If you only use structured numbers:

- you can miss semantic similarity
- descriptions become too rigid

If you only use text:

- you lose the hard numeric structure
- similar market regimes can get blurred

FinMem combines both.

---

## 7. How Retrieval Works

The retrieval path is in `finmem/memory/retrieval.py`.

### Query input

The live query is a `MarketState` built from the latest row of market data.

### Step 1: embed today's state

The query state is embedded using the same hybrid embedding logic as episodes.

### Step 2: whiten the query

FinMem applies the same all-but-the-top transform used on the stored episode vectors.

This removes the dominant shared direction in market embeddings.

### Step 3: compute cosine similarity

The query vector is compared with every episode vector.

### Step 4: rerank

The candidate scores are adjusted by:

- regime match bonus
- old-episode penalty

This makes the final result more useful than pure cosine similarity alone.

### Step 5: confidence score

The top result determines whether the system believes there is a valid analog.

Thresholds:

- strong analog: `>= 0.27`
- weak / moderate analog: `0.15 to 0.27`
- no analog: `< 0.15`

This is the refusal mechanism.

---

## 8. How Reasoning Works

The reasoning layer is in `finmem/reasoning/engine.py`.

### Important rule

The LLM does not get to answer from general knowledge.
It only sees retrieved episodes.

### Prompt behavior

The prompt tells the model to:

- reason only from retrieved episodes
- cite episode date ranges
- include similarity scores
- stay concise
- acknowledge uncertainty
- end with a source line

### Why this matters

This reduces hallucination and keeps the answer grounded in actual history.

### Fallback behavior

If the OpenAI call fails, the system returns a templated answer from the retrieved episodes rather than silently breaking.

---

## 9. A Concrete User Example

Example user question:

> What happened after yield curve inversions deeper than -0.30%?

### What the user sees

1. The user types the question in chat.
2. The app fetches the current market state.
3. The system retrieves the closest historical episodes.
4. The UI shows top analogs, confidence, and latency.
5. The answer comes back with citations to specific episode date ranges.

### What happens inside the system

#### A. Current market snapshot

The API builds a `MarketState` from the latest market row.

That includes:

- SPY price
- 1d / 5d / 21d returns
- VIX
- CPI
- Fed rate
- yield spread
- unemployment
- rolling volatility

#### B. Retrieval

The snapshot is embedded and compared to all historical episodes.

The top matches might be things like:

- 2006-07 to 2007-01
- 2019-08 to 2020-02
- 2000-02 to 2000-09

#### C. Confidence gate

If the top match is weak, FinMem refuses.
If it is moderate, it adds a warning.
If it is strong, it answers normally.

#### D. Reasoning

The LLM summarizes what the matched episodes suggest.

It may say:

- some inversion episodes led to recessionary drawdowns
- others produced short-term resilience before later weakness
- outcomes are mixed, so the analog is informative but not deterministic

#### E. User output

The user sees:

- the natural-language answer
- cited episode date ranges
- similarity score
- confidence score
- historical outcomes

This is the product experience.

---

## 10. What The User Sees In The Product

There are two main surfaces.

### Public landing page

The web landing page explains:

- the concept
- why retrieval-first beats raw LLM memory
- how the workflow works
- why confidence matters

### Workspace

The app workspace gives access to:

- today's analogs
- episode browser
- chat
- analytics
- data quality
- comparison views

The workspace is built to make the system inspectable, not opaque.

---

## 11. Main Features

### Today

Shows the current market state and the closest historical analogs.

### Episode Browser

Lets you inspect all historical episodes, filter by regime, and review outcomes.

### Chat

Lets you ask free-form historical questions and get grounded answers.

### Analytics

Benchmarks the quality and latency of retrieval strategies.

### Precursor / transition analysis

Shows what signals tend to precede regime shifts.

### Data quality dashboard

Shows coverage, completeness, and date range.

### Export and compare

Lets you compare two episodes and export episode data.

---

## 12. What The Architecture Is Doing Well

The design has a few good properties.

### It separates memory from reasoning

The memory layer retrieves.
The LLM explains.

### It is grounded

Every answer is tied to historical episodes.

### It is calibrated

There is a refusal threshold.

### It is inspectable

The user can see the analogs, the score, and the data.

### It is modular

Data, memory, retrieval, reasoning, API, and frontend are separated.

---

## 13. What Gaps or Weaknesses Still Exist

This is the part that matters if you want to explain the project honestly.

### Limited data source coverage

The system uses daily SPY, VIX, and a few macro series.
It does not yet use:

- intraday data
- order flow
- earnings
- options surface
- news
- cross-asset factors

### Episode segmentation is approximate

PELT finds structural changes, but episode boundaries are still a modeling choice.

### HMM labels are interpretable but imperfect

The state mapping is deterministic, but latent regimes can still shift on re-ingest.

### Retrieval is brute force

The current vector search is fine at this scale, but it will not scale forever.

### Forward returns are incomplete for recent episodes

Episodes in the last 6 months cannot yet have full 6-month forward outcomes.

### UI copy is not perfectly synchronized

Some marketing components still reflect older wording from an earlier project stage.

### The project is historical analog research, not prediction

That is a deliberate limitation.
It is not trying to be a trading signal engine.

---

## 14. Why This Is Non-Trivial

This is not just:

- a chat app
- a dashboard
- a retrieval demo

It is an end-to-end system that does:

- market data ingestion
- regime modeling
- changepoint segmentation
- summarization
- embedding
- vector retrieval
- reranking
- confidence gating
- streaming reasoning
- evaluation and benchmarking
- frontend presentation

That is the full product.

---

## 15. The One-Line Mental Model

FinMem takes daily market history, breaks it into meaningful episodes, stores those episodes as memory, retrieves the closest historical analogs to today's market, and only lets the model speak when the analog is strong enough to trust.

