"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  CircleAlert,
  Database,
  FileText,
  Gauge,
  GitCompare,
  MessageSquareText,
  Search,
  Sparkles,
  Menu,
  X,
  Zap,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";
import { isAuthenticated } from "@/lib/auth";

const bodyFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const headingFont = Sora({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const NAV_ITEMS = [
  { label: "How it works", href: "#workflow" },
  { label: "Product", href: "#product" },
  { label: "Compare", href: "#compare" },
  { label: "FAQ", href: "#faq" },
];

const HERO_QUERIES = [
  "What happened after yield curve inversions deeper than -0.30%?",
  "Find episodes where VIX exceeded 30 and Fed was cutting",
  "Closest analog to the 2020 COVID crash?",
  "How did markets behave 6 months after CPI peaked above 8%?",
];

const WORKFLOW_STEPS = [
  {
    num: "01",
    title: "Live market state is structured",
    body: "FRED and yfinance data is combined into a feature vector across price, volatility, inflation, policy rate, and yield curve shape — updated daily.",
    icon: Gauge,
    accent: "#0FA77A",
  },
  {
    num: "02",
    title: "Similar historical episodes are retrieved",
    body: "LanceDB vector search finds past market windows with structurally similar conditions — by similarity score, not just calendar proximity.",
    icon: Search,
    accent: "#1AADB0",
  },
  {
    num: "03",
    title: "Grounded answer with citations",
    body: "Every response cites the matched episodes with regime, similarity score, and forward return. Confidence is shown explicitly — low analog quality means explicit uncertainty, not false confidence.",
    icon: FileText,
    accent: "#A78BFA",
  },
];

const FEATURES = [
  {
    title: "Episodic RAG — not keyword search",
    body: "Episodes are matched by structural market similarity across 6 macro dimensions, not by keyword or date range. A question about 'high volatility + Fed cutting' finds all structurally matching windows.",
    icon: Database,
  },
  {
    title: "Confidence refusal",
    body: "When no historical episode passes the similarity threshold, FinMem surfaces that gap explicitly rather than generating a narrative without precedent.",
    icon: CircleAlert,
  },
  {
    title: "7 detected market regimes",
    body: "PELT changepoint detection labels each episode: Stable, Bull, Crisis, Selloff, Tightening, Tightening+Slowdown, or Easing+Recovery. Every answer is regime-aware.",
    icon: TrendingUp,
  },
  {
    title: "Full research workspace",
    body: "Dashboard, episode memory browser, analytics, chat, comparison tool — all sharing the same episodic memory layer. Not a one-shot prompt box.",
    icon: BarChart3,
  },
];

const COMPARISON_ROWS = [
  {
    metric: "Historical grounding",
    finmem: "Structurally similar episodes",
    prompt: "Prompt narrative",
    fixed: "Recent date window only",
  },
  {
    metric: "Market-state structure",
    finmem: "SPY, VIX, CPI, Fed, yield curve, regime",
    prompt: "Unstructured text",
    fixed: "Date-constrained",
  },
  {
    metric: "Confidence refusal",
    finmem: "Native — weak analog shown explicitly",
    prompt: "Usually absent",
    fixed: "Manual interpretation",
  },
  {
    metric: "Episode citations",
    finmem: "Included in every response",
    prompt: "Not traceable",
    fixed: "External lookup required",
  },
  {
    metric: "Regime detection",
    finmem: "7 labeled regimes per episode",
    prompt: "None",
    fixed: "None",
  },
  {
    metric: "Repeatable workflow",
    finmem: "Web app + API across all surfaces",
    prompt: "Prompt phrasing drift",
    fixed: "Rigid window flow",
  },
];

const PERSONAS = [
  {
    icon: TrendingUp,
    title: "Portfolio Managers",
    body: "Scenario framing before risk and allocation decisions, grounded in cited historical analogs.",
  },
  {
    icon: BarChart3,
    title: "Macro Analysts",
    body: "Historical context for inflation, rates, volatility, and cycle transitions — not AI-generated summaries.",
  },
  {
    icon: Shield,
    title: "Risk Teams",
    body: "Explicit uncertainty when weak precedent is surfaced. No unsupported commentary masquerading as conviction.",
  },
];

const FAQS = [
  {
    question: "What does FinMem do?",
    answer:
      "FinMem maps the current market state to similar historical episodes using vector similarity search, then explains likely outcome ranges with explicit confidence. It is a retrieval-first research system — every answer is grounded in cited historical windows.",
  },
  {
    question: "Why episodic retrieval instead of prompt-only AI?",
    answer:
      "Prompt-only AI can generate plausible-sounding market commentary without a structural analog basis. Episodic retrieval keeps reasoning tied to cited precedent — you can read back to the matched episodes and validate the reasoning.",
  },
  {
    question: "Is FinMem a prediction engine?",
    answer:
      "No. It is a historical analog research system. It surfaces base rates from past episodes with similar conditions and helps frame scenarios. It is not financial advice.",
  },
  {
    question: "What happens when no good analog exists?",
    answer:
      "FinMem shows a weak-analog condition explicitly and avoids generating a confident narrative. Uncertainty is visible in the response, not hidden.",
  },
  {
    question: "What data does FinMem use?",
    answer:
      "Daily market data from yfinance (SPY, VIX), macro data from FRED (CPI, Fed funds rate, unemployment, yield curve), stored in PostgreSQL with LanceDB for vector similarity search.",
  },
  {
    question: "Can I use it as a guest?",
    answer:
      "Yes. Guest access requires no account — you get full access to the research workspace. Create an account to save your chat history across sessions.",
  },
];

const TOUR_TABS = [
  { key: "chat", icon: MessageSquareText, title: "Ask FinMem", desc: "Cited responses with confidence score and matched episodes." },
  { key: "memory", icon: Database, title: "Episode Browser", desc: "Filter and inspect episodes by regime, VIX, return, and rate." },
  { key: "dashboard", icon: Gauge, title: "Dashboard", desc: "Live market state with regime indicator and episode stats." },
  { key: "analytics", icon: BarChart3, title: "Analytics", desc: "Outcome distributions and per-regime return statistics." },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-[#D7E8E0] bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className={`${headingFont.className} text-sm font-semibold text-[#13352B]`}>{question}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#5E746B] transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="px-5 pb-5 text-sm leading-7 text-[#4D665D]">{answer}</p>}
    </div>
  );
}

function BrowserChrome({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#C9E2D8] bg-white shadow-[0_30px_60px_-28px_rgba(14,56,44,0.3)]">
      <div className="flex items-center gap-3 border-b border-[#DDECE6] bg-[#F2FAF6] px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#F08680]" />
          <span className="h-2 w-2 rounded-full bg-[#F5C25F]" />
          <span className="h-2 w-2 rounded-full bg-[#8FE0B5]" />
        </div>
        <div className="hidden flex-1 rounded border border-[#D5E5DD] bg-white/80 px-3 py-1 text-[11px] text-[#5A736A] sm:block">
          {label}
        </div>
      </div>
      <div className="bg-[#F8FCFA] p-4">{children}</div>
    </div>
  );
}

function TourChat() {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-xl rounded-br-sm bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] px-4 py-2.5 text-sm text-white">
          What happens after a yield curve inversion deeper than -0.30%?
        </div>
      </div>
      <div className="max-w-[90%] rounded-xl border border-[#D9EAE2] bg-white px-4 py-3 text-sm leading-7 text-[#1F3F35]">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#0A8A67]">Based on 3 retrieved episodes</p>
        <ul className="mt-2 space-y-2">
          {[
            { ep: "2019-08 → 2020-02", regime: "TIGHTENING", sim: "0.84", fwd: "+1.1%" },
            { ep: "2006-07 → 2007-01", regime: "TIGHTENING", sim: "0.79", fwd: "-4.2%" },
            { ep: "2000-02 → 2000-09", regime: "SELLOFF", sim: "0.71", fwd: "-18.3%" },
          ].map((row) => (
            <li key={row.ep} className="rounded-lg border border-[#EEF5F2] bg-[#F8FCFA] px-3 py-2 text-xs">
              <span className="font-semibold text-[#0F2B23]">{row.ep}</span>
              <span className="ml-2 text-[#5A736A]">[{row.regime}]</span>
              <span className="ml-2 text-[#0A8A67]">sim {row.sim}</span>
              <span className="ml-2 font-semibold" style={{ color: row.fwd.startsWith("+") ? "#0A8A67" : "#B91C1C" }}>{row.fwd} 6M</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center gap-3 border-t border-[#EEF5F2] pt-2 text-[11px] text-[#5A736A]">
          <span className="font-semibold text-[#0A8A67]">Confidence 78%</span>
          <span>· 3 analogs · mixed outcomes</span>
        </div>
      </div>
    </div>
  );
}

function TourMemory() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-[#D5E5DD] bg-white px-3 py-2">
        <Search className="h-4 w-4 text-[#5A736A]" />
        <span className="text-xs text-[#5A736A]">Filter episodes…</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {["All", "Stable", "Bull", "Crisis", "Tightening", "Selloff"].map((pill, i) => (
          <span key={pill} className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold ${i === 0 ? "border-[#0FA77A] bg-[#EAF9F3] text-[#0A8A67]" : "border-[#D5E5DD] bg-white text-[#5A736A]"}`}>
            {pill}
          </span>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-[#D9EAE2] bg-white">
        {[
          { ep: "2019-09", regime: "Stable", sim: "0.86", fwd: "+2.4%" },
          { ep: "2013-10", regime: "Bull", sim: "0.81", fwd: "+5.8%" },
          { ep: "2019-08", regime: "Tightening", sim: "0.74", fwd: "+1.1%" },
          { ep: "2008-09", regime: "Crisis", sim: "0.69", fwd: "-31.2%" },
        ].map((row) => (
          <div key={row.ep} className="grid grid-cols-4 items-center border-b border-[#EEF5F2] px-3 py-2.5 last:border-0 text-xs">
            <span className="font-semibold text-[#163C32]">{row.ep}</span>
            <span className="text-[#5A736A]">{row.regime}</span>
            <span className="font-semibold text-[#0A8A67]">{row.sim}</span>
            <span className={`font-semibold ${row.fwd.startsWith("+") ? "text-[#0A8A67]" : "text-[#B91C1C]"}`}>{row.fwd}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TourDashboard() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#0A8A67]">Today&apos;s market state</p>
        <span className="rounded border border-[#C8EADB] bg-[#EAF9F3] px-2 py-0.5 text-[10px] font-semibold text-[#0A8A67]">Stable</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "SPY", value: "Live" },
          { label: "VIX", value: "Live" },
          { label: "CPI", value: "FRED" },
          { label: "Fed Rate", value: "FRED" },
        ].map((cell) => (
          <div key={cell.label} className="rounded-lg border border-[#D9EAE2] bg-white px-3 py-2">
            <p className="text-[10px] font-semibold uppercase text-[#6A827A]">{cell.label}</p>
            <p className="mt-0.5 text-xs font-semibold text-[#163D33]">{cell.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[{ label: "Episodes", value: "Dynamic" }, { label: "Completeness", value: "Live" }, { label: "Status", value: "Ready" }].map((s) => (
          <div key={s.label} className="rounded-lg border border-[#D9EAE2] bg-white px-3 py-2">
            <p className="text-[10px] font-semibold uppercase text-[#6A827A]">{s.label}</p>
            <p className="mt-0.5 text-xs font-semibold text-[#0A8A67]">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TourAnalytics() {
  const bars = [8, 14, 22, 38, 55, 62, 48, 35, 20, 12, 6];
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#0A8A67]">6M forward return distribution</p>
      <div className="rounded-lg border border-[#D9EAE2] bg-white p-3">
        <div className="grid h-20 items-end gap-1" style={{ gridTemplateColumns: `repeat(${bars.length}, 1fr)` }}>
          {bars.map((h, i) => (
            <span key={i} className={`block rounded-sm ${i === 5 ? "bg-[#0FA77A]" : "bg-[#1AADB0]/55"}`} style={{ height: `${h}%` }} />
          ))}
        </div>
        <p className="mt-2 text-center text-[10px] text-[#5A736A]">Return buckets · all episodes</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[{ label: "Mean 6M", value: "Computed" }, { label: "Win rate", value: "Per regime" }, { label: "Regimes", value: "7 labels" }].map((s) => (
          <div key={s.label} className="rounded-lg border border-[#D9EAE2] bg-white px-3 py-2">
            <p className="text-[10px] font-semibold uppercase text-[#6A827A]">{s.label}</p>
            <p className="mt-0.5 text-xs font-semibold text-[#0A8A67]">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const HERO_EPISODES = [
  {
    date: "2020-03 → 2020-08",
    regime: "CRISIS",
    regimeColor: "#E22134",
    sim: 91,
    fwd: +52.1,
    sparks: [88, 60, 24, 15, 38, 68, 95],
  },
  {
    date: "2008-09 → 2009-03",
    regime: "CRISIS",
    regimeColor: "#E22134",
    sim: 84,
    fwd: -27.4,
    sparks: [78, 52, 28, 14, 18, 25, 32],
  },
  {
    date: "2022-01 → 2022-10",
    regime: "SELLOFF",
    regimeColor: "#F97316",
    sim: 76,
    fwd: +14.2,
    sparks: [68, 44, 28, 22, 36, 50, 64],
  },
];

function HeroVisual({ headingFont, query }: { headingFont: string; query: string }) {
  return (
    <div className="relative float-y">
      {/* Ambient glow behind card */}
      <div
        className="pointer-events-none absolute -inset-6 rounded-3xl opacity-60 blur-3xl"
        style={{ background: "radial-gradient(ellipse at 60% 40%, rgba(15,167,122,0.22) 0%, rgba(26,173,176,0.12) 50%, transparent 70%)" }}
        aria-hidden
      />

      {/* Floating chip — top right */}
      <div className="absolute -right-5 -top-4 z-20 slide-up flex items-center gap-1.5 rounded-xl border border-[#BCE8DA] bg-white px-3 py-2 shadow-[0_8px_28px_-8px_rgba(12,58,44,0.25)]" style={{ animationDelay: "600ms" }}>
        <span className="h-1.5 w-1.5 rounded-full bg-[#0FA77A]" />
        <span className={`${headingFont} text-[11px] font-bold text-[#0F2B23]`}>3 matches · HIGH</span>
      </div>

      {/* Floating chip — bottom left */}
      <div className="absolute -bottom-4 -left-4 z-20 slide-up flex items-center gap-1.5 rounded-xl border border-[#F0D8A8] bg-[#FFF8EA] px-3 py-2 shadow-[0_8px_28px_-8px_rgba(144,101,28,0.25)]" style={{ animationDelay: "800ms" }}>
        <span className={`${headingFont} text-[11px] font-bold text-[#A56C17]`}>312ms · episodic RAG</span>
      </div>

      {/* Main dark card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0B1D16] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.04)]">
        {/* Dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{ backgroundImage: "radial-gradient(#4ade80 1px, transparent 1px)", backgroundSize: "22px 22px" }}
          aria-hidden
        />

        {/* Top gradient glow */}
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-64 -translate-x-1/2 rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, #0FA77A, transparent)" }}
          aria-hidden
        />

        {/* Header */}
        <div className="relative border-b border-white/[0.07] px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="ping-soft absolute inline-flex h-full w-full rounded-full bg-[#0FA77A] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0FA77A]" />
              </span>
              <span className={`${headingFont} text-[11px] font-bold uppercase tracking-[0.18em] text-[#7BECCB]`}>
                FinMem · Retrieval
              </span>
            </div>
            <span className="rounded-md border border-[#0FA77A]/25 bg-[#0FA77A]/12 px-2 py-0.5 text-[10px] font-bold text-[#0FA77A]">
              LIVE
            </span>
          </div>

          {/* Query bar */}
          <div className="mt-3.5 flex items-center gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5">
            <MessageSquareText className="h-3.5 w-3.5 shrink-0 text-white/30" />
            <span className="font-mono text-sm text-white/70 truncate">
              {query || " "}
              <span className="type-blink ml-0.5 inline-block h-3.5 w-0.5 -translate-y-px bg-[#0FA77A] align-middle" />
            </span>
          </div>
        </div>

        {/* Episodes */}
        <div className="relative px-4 py-4">
          <div className="mb-3.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
              Retrieved episodes
            </span>
            <span className="rounded border border-white/[0.1] bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold text-white/45">
              {HERO_EPISODES.length}
            </span>
          </div>

          <div className="space-y-2.5">
            {HERO_EPISODES.map((ep, i) => {
              const color = ep.regimeColor;
              const positive = ep.fwd > 0;
              const fwdColor = positive ? "#0FA77A" : "#E22134";
              const sparkMax = Math.max(...ep.sparks);
              const pts = ep.sparks
                .map((v, j) => `${(j / (ep.sparks.length - 1)) * 44},${16 - (v / sparkMax) * 14}`)
                .join(" ");

              return (
                <div
                  key={ep.date}
                  className="slide-up rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-3 transition hover:bg-white/[0.07]"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-white/70">{ep.date}</span>
                    <div className="flex items-center gap-2">
                      {/* Mini sparkline */}
                      <svg width="44" height="18" viewBox="0 0 44 18" className="shrink-0 opacity-70">
                        <polyline
                          points={pts}
                          fill="none"
                          stroke={fwdColor}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {/* Endpoint dot */}
                        <circle
                          cx={(ep.sparks.length - 1) / (ep.sparks.length - 1) * 44}
                          cy={16 - (ep.sparks[ep.sparks.length - 1] / sparkMax) * 14}
                          r="2"
                          fill={fwdColor}
                        />
                      </svg>
                      {/* Regime badge */}
                      <span
                        className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]"
                        style={{ background: `${color}22`, color, border: `1px solid ${color}30` }}
                      >
                        {ep.regime}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center gap-3">
                    {/* Similarity bar */}
                    <div className="flex-1 overflow-hidden rounded-full bg-white/10" style={{ height: "3px" }}>
                      <div
                        className="bar-grow h-full rounded-full"
                        style={{
                          width: `${ep.sim}%`,
                          background: `linear-gradient(90deg, ${color}80, ${color})`,
                          animationDelay: `${300 + i * 150}ms`,
                        }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] text-white/35">
                      sim {(ep.sim / 100).toFixed(2)}
                    </span>
                    <span
                      className={`shrink-0 text-xs font-bold tabular-nums`}
                      style={{ color: fwdColor }}
                    >
                      {positive ? "+" : ""}{ep.fwd.toFixed(1)}% 6M
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Confidence + footer */}
        <div className="relative border-t border-white/[0.07] px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
              Confidence
            </span>
            <span className={`${headingFont} text-sm font-bold text-[#0FA77A]`}>78%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="bar-grow h-full w-[78%] rounded-full bg-[linear-gradient(90deg,#0FA77A,#1AADB0)]"
              style={{ animationDelay: "900ms" }}
            />
          </div>
          <div className="mt-3.5 flex items-center gap-2 text-[10px] text-white/20">
            {["yfinance", "FRED", "LanceDB", "PostgreSQL"].map((s, i) => (
              <span key={s} className="flex items-center gap-2">
                {i > 0 && <span className="text-white/15">·</span>}
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tourTab, setTourTab] = useState(0);
  const [heroQueryIndex, setHeroQueryIndex] = useState(0);
  const [heroQueryChars, setHeroQueryChars] = useState(0);
  const [heroDeleting, setHeroDeleting] = useState(false);

  useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setHeroQueryChars(HERO_QUERIES[0].length);
      return;
    }
    const current = HERO_QUERIES[heroQueryIndex];
    if (!heroDeleting && heroQueryChars < current.length) {
      const t = setTimeout(() => setHeroQueryChars((c) => c + 1), 36);
      return () => clearTimeout(t);
    }
    if (!heroDeleting && heroQueryChars === current.length) {
      const t = setTimeout(() => setHeroDeleting(true), 1800);
      return () => clearTimeout(t);
    }
    if (heroDeleting && heroQueryChars > 0) {
      const t = setTimeout(() => setHeroQueryChars((c) => c - 1), 18);
      return () => clearTimeout(t);
    }
    if (heroDeleting && heroQueryChars === 0) {
      setHeroDeleting(false);
      setHeroQueryIndex((i) => (i + 1) % HERO_QUERIES.length);
    }
  }, [heroQueryChars, heroDeleting, heroQueryIndex]);

  useEffect(() => {
    if (!mobileOpen) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = orig; };
  }, [mobileOpen]);

  useEffect(() => {
    if (isAuthenticated()) router.replace("/dashboard");
  }, [router]);

  return (
    <div className={`${bodyFont.className} relative min-h-screen overflow-x-hidden bg-[#F4FAF7] text-[#102E25]`}>
      <style jsx global>{`
        @keyframes driftA { 0%,100%{transform:translate3d(0,0,0) scale(1)} 50%{transform:translate3d(32px,-20px,0) scale(1.07)} }
        @keyframes driftB { 0%,100%{transform:translate3d(0,0,0) scale(1)} 50%{transform:translate3d(-24px,22px,0) scale(1.1)} }
        @keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes typeBlink { 0%,100%{opacity:0} 50%{opacity:1} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeSwap { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes barGrow { from{transform:scaleX(0)} to{transform:scaleX(1)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes pingSoft { 0%{transform:scale(1);opacity:0.8} 100%{transform:scale(2.2);opacity:0} }
        .drift-a{animation:driftA 14s ease-in-out infinite}
        .drift-b{animation:driftB 17s ease-in-out infinite}
        .float-y{animation:floatY 6s ease-in-out infinite}
        .type-blink{animation:typeBlink 1s steps(1) infinite}
        .fade-in{animation:fadeIn 0.5s ease-out both}
        .fade-swap{animation:fadeSwap 200ms ease-out both}
        .bar-grow{animation:barGrow 1.1s cubic-bezier(.22,1,.36,1) both;transform-origin:left}
        .slide-up{animation:slideUp 0.5s ease-out both}
        .ping-soft{animation:pingSoft 1.8s ease-out infinite}
        @media(prefers-reduced-motion:reduce){.drift-a,.drift-b,.float-y,.type-blink,.fade-in,.fade-swap,.bar-grow,.slide-up,.ping-soft{animation:none!important}}
      `}</style>

      {/* Background blobs */}
      <div className="pointer-events-none fixed inset-0" aria-hidden>
        <div className="drift-a absolute -left-40 -top-32 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(15,167,122,0.18)_0%,transparent_65%)] blur-3xl" />
        <div className="drift-b absolute -right-32 top-16 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(26,173,176,0.16)_0%,transparent_65%)] blur-3xl" />
        <div className="drift-a absolute bottom-0 left-1/3 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.10)_0%,transparent_65%)] blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#D4E6DE] bg-[#F4FAF7]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className={`${headingFont.className} text-xl font-bold text-[#0F2B23]`}
          >
            FinMem
          </button>

          <nav className="hidden items-center gap-7 lg:flex">
            {NAV_ITEMS.map((item) => (
              <a key={item.href} href={item.href} className="text-sm font-medium text-[#51685F] transition hover:text-[#0F2B23]">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="hidden h-9 items-center rounded-lg border border-[#CDE2DA] bg-white px-4 text-sm font-semibold text-[#0F2B23] transition hover:bg-[#F2FAF6] lg:inline-flex"
            >
              Explore as Guest
            </Link>
            <Link
              href="/auth"
              className={`${headingFont.className} inline-flex h-9 items-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_-12px_rgba(15,167,122,0.7)] transition hover:brightness-95`}
            >
              Sign In
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#CDE2DA] bg-white text-[#1A4034] lg:hidden"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="absolute inset-x-0 top-16 border-b border-[#D4E6DE] bg-[#F4FAF7]/98 backdrop-blur-xl lg:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-4">
              <div className="flex items-center justify-between pb-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A8A67]">Menu</span>
                <button type="button" onClick={() => setMobileOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#CDE2DA] bg-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {NAV_ITEMS.map((item) => (
                <a key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#1A4034] hover:bg-white">
                  {item.label}
                </a>
              ))}
              <div className="mt-3 flex flex-col gap-2 border-t border-[#D4E6DE] pt-3">
                <Link href="/dashboard" className="flex h-11 items-center justify-center rounded-lg border border-[#CDE2DA] bg-white text-sm font-semibold text-[#0F2B23]">
                  Explore as Guest
                </Link>
                <Link href="/auth" className={`${headingFont.className} flex h-11 items-center justify-center gap-2 rounded-lg bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] text-sm font-semibold text-white`}>
                  Sign In / Create Account
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="py-16 md:py-24">
          <div className="mx-auto grid max-w-7xl gap-14 px-5 md:px-8 lg:grid-cols-[1fr_1fr] lg:items-center">
            <div className="fade-in">
              <div className="inline-flex items-center gap-2 rounded-lg border border-[#B8E7D8] bg-white/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#0A8A67] shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Episodic Memory · RAG for Markets
              </div>

              <h1 className={`${headingFont.className} mt-5 text-4xl font-bold leading-[1.06] text-[#0F2B23] sm:text-5xl lg:text-[3.8rem]`}>
                Ask market history questions that get cited answers.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-[#4D665D]">
                FinMem finds historical market episodes structurally similar to today, then answers your research questions with cited precedent, similarity scores, and honest confidence — not AI-generated narrative.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/dashboard"
                  className={`${headingFont.className} inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#CDE2DA] bg-white px-6 text-sm font-semibold text-[#0F2B23] shadow-sm transition hover:bg-[#F2FAF6] hover:border-[#BCE8DA]`}
                >
                  Explore as Guest
                </Link>
                <Link
                  href="/auth?mode=signup"
                  className={`${headingFont.className} inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] px-6 text-sm font-semibold text-white shadow-[0_16px_32px_-16px_rgba(15,167,122,0.85)] transition hover:brightness-95`}
                >
                  Create Free Account
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {[
                  { icon: Check, text: "No credit card required" },
                  { icon: Check, text: "Guest access — no sign-up needed" },
                  { icon: Check, text: "Save history with an account" },
                ].map((item) => (
                  <span key={item.text} className="inline-flex items-center gap-1.5 text-xs text-[#5A736A]">
                    <item.icon className="h-3 w-3 text-[#0A8A67]" />
                    {item.text}
                  </span>
                ))}
              </div>
            </div>

            {/* Hero visual */}
            <HeroVisual
              headingFont={headingFont.className}
              query={HERO_QUERIES[heroQueryIndex].slice(0, heroQueryChars)}
            />
          </div>
        </section>

        {/* Stack badges */}
        <div className="border-y border-[#D6E8E0] bg-white/70 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-5 py-4 md:px-8">
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#7A938A]">Powered by</span>
            {["yfinance", "FRED", "LanceDB", "PostgreSQL", "PELT detection", "MiniLM embeddings"].map((s) => (
              <span key={s} className="rounded-md border border-[#D8E9E2] bg-[#F8FCFA] px-3 py-1.5 text-[11px] font-semibold text-[#4F685F]">
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* How it works */}
        <section id="workflow" className="py-20">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <p className={`${headingFont.className} text-xs font-semibold uppercase tracking-[0.12em] text-[#0A8A67]`}>How it works</p>
            <h2 className={`${headingFont.className} mt-3 max-w-2xl text-3xl font-bold leading-tight text-[#0F2B23] md:text-4xl`}>
              From live market state to cited answer.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#4D665D]">
              Three steps happen every time you ask a question. All real — no mocked data, no AI hallucination.
            </p>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {WORKFLOW_STEPS.map((step) => (
                <div key={step.num} className="relative rounded-xl border border-[#D7E8E0] bg-white p-6 shadow-[0_20px_45px_-28px_rgba(12,58,44,0.28)]">
                  <span className={`${headingFont.className} text-[11px] font-bold uppercase tracking-[0.18em]`} style={{ color: step.accent }}>
                    Step {step.num}
                  </span>
                  <div className="mt-4 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${step.accent}18` }}>
                    <step.icon className="h-5 w-5" style={{ color: step.accent }} />
                  </div>
                  <h3 className={`${headingFont.className} mt-4 text-base font-bold text-[#0F2B23]`}>{step.title}</h3>
                  <p className="mt-2.5 text-sm leading-7 text-[#4D665D]">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Product tour */}
        <section id="product" className="border-y border-[#D6E8E0] bg-[#F8FCFA] py-20">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <p className={`${headingFont.className} text-xs font-semibold uppercase tracking-[0.12em] text-[#0A8A67]`}>Product tour</p>
            <h2 className={`${headingFont.className} mt-3 max-w-2xl text-3xl font-bold leading-tight text-[#0F2B23] md:text-4xl`}>
              Five surfaces, one episodic memory layer.
            </h2>
            <div className="mt-10 grid gap-5 lg:grid-cols-[280px_1fr]">
              <div className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1.5 lg:overflow-visible">
                {TOUR_TABS.map((tab, idx) => {
                  const active = tourTab === idx;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setTourTab(idx)}
                      className={`flex min-w-[200px] shrink-0 items-start gap-3 rounded-xl border-l-2 px-4 py-3.5 text-left transition lg:min-w-0 ${
                        active ? "border-l-[#0FA77A] bg-white shadow-sm" : "border-l-transparent bg-transparent hover:bg-white/60"
                      }`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? "bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] text-white" : "bg-[#F2FAF6] text-[#0A8A67]"}`}>
                        <tab.icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className={`${headingFont.className} block text-sm font-semibold ${active ? "text-[#0F2B23]" : "text-[#4D665D]"}`}>{tab.title}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-[#5A736A]">{tab.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div key={tourTab} className="fade-swap">
                <BrowserChrome label={`finmem.app/${TOUR_TABS[tourTab].key}`}>
                  {tourTab === 0 && <TourChat />}
                  {tourTab === 1 && <TourMemory />}
                  {tourTab === 2 && <TourDashboard />}
                  {tourTab === 3 && <TourAnalytics />}
                </BrowserChrome>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <p className={`${headingFont.className} text-xs font-semibold uppercase tracking-[0.12em] text-[#0A8A67]`}>What makes it different</p>
            <h2 className={`${headingFont.className} mt-3 max-w-2xl text-3xl font-bold leading-tight text-[#0F2B23] md:text-4xl`}>
              Built for analysts who want precedent, not prose.
            </h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-xl border border-[#D7E8E0] bg-white p-5 shadow-[0_18px_40px_-26px_rgba(12,58,44,0.26)]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E9F9F3] text-[#0A8A67]">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className={`${headingFont.className} mt-4 text-sm font-bold text-[#0F2B23]`}>{f.title}</h3>
                  <p className="mt-2.5 text-sm leading-7 text-[#4D665D]">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section id="compare" className="border-y border-[#D6E8E0] bg-white py-20">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <p className={`${headingFont.className} text-xs font-semibold uppercase tracking-[0.12em] text-[#0A8A67]`}>Why retrieval-first</p>
            <h2 className={`${headingFont.className} mt-3 max-w-2xl text-3xl font-bold leading-tight text-[#0F2B23] md:text-4xl`}>
              Episodic RAG vs prompt-only AI vs fixed windows.
            </h2>
            <div className="mt-10 overflow-x-auto rounded-xl border border-[#D7E8E0]">
              <div className="grid min-w-[700px] grid-cols-[1.2fr_1.1fr_1fr_1fr] border-b border-[#DDECE6] bg-[#F2FAF6] text-[11px] uppercase tracking-[0.06em] text-[#658076]">
                <div className="px-4 py-3 font-semibold">Capability</div>
                <div className="px-4 py-3 font-semibold text-[#0A8A67]">FinMem</div>
                <div className="px-4 py-3 font-semibold">Prompt-only AI</div>
                <div className="px-4 py-3 font-semibold">Fixed window</div>
              </div>
              {COMPARISON_ROWS.map((row) => (
                <div key={row.metric} className="grid min-w-[700px] grid-cols-[1.2fr_1.1fr_1fr_1fr] border-b border-[#EEF5F2] bg-white text-sm last:border-0">
                  <div className={`${headingFont.className} px-4 py-3.5 font-semibold text-[#173F33]`}>{row.metric}</div>
                  <div className="px-4 py-3.5 text-[#0A8A67]">{row.finmem}</div>
                  <div className="px-4 py-3.5 text-[#4D665D]">{row.prompt}</div>
                  <div className="px-4 py-3.5 text-[#4D665D]">{row.fixed}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <p className={`${headingFont.className} text-xs font-semibold uppercase tracking-[0.12em] text-[#0A8A67]`}>Who it&apos;s for</p>
            <h2 className={`${headingFont.className} mt-3 max-w-2xl text-3xl font-bold leading-tight text-[#0F2B23] md:text-4xl`}>
              Built for teams that want precedent before narrative.
            </h2>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {PERSONAS.map((p) => (
                <div key={p.title} className="rounded-xl border border-[#D7E8E0] bg-white p-6 shadow-[0_18px_40px_-26px_rgba(12,58,44,0.24)]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] text-white shadow-[0_12px_24px_-14px_rgba(15,167,122,0.7)]">
                    <p.icon className="h-5 w-5" />
                  </span>
                  <h3 className={`${headingFont.className} mt-4 text-base font-bold text-[#0F2B23]`}>{p.title}</h3>
                  <p className="mt-2.5 text-sm leading-7 text-[#4D665D]">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-y border-[#D6E8E0] bg-[#F8FCFA] py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 md:px-8 lg:grid-cols-[300px_1fr]">
            <div>
              <p className={`${headingFont.className} text-xs font-semibold uppercase tracking-[0.12em] text-[#0A8A67]`}>FAQ</p>
              <h2 className={`${headingFont.className} mt-3 text-3xl font-bold leading-tight text-[#0F2B23]`}>
                Common questions.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#4D665D]">
                No fluff. Real answers about how the system works.
              </p>
            </div>
            <div className="flex flex-col gap-2.5">
              {FAQS.map((faq) => (
                <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="mx-auto max-w-3xl px-5 text-center md:px-8">
            <p className={`${headingFont.className} text-xs font-semibold uppercase tracking-[0.12em] text-[#0A8A67]`}>Get started</p>
            <h2 className={`${headingFont.className} mt-4 text-3xl font-bold leading-tight text-[#0F2B23] md:text-4xl`}>
              Start exploring historical market analogs today.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-[#4D665D]">
              No credit card. No setup. Guest access opens the full workspace immediately. Create an account to save your research and chat history.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/dashboard"
                className={`${headingFont.className} inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#CDE2DA] bg-white px-8 text-sm font-semibold text-[#0F2B23] shadow-sm transition hover:bg-[#F2FAF6] sm:w-auto`}
              >
                <Users className="h-4 w-4" />
                Explore as Guest
              </Link>
              <Link
                href="/auth?mode=signup"
                className={`${headingFont.className} inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] px-8 text-sm font-semibold text-white shadow-[0_18px_36px_-18px_rgba(15,167,122,0.85)] transition hover:brightness-95 sm:w-auto`}
              >
                Create Free Account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <p className="mt-4 text-xs text-[#7A938A]">
              Historical analogs are research context only — not financial advice.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#D5E7DE] bg-white">
        <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
          <div className="flex flex-col gap-8 md:flex-row md:justify-between">
            <div className="max-w-xs">
              <span className={`${headingFont.className} text-xl font-bold text-[#0F2B23]`}>FinMem</span>
              <p className="mt-3 text-sm leading-7 text-[#5A736A]">
                Episodic market memory for research teams. Cited analogs, confidence-aware answers, and a full research workspace.
              </p>
              <div className="mt-4 flex gap-2">
                <Link href="/dashboard" className="inline-flex h-9 items-center rounded-lg border border-[#CDE2DA] px-3 text-xs font-semibold text-[#0F2B23] hover:bg-[#F2FAF6]">
                  Guest Access
                </Link>
                <Link href="/auth" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] px-3 text-xs font-semibold text-white hover:brightness-95">
                  Sign In
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              <div>
                <p className={`${headingFont.className} text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A8A67]`}>Product</p>
                <ul className="mt-3 space-y-2">
                  {[
                    { label: "How it works", href: "#workflow" },
                    { label: "Product tour", href: "#product" },
                    { label: "Compare", href: "#compare" },
                    { label: "FAQ", href: "#faq" },
                  ].map((l) => (
                    <li key={l.label}>
                      <a href={l.href} className="text-sm text-[#4D665D] hover:text-[#0F2B23]">{l.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className={`${headingFont.className} text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A8A67]`}>Workspace</p>
                <ul className="mt-3 space-y-2">
                  {[
                    { label: "Dashboard", href: "/dashboard" },
                    { label: "Chat", href: "/chat" },
                    { label: "Episode Memory", href: "/memory" },
                    { label: "Analytics", href: "/analytics" },
                    { label: "Today", href: "/today" },
                  ].map((l) => (
                    <li key={l.label}>
                      <a href={l.href} className="text-sm text-[#4D665D] hover:text-[#0F2B23]">{l.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className={`${headingFont.className} text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A8A67]`}>Data</p>
                <ul className="mt-3 space-y-2">
                  {["yfinance", "FRED", "LanceDB", "PostgreSQL"].map((s) => (
                    <li key={s} className="text-sm text-[#4D665D]">{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-2 border-t border-[#E2EEE9] pt-6 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-[#5A736A]">
              © {new Date().getFullYear()} FinMem. Historical analogs are research context only, not financial advice.
            </p>
            <div className="flex gap-3 text-xs text-[#5A736A]">
              <Link href="/auth" className="hover:text-[#0F2B23]">Sign In</Link>
              <Link href="/dashboard" className="hover:text-[#0F2B23]">Guest Access</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
