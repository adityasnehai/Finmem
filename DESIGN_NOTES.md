# FinMem — Design Notes

> Technical notes on architecture decisions, evaluation results, and open questions.
> Written to document the reasoning behind design choices, not just the choices themselves.

---

## What Is FinMem

FinMem is an episodic memory system for financial markets. It detects structural market regimes from historical price and macro data, stores each episode as a hybrid embedding, and retrieves the most similar historical analogs when queried with current conditions. Every answer is grounded in specific retrieved episodes, with similarity scores and confidence reported.

The system has a natural-language chat interface backed by episodic retrieval, a regime memory browser, a market state monitor, and a calibrated evaluation suite.

---

## Architecture Decisions (and why)

### Why retrieval over fine-tuning?

Fine-tuning a language model on market history would encode knowledge into weights — opaque, hard to update, and unciteable. The goal here is *cited* reasoning: "the 6-month return after this type of episode was +14% in 2009 and -8% in 2001." Retrieval makes the evidence chain explicit and auditable. When the retrieval fails, the system refuses rather than hallucinating.

Relationship to research question 5 (model vs agent vs context vs runtime): this is a deliberate choice of **context** (retrieval augmentation) over **model** improvement, because the limiting factor in financial reasoning is data freshness and citability, not raw model capability.

### Why episodic segmentation over a fixed window?

A fixed 90-day window treats all 90-day periods as equivalent. A 90-day window in March 2020 (COVID crash) and January 2017 (quiet drift) have very different structural meanings. PELT changepoint detection on daily returns and volatility finds the structural boundaries, producing episodes that correspond to real market regimes. This makes the memory semantically organized rather than arbitrarily sliced.

### Why a hybrid embedding (structural + text)?

The structural features — VIX, CPI, Fed rate, yield spread, unemployment, daily return, vol — are the direct predictors of forward outcomes. Text summaries generated from these features via GPT-4o-mini add a semantic representation of the episode.

**What we found:** struct-only (7-dim) achieves 71.8% directional accuracy vs hybrid (391-dim) at 69.0%. The text component as implemented with a general-purpose MiniLM model slightly hurts performance because financial summaries use near-identical vocabulary across regimes, causing the text embeddings to cluster tightly and dilute discriminative signal. The optimal weighting is currently under study (see Open Questions).

---

## Evaluation Results

### Calibration — leave-one-out on 71 episodes with known 6-month outcomes

| Metric | Value | Notes |
|---|---|---|
| Directional accuracy | **74.7%** | vs 50% random baseline |
| Bootstrap 95% CI | [62.0%, 84.5%] | 2,000 samples, seed=42 |
| Brier score | 0.186 | lower = better; 0 = perfect |
| MAE | ~9.5 pp | mean absolute error on return magnitude |
| ECE | ~0.15 | expected calibration error after whitening |

*Methodology: for each episode E, query the system using E's embedding, retrieve top-5 excluding E, predict direction from weighted neighbor returns, compare to actual 6-month outcome. No data outside the stored episodes is used.*

**Key finding pre-whitening:** Before applying the all-but-the-top transform, all 71 episodes clustered into a single similarity bin [0.8, 1.0] (mean cosine sim = 0.867). The confidence gate thresholds (0.45, 0.65) were structurally disabled — every query appeared high-confidence. Directional accuracy was 67.6% but ECE was 0.303, indicating severe overconfidence.

### Embedding isotropy fix — all-but-the-top (Mu & Viswanath, ICLR 2018)

The 391-dim embedding space had effective rank 4.3/71 — the first principal component explained 59% of variance alone. This "global financial episode direction" dominated cosine similarity, making all episodes look similar to each other.

Removing the top-1 PC and re-normalizing:

| | Before | After |
|---|---|---|
| Random pair cosine sim (mean) | 0.867 | −0.044 |
| Random pair cosine sim (std) | 0.090 | 0.433 |
| Directional accuracy | 69.0% | **74.7%** |
| Effective rank | 4.3 | ~12 |

The transform is computed once at startup (PCA fit on stored vectors), cached in memory, and applied to every query vector at retrieval time. No re-indexing required. O(N·D) per query where N=72, D=391 — ~0.1ms.

### Compression ablation — PCA on stored 391-dim embeddings

| Dim | Recall@5 vs full | Dir. accuracy | Storage | Latency |
|---|---|---|---|---|
| 391 (full) | 100% | 74.7% | 112 KB | baseline |
| 64 | 83.7% | 64.8% | 18 KB | −61% |
| 32 | 83.7% | 64.8% | 9 KB | −69% |
| 16 | 84.5% | 66.2% | 4.5 KB | −73% |
| 8 | 80.6% | 70.4% | 2.2 KB | −77% |

*Recall@5 measures how many of the full system's top-5 are retained at each compression level.*

**Key finding:** ~84% retrieval quality is preserved down to 8 dimensions, with only 2.2 KB storage per episode set. However, downstream directional accuracy does not follow Recall@5 monotonically — the 8-dim system has higher directional accuracy than 16/32/64-dim, likely because PCA at 8 dims retains only the strongest structural signal and discards noisy text-embedding variance. This suggests the optimal compressed representation sits around 8–16 dims for this dataset.

The capability-vs-compression curve has no sharp cliff — capability degrades smoothly. For production deployment under memory constraints, 32-dim is a reasonable sweet spot: 83.7% retrieval quality at 1/12 the storage.

---

## Memory Representation (Research Question 1)

Episodes are detected using PELT (Pruned Exact Linear Time) changepoint detection on the joint signal of daily SPY returns and 21-day rolling volatility. Each structural breakpoint corresponds to a regime transition in the market.

Each episode stores:
- **Price features**: total return, max drawdown, daily return mean, rolling vol
- **Macro features at episode start**: VIX, CPI, Fed funds rate, 10Y-2Y yield spread, unemployment
- **Forward outcomes**: SPY return 1M, 3M, 6M after episode end
- **Regime label**: CRISIS / SELLOFF / TIGHTENING / TIGHTENING+SLOWDOWN / EASING+RECOVERY / BULL / STABLE
- **Prose summary**: generated via GPT-4o-mini from macro features
- **Embedding**: 391-dim hybrid (7-dim structural + 384-dim text), whitened at query time

The regime label is rule-based (if VIX > 35 → CRISIS, etc.) rather than learned — a known limitation that creates ambiguous boundaries, particularly between STABLE and EASING+RECOVERY which share similar VIX ranges.

---

## Chat Interface (Research Question 3)

The chat page is a natural-language interface directly into the episodic memory. Every query triggers a retrieval against current market conditions, returning the top-5 most similar historical episodes with similarity scores, regime labels, and 6-month outcomes. The LLM reasons *only* from these retrieved episodes and is instructed to cite episode dates and similarity scores in every response.

A confidence gate refuses to generate an answer when retrieval confidence is below threshold, preventing hallucination in novel conditions with no historical analog. The gate fires a refusal message rather than a low-quality answer.

---

## Safe Autonomy and Observability (Research Question 4)

Three mechanisms implement safe autonomy:

1. **Confidence gate**: retrieval below threshold → explicit refusal, not a low-quality answer
2. **Calibration metrics**: directional accuracy and Brier score are computed offline (leave-one-out) so the system's reliability is quantified, not assumed
3. **Source attribution**: every answer cites the specific episodes it was derived from, making the reasoning chain fully auditable

**Known gap:** the confidence gate uses absolute similarity thresholds (0.45, 0.65). Post-whitening, the similarity distribution is spread across [−0.9, 1.0], making these thresholds meaningful again. A more principled approach would use conformal prediction (Angelopoulos & Bates, ICLR 2023) to set thresholds that guarantee a specified error rate on a held-out calibration set.

---

## Limitations

- **Sample size**: N=72 episodes limits statistical power. Bootstrap CIs are wide. Production-quality calibration would require 500+ episodes.
- **Regime boundary ambiguity**: rule-based regime assignment creates fuzzy boundaries. STABLE and EASING+RECOVERY share similar VIX ranges (both ~19.8 average). A learned regime classifier would be more robust.
- **Text embedding domain mismatch**: MiniLM was trained on general-purpose text. Financial summaries use near-identical vocabulary across regimes, causing the text component to dilute structural signal. Domain-adaptive embeddings (INSTRUCTOR, E5) with task-specific instructions would likely improve the text component's contribution.
- **No live deployment**: calibration is measured offline (leave-one-out on historical episodes). Live accuracy — whether retrieval quality holds against actual future market outcomes — is not yet measurable.
- **Single asset**: the current system tracks SPY only. Multi-asset regime detection would surface episodes that are sector- or factor-specific.

---

## Open Questions

1. **Optimal embedding weights**: struct-only outperforms hybrid (71.8% vs 69.0%) with the current MiniLM text encoder. Does INSTRUCTOR with an explicit retrieval-task instruction recover the text component's value? If so, what is the optimal weight ratio?

2. **Where does compression fail?**: The capability curve shows no cliff between 8–64 dims. Is this because the structural signal lives in a low-dimensional subspace anyway (effective rank ~4 before whitening), or because the eval set is too small to detect degradation? A larger episode set would answer this.

3. **Conformal confidence calibration**: replacing absolute similarity thresholds with conformal prediction guarantees would make the confidence gate formally calibrated. Is the marginal safety improvement worth the complexity over a simple percentile-based threshold?

4. **Regime learning vs rule-based**: would a hidden Markov model or clustering-based regime detector produce better episode boundaries than the current rule set? The ambiguity between STABLE and EASING+RECOVERY (where 7/18 predictions are wrong) suggests the boundary matters.

5. **Live deployment gap**: the central unanswered question. The offline leave-one-out evaluation shows 74.7% directional accuracy. Does this hold when applied to today's market and verified 6 months later? Building a live prediction tracker — store each retrieval with predicted direction, verify against actual outcome — would close this gap.

---

## Technical Stack

| Layer | Technology | Why |
|---|---|---|
| Episode detection | PELT (ruptures) | Exact linear-time changepoint detection on return + vol signal |
| Macro data | FRED API, yfinance | Primary sources for CPI, Fed rate, yield curve, unemployment, SPY |
| Embedding | 7-dim structural + MiniLM-L6-v2 (384-dim) | Hybrid of hard numeric features and semantic summary |
| Isotropy fix | All-but-the-top (ICLR 2018) | Post-hoc, no retraining, +5.7pp measured improvement |
| Vector store | LanceDB | Columnar, embedded, no server required |
| LLM reasoning | GPT-4o (streaming) | Instruction-followed, cited, grounded reasoning |
| API | FastAPI + uvicorn | Async streaming for chat, synchronous for data endpoints |
| Frontend | Next.js 16, Tailwind CSS, Recharts | Type-safe, SSR-ready, chart library with Recharts |
| Auth | JWT + bcrypt (file-based users) | Stateless, no database dependency |

---

*Last updated: 2026-05-20*
