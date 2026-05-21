# FinMem — Complete Product & Engineering Context

> Bring this file into any Claude conversation to get full context on the FinMem project.

---

## What Is FinMem?

FinMem is a **Financial Episodic Memory System** — a research tool that answers market questions by finding the most structurally similar historical periods ("episodes") to today's conditions. Instead of generic analysis, it retrieves real precedents and shows what actually happened next.

**Example queries it answers:**
- "What happened after yield curve inversions deeper than -0.30%?"
- "Find episodes where VIX exceeded 30 and Fed was cutting"
- "Closest analog to the 2020 COVID crash?"
- "How did markets behave 6 months after CPI peaked above 8%?"

The key differentiator: every answer is **grounded in retrieved episodes** with explicit similarity scores and confidence levels, not hallucinated generics.

---

## Current Status

- **Backend**: FastAPI (Python) — fully working, running on port 8000
- **Frontend**: Next.js 16 (TypeScript) — fully working, running on port 3000
- **Database**: LanceDB (vector store) at `finmem_db/` — 72 episodes indexed
- **PostgreSQL**: Also used for precursor indicators, regime transitions, auth
- **Auth**: JWT-based with bcrypt, users stored in `data/users.json`
- **Episode count**: 72 (dynamically ingested, not hardcoded)
- **Date coverage**: 1993–2026 (live data from yfinance + FRED)

---

## Project Structure

```
FinMem/
├── api/
│   └── main.py              # Single FastAPI app — ALL active endpoints here
├── finmem/
│   ├── data/
│   │   ├── loaders.py        # Fetches SPY, VIX, CPI, FEDFUNDS, T10Y2Y, UNRATE
│   │   ├── schemas.py        # Pydantic: MarketState, Episode, RetrievalResult, QueryResult
│   │   └── episode_builder.py # PELT changepoint detection → episode segmentation
│   ├── memory/
│   │   ├── store.py          # LanceDB read/write (DB_PATH = finmem_db/)
│   │   ├── embeddings.py     # Hybrid embedding: 60% structural + 40% text (all-MiniLM-L6-v2)
│   │   └── retrieval.py      # Cosine similarity search + re-ranking
│   └── reasoning/
│       ├── engine.py         # (legacy, not used by active API)
│       └── confidence.py     # Confidence gate: HIGH ≥0.65, MEDIUM ≥0.45, LOW <0.45
├── finmem_db/               # LanceDB vector store (active)
├── scripts/
│   └── ingest.py            # Full pipeline: load_all() → build_episodes() → store_episodes()
├── web/
│   ├── app/
│   │   ├── page.tsx          # Homepage (SaaS landing page, ~1700 lines)
│   │   └── (app)/
│   │       ├── layout.tsx    # Wraps all dashboard pages in SidebarLayout
│   │       ├── dashboard/    # Main overview: regime, metrics, episode distribution
│   │       ├── today/        # Live market state + top 5 analog episodes
│   │       ├── memory/       # Episode browser with filters + CSV export
│   │       ├── chat/         # SSE streaming chat with FinMem AI
│   │       ├── analytics/    # Distribution charts, ablation, coverage stats
│   │       ├── insights/     # Precursor frequencies + regime transition matrix
│   │       ├── data/         # Data quality report + completeness metrics
│   │       ├── compare/      # Side-by-side episode comparison with bar charts
│   │       └── episodes/[id]/ # Single episode deep-dive
│   ├── components/
│   │   └── SidebarLayout.tsx # Nav sidebar: grouped (Overview/Research/System), gradient logo
│   └── lib/
│       └── api.ts            # All fetch calls to http://localhost:8000
```

---

## How Episodes Are Calculated

### Step 1 — Market Data Loading (`finmem/data/loaders.py`)
Fetches daily data going back to 1993 via:
- **yfinance**: SPY (price, returns), VIX
- **FRED API**: CPI (CPIAUCSL), Fed Funds rate (FEDFUNDS), 10Y-2Y yield spread (T10Y2Y), Unemployment (UNRATE)

Derived columns computed:
- `spy_return_1d`, `spy_return_5d`, `spy_return_21d` — percentage returns
- `rolling_vol_21d` — 21-day rolling standard deviation of daily returns

### Step 2 — Episode Detection (`finmem/data/episode_builder.py`)
Uses **PELT (Pruned Exact Linear Time) changepoint detection** via the `ruptures` library on a composite signal of normalized returns + VIX. Minimum episode length enforced to avoid noise.

For each detected episode segment:
- **Regime** assigned by rule priority (checked in order):
  1. `vix > 35` → **CRISIS**
  2. `vix > 25 AND max_drawdown < -8%` → **SELLOFF**
  3. `cpi > 5% AND fed_rate > 3%` → **TIGHTENING**
  4. `yield_spread < -0.2% AND fed_rate > 2%` → **TIGHTENING+SLOWDOWN**
  5. `fed_rate < 1% AND avg_daily_return > 0` → **EASING+RECOVERY**
  6. `avg_daily_return > 0.04/21 AND vix < 20` → **BULL**
  7. catch-all → **STABLE**

- **Forward returns** computed at episode end: 1M (+21 trading days), 3M (+63), 6M (+126)
- **Prose summary** generated via GPT-4o-mini (falls back to template if API fails)

### Step 3 — Hybrid Embedding (`finmem/memory/embeddings.py`)
Each episode is embedded into a **391-dimensional vector**:
- **Structural component (7 dims, weight 0.6)**: `[avg_daily_return, rolling_vol, cpi/10, fed_rate/10, yield_spread/5, vix/50, unemployment/10]` — L2 normalized
- **Text component (384 dims, weight 0.4)**: `all-MiniLM-L6-v2` sentence transformer on the prose summary — normalized
- Final: `concat([struct * 0.6, text * 0.4])` then L2 normalized again

Current market state is embedded the same way using `spy_return_21d/21` as avg_return proxy.

### Step 4 — Retrieval & Re-ranking (`finmem/memory/retrieval.py`)
1. Embed current market state → query vector
2. LanceDB cosine search → top 20 candidates
3. Re-rank each candidate:
   - `base_similarity = 1 - cosine_distance`
   - `regime_bonus = +0.10` if episode regime matches current regime
   - `recency_penalty = -0.05` if episode is >15 years old
   - `final_score = base_similarity + regime_bonus - recency_penalty`
4. Return top 5 by final_score

### Step 5 — Confidence Gate (`finmem/reasoning/confidence.py`)
- `final_score ≥ 0.65` → **HIGH confidence** — reason freely
- `final_score ≥ 0.45` → **MEDIUM confidence** — prefix with uncertainty warning
- `final_score < 0.45` → **NO ANALOG** — refuse to hallucinate, return refusal message

---

## Active API Endpoints (`api/main.py`)

All served on `http://localhost:8000`. CORS is open (`allow_origins=["*"]`).

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | `{status: "ok", episodes: N}` |
| `/api/state` | GET | Latest market state + top 5 analog episodes |
| `/api/memory` | GET | Episode count, date range, regime breakdown |
| `/api/episodes` | GET | List all episodes (`?regime=BULL&limit=100`) |
| `/api/episodes/search` | GET | Filter by `cpi_gt/lt`, `vix_gt`, `fed_gt`, `regime`, `limit` |
| `/api/episodes/{id}` | GET | Single episode detail by row index (0-based) |
| `/api/episodes/{id1}/compare/{id2}` | GET | Side-by-side comparison |
| `/api/episodes/{id}/precursors` | GET | Precursor indicators from PostgreSQL |
| `/api/outcomes/distribution` | GET | Forward return + drawdown stats (`?regime=`) |
| `/api/regime-transitions` | GET | Transition matrix from PostgreSQL |
| `/api/precursor-frequencies` | GET | Indicator frequencies before regime shifts |
| `/api/data-quality` | GET | Completeness metrics per column |
| `/api/ablation` | GET | Ablation study results from `results/ablation.json` |
| `/api/episodes/export` | GET | Export-formatted episodes JSON (for CSV download) |
| `/api/chat/stream` | POST | SSE streaming chat via GPT-4o |
| `/auth/register` | POST | Create user account |
| `/auth/login` | POST | Get JWT token |

**Important**: Episode IDs in `/api/episodes` are UUIDs (strings). Navigation uses **row index** (0-based integer), not UUID — `/api/episodes/0` returns the first episode by `df.iloc[0]`.

**Data value units**: All return/drawdown values from the API are already in **percent** (e.g. `39.01` = 39.01%). Do NOT multiply by 100 in the frontend.

---

## Frontend Design System

### Colors (mint/teal palette)
- Primary green: `#0FA77A`
- Teal accent: `#1AADB0`
- Background: `#F4FAF7`
- Dark text: `#0F2B23`
- Muted text: `#5A736A`
- Borders: `#D7E8E0`
- Cards: white with `border-[#D7E8E0]`
- Danger: `#E22134` / `#B91C1C`
- Warning: `#F59B23`

### Regime Colors
```ts
STABLE: "#1AADB0"
BULL: "#0FA77A"
CRISIS: "#E22134"
SELLOFF: "#F97316"
TIGHTENING: "#F59B23"
TIGHTENING+SLOWDOWN: "#FBBF24"
EASING+RECOVERY: "#A78BFA"
```

### Typography
- Body: `Plus_Jakarta_Sans` (CSS var `--font-sans`)
- Headings: `Sora` (CSS var `--font-heading`)
- Mono: `JetBrains_Mono` (CSS var `--font-mono`)
- All loaded in `web/app/layout.tsx` via `next/font/google`

### Component patterns
- Gradient button: `bg-[linear-gradient(135deg,#0FA77A,#1AADB0)]`
- Card shadow: `shadow-[0_22px_55px_-32px_rgba(12,58,44,0.32)]`
- Gradient logo icon: `bg-[linear-gradient(135deg,#0FA77A,#1AADB0)]`
- Skeleton loader: `className="skeleton"` (shimmer animation in globals.css)
- All pages are `"use client"` single-file components

### Recharts (v3.8.1) gotchas
- `<Pie activeIndex={...}>` does NOT exist in v3 — removed
- `formatter` prop on `<Tooltip>` must be typed as `(v: unknown) => [string, string]`, not `(v: number) => ...`

---

## How to Start the Stack

```bash
cd /home/aditya/projects/FinMem

# Start backend API (takes ~15s to warm up — loads yfinance + sentence-transformer)
python -m uvicorn api.main:app --port 8000 &

# Start frontend
cd web && npm run dev
```

- Backend warms up by fetching live market data + loading sentence-transformer weights
- Frontend proxies nothing — all fetch calls go directly to `http://localhost:8000` (via `NEXT_PUBLIC_API_URL` or default)

### Re-ingest episodes (rebuilds LanceDB from scratch)
```bash
python scripts/ingest.py
```

### Environment variables needed (`.env` at project root)
```
DATABASE_URL=postgresql://postgres:finmem_password@localhost:5432/finmem
FRED_API_KEY=<your FRED API key>
OPENAI_API_KEY=<your OpenAI key>
```

---

## Dashboard Pages — What Each Does

| Route | Purpose | Key API calls |
|---|---|---|
| `/dashboard` | Overview: regime pill, metrics grid, pie chart of episode distribution, system health | `fetchState`, `fetchMemory`, `fetchDataQuality` |
| `/today` | Live market conditions vs top 5 analogs — the core RAG output | `fetchState` |
| `/memory` | Episode browser: search, regime filter, VIX/return/fed range sliders, CSV export | `fetchAllEpisodes`, `fetchEpisodesExport` |
| `/chat` | SSE streaming chat — ask FinMem anything in natural language | `streamChat` (SSE to `/api/chat/stream`) |
| `/analytics` | Distribution histograms for 6M returns + drawdowns, ablation quality, regime pie | `fetchOutcomesDistribution`, `fetchAblation` |
| `/insights` | Precursor frequency table (VIX spike / yield inversion / Fed tightening/easing) + regime transition matrix | `fetchPrecursorFrequencies`, `fetchRegimeTransitions` |
| `/data` | Data quality report: completeness per column, sources, coverage dates | `fetchDataQuality` |
| `/compare` | Pick any two episodes by regime/date dropdown — side-by-side bar chart | `fetchAllEpisodes`, `fetchCompareEpisodes` |
| `/episodes/[id]` | Deep-dive on one episode: all metrics, precursor indicators, forward returns | `fetchEpisodeDetail`, `fetchEpisodePrecursors` |

---

## Homepage (SaaS Landing Page)

`web/app/page.tsx` (~1700 lines, single-file). Sections in order:

1. **Header** — nav with mobile hamburger menu (state: `mobileOpen`)
2. **Hero** — typewriter cycling 4 queries (state: `heroQueryIndex`, `heroQueryChars`, `heroDeleting`), inline chat mockup with reasoning path + top match card
3. **Customer Logo Band** — 6 stylized research firm wordmarks
4. **Market Strip** — live-feel scrolling ticker of indicators
5. **Source Rail** — data sources (FRED, yfinance, Treasury)
6. **Feature Cards** — 4 key differentiators
7. **Interactive Product Tour** — 4-tab browser-chrome mockup (Dashboard/Chat/Memory/Analytics) — all JSX inline, no images (state: `tourTab`)
8. **Workflow 3-Step** — how it works
9. **Command Preview + Episode Match Table** — sample query → results mockup
10. **Differentiation Table** — FinMem vs Bloomberg vs ChatGPT
11. **Outcomes / ROI Stats** — CountUp animation on scroll (IntersectionObserver, requestAnimationFrame)
12. **Testimonials Carousel** — CSS scroll-snap, 6 testimonials (state: `testimonialScrollRef`)
13. **Integration Showcase** — 8 integration tiles
14. **Security & Trust Band** — dark section, 4 security badges
15. **FAQ** — accordion (state: `openFaq`)
16. **Early Access / Waitlist Form** — email capture, success state (state: `waitlistEmail`, `waitlistSubmitted`) — TODO: wire to `/api/waitlist`
17. **Final CTA**
18. **Footer** — 5-column layout

---

## Known Issues / TODOs

1. **Waitlist endpoint**: `onSubmit` in the waitlist form just sets `waitlistSubmitted=true` locally — needs `/api/waitlist` backend
2. **Episode hardcoding**: Some hero stats ("72 episodes") should ideally be fetched live
3. **Auth not enforced**: JWT auth endpoints exist but the dashboard has no auth gating (all pages publicly accessible)
4. **Precursor/transition data**: The PostgreSQL `historical_regime_indicators` table has only 16 rows — the insights page will show sparse data until more data is ingested via `api/scheduler.py`
5. **`api/query_engine.py` uses `finmem_lancedb/`** — this is the old Phase 3/4 implementation; the active system uses `finmem_db/` via `finmem/memory/store.py`. They coexist but only `finmem_db` is current.

---

## Key Bugs Fixed (history)

- `/api/episodes` 500: `row.columns` → `row.index` (pandas Series has no `.columns`), then `int(id)` → `str(id)` (IDs are UUIDs)
- Memory page filter: `total_return * 100` double-multiplication (API already returns % values like 39.01, not 0.3901)
- Dashboard pie chart: Recharts v3 `activeIndex` prop removed, was causing TS error
- Recharts `formatter` type: must not annotate as `(v: number)` — use `(v)` to let TypeScript infer `ValueType | undefined`
- Analytics histogram bins: custom `binValues()` function assigns `% labels` instead of raw indices
- Testimonials carousel: SSR hydration mismatch fixed by using `scrollRef.current.scrollBy()` instead of `window.innerWidth`
