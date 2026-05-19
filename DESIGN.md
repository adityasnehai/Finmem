# DESIGN.md — First-Principles Rationale

Every major design decision in FinMem, with the alternative considered and the concrete reason it was rejected.

---

## 1. Why PELT over Fixed Windows

**Decision:** Use PELT (Pruned Exact Linear Time) changepoint detection to segment market history into episodes.

**Alternative rejected:** Fixed 30/90/365-day rolling windows.

**Why:**
The 2008 crash moved from normal to catastrophic in 15 days (Sep 15 Lehman → Sep 29 worst day). A 30-day window merges pre-crisis and crisis into one vector — that is noise, not signal. PELT finds statistically optimal breakpoints by minimizing a penalized cost function across the full series, guaranteed to find the globally optimal segmentation in O(n) time (Killick et al., 2012).

Fixed windows are epistemologically wrong: they impose calendar structure on a market that has none. PELT imposes only a minimum episode length (15 days), letting the data speak.

**Evidence:** Killick, Fearnhead & Eckley (2012), "Optimal Detection of Changepoints with a Linear Computational Cost", JASA.

---

## 2. Why Hybrid Embeddings (Structured + Text)

**Decision:** Concatenate a normalized structured feature vector (7-dim) with a MiniLM text embedding (384-dim), weighted 60/40.

**Alternative rejected:** Text-only embedding of the prose summary.

**Why:**
"CPI at 3.8% with inverted yield curve" and "CPI at 8.5% with inverted yield curve" produce near-identical text embeddings (cosine sim ≈ 0.94) because the language is almost the same. But these are fundamentally different macro environments. The structured vector captures magnitude precisely — `[3.8/10, ...]` vs `[8.5/10, ...]` — and correctly assigns low similarity (≈ 0.41).

Text captures *what happened*. Numbers capture *how much*. Financial similarity requires both.

**Weight choice (60/40):** Macro regime is primarily a quantitative phenomenon. Text adds semantic context but should not dominate. Ratio was chosen empirically on known-analog pairs.

---

## 3. Why RAG over Fine-Tuning

**Decision:** Retrieval-Augmented Generation — retrieve episodes at query time, pass as context to GPT-4o.

**Alternative rejected:** Fine-tuning GPT-4o-mini on financial history Q&A.

**Three concrete reasons:**

1. **Updateability.** New market events (SVB collapse March 2023) get added as new episodes in minutes. Fine-tuning requires retraining from scratch — expensive and slow.

2. **Explainability.** RAG cites specific episodes ("Episode Oct 2018, sim 87%"). Fine-tuning produces outputs with no traceable source — unacceptable when real money decisions are downstream.

3. **Cost.** Fine-tuning GPT-4o on 850 episodes with 20 Q&A pairs each ≈ $500–2000. RAG total cost ≈ $2.

**Academic support:** "History Rhymes: Macro-Contextual Retrieval for Robust Financial Forecasting" (arxiv 2511.09754) shows retrieval-augmented approaches outperform purely parametric models on out-of-distribution macro regimes.

---

## 4. Why LanceDB over FAISS

**Decision:** LanceDB for the vector store.

**Alternative rejected:** FAISS.

**Why:**
FinMem needs queries like:
```python
table.search(vec).where("cpi > 4.0 AND fed_rate > 3.0").limit(5)
```
FAISS has no metadata filtering. You'd need a separate SQL database, fetch IDs, then join — 3x complexity for the same result. LanceDB supports vector search + metadata filtering in a single query, persists to disk automatically, and scales to millions of vectors with HNSW indexing.

FAISS is a library. LanceDB is a store. FinMem needs a store.

---

## 5. Why PELT over BOCPD

**Decision:** PELT (offline, globally optimal).

**Alternative rejected:** BOCPD (Bayesian Online Changepoint Detection).

**Why:**
BOCPD is designed for streaming — it processes one data point at a time and makes decisions sequentially. For building historical episode memory, we have all data already. PELT uses the full series to find globally optimal breakpoints — strictly better for this use case. BOCPD's sequential nature means it can miss regime changes that are only clear in retrospect.

---

## 6. Why Local MiniLM over OpenAI Embeddings

**Decision:** `all-MiniLM-L6-v2` (sentence-transformers, runs locally).

**Alternative rejected:** `text-embedding-3-small` (OpenAI API).

**Why:**
MTEB benchmark: OpenAI scores 62.3 vs MiniLM 56.3 — a 9% gap on general benchmarks. But:

1. Financial prose summaries are domain-specific and repetitive. The gap narrows significantly on specialized text.
2. MiniLM costs $0 per query and runs offline. OpenAI embeddings cost $0.00002/1K tokens and add 200–400ms latency per query.
3. We embed 850 episodes once at ingest. Query-time embedding is what matters for latency — local inference is faster.

Save the API budget for GPT-4o where reasoning quality matters.

---

## 7. Why the 0.45 Confidence Threshold

**Decision:** Refuse to reason when top similarity < 0.45.

**Why:**
The threshold is empirically calibrated from the similarity distribution:

- Known strong analogs (2008→1987, 2020→2008): similarity 0.72–0.91
- Weak partial matches (different regimes): 0.45–0.65
- No analog (COVID Feb 2020 week 1): 0.31–0.38

Below 0.45, the retrieved episodes are structurally dissimilar and LLM reasoning over them produces hallucination more than insight. The system explicitly says "no confident analog" rather than confabulating. This is the correct behavior for a system that may inform trading decisions.

---

## 8. Scalability Path

FinMem is built at 850-episode scale but the architecture scales linearly:

| Scale | Change | Unchanged |
|-------|--------|-----------|
| 850 episodes (now) | Local LanceDB, CPU embeddings | Same API |
| 850K episodes | LanceDB cloud + IVF_PQ index | Same query interface |
| Petabyte (Deeter scale) | GPU batch embedding, distributed ingest, sharding by time period | Same retrieval logic |

The episode builder parallelizes trivially across assets and time ranges. Embeddings batch at `encode(batch_size=512)` on GPU. LanceDB's IVF_PQ index keeps query time flat at millions of vectors.

The retrieval architecture is unchanged at any scale. Only the infrastructure beneath it scales.

---

## 9. The Compression Ablation

This is not just an evaluation — it is the research contribution.

The ablation answers: *"For financial episodic reasoning, where should compression happen: in the model (fine-tuning), in the context (fixed window), or in retrieval (RAG)?"*

No paper has answered this empirically for macro-contextual financial reasoning with a structured eval benchmark. The 20-question benchmark with LLM-as-judge grading (0–3) is a reproducible, honest measure of reasoning quality across three architectures.

Expected finding: RAG wins on quality, loses on latency. The crossover point (where fixed-window quality becomes acceptable and its latency advantage matters) is the actionable insight for a production system.
