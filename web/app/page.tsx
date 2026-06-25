"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  CircleAlert,
  Database,
  Gauge,
  MessageSquareText,
  Search,
  Sparkles,
  Menu,
  X,
  Shield,
  TrendingUp,
} from "lucide-react";

const bodyFontClass = "font-[var(--font-sans)]";
const headingFontClass = "font-[var(--font-heading)]";

const NAV_ITEMS = [
  { label: "How it works", href: "#workflow" },
  { label: "Workspace", href: "#product" },
  { label: "Compare", href: "#compare" },
  { label: "FAQ", href: "#faq" },
];

const TRUST_ITEMS = ["Live data · updated daily", "Confidence score on every answer", "Cited episodes · no hallucination"];

const FEATURES = [
  {
    tag: "Core engine",
    title: "Finds past markets by shape, not by date",
    body: "Ask about 'rising VIX + Fed cutting + inverted yield curve' and FinMem retrieves every historical window with that structural pattern — 2001, 2008, 2019, whenever it occurred. No keywords. No date guessing. Pure similarity search over real market episodes.",
    icon: Database,
    accent: "#0FA77A",
    accentBg: "#EAF9F3",
  },
  {
    tag: "Honest by design",
    title: "Tells you when the data doesn't support an answer",
    body: "When no episode is structurally close enough, FinMem shows a weak-analog warning instead of generating a confident-sounding narrative. You can trust the silences as much as the answers.",
    icon: CircleAlert,
    accent: "#F59B23",
    accentBg: "#FFF8EC",
  },
  {
    tag: "Regime detection",
    title: "7 labeled market regimes per episode",
    body: "PELT changepoint detection segments history into episodes and labels each one: Stable, Bull, Crisis, Selloff, Tightening, Tightening+Slowdown, or Easing+Recovery. Every answer is automatically regime-aware.",
    icon: TrendingUp,
    accent: "#1AADB0",
    accentBg: "#EAF8F9",
  },
  {
    tag: "Live matching",
    title: "Today's market matched against all history, daily",
    body: "Live data from FRED and yfinance is structured each morning and matched against all historical episodes. The Today page shows which past windows look most like right now — no manual lookup needed.",
    icon: Gauge,
    accent: "#7C3AED",
    accentBg: "#F5F3FF",
  },
];

const COMPARISON_ROWS: {
  metric: string;
  finmem: { text: string; status: "pro" | "partial" | "con" };
  llm: { text: string; status: "pro" | "partial" | "con" };
  window: { text: string; status: "pro" | "partial" | "con" };
}[] = [
  {
    metric: "How it answers",
    finmem: { text: "Retrieves structurally similar real episodes", status: "pro" },
    llm:    { text: "Generates text from training data", status: "con" },
    window: { text: "Returns data from a recent date range", status: "partial" },
  },
  {
    metric: "Market dimensions",
    finmem: { text: "SPY, VIX, CPI, Fed rate, yield curve, regime", status: "pro" },
    llm:    { text: "Whatever was in training data", status: "con" },
    window: { text: "Price / volume in the selected window", status: "partial" },
  },
  {
    metric: "Shows uncertainty",
    finmem: { text: "Explicit weak-analog warning", status: "pro" },
    llm:    { text: "Generates confident text anyway", status: "con" },
    window: { text: "No built-in signal", status: "con" },
  },
  {
    metric: "Cites sources",
    finmem: { text: "Every response cites matched episodes", status: "pro" },
    llm:    { text: "Sources not traceable", status: "con" },
    window: { text: "External research required", status: "con" },
  },
  {
    metric: "Regime-aware",
    finmem: { text: "7 regimes labeled per episode", status: "pro" },
    llm:    { text: "No structural labeling", status: "con" },
    window: { text: "None", status: "con" },
  },
  {
    metric: "Updates daily",
    finmem: { text: "Live from FRED + yfinance", status: "pro" },
    llm:    { text: "Knowledge cutoff applies", status: "partial" },
    window: { text: "Depends on data source", status: "partial" },
  },
];

const PERSONAS = [
  {
    icon: TrendingUp,
    tag: "Scenario framing",
    title: "Portfolio Managers",
    problem: "You're considering a position but don't know if the current setup has a historical precedent.",
    body: "FinMem retrieves past episodes with the same macro fingerprint — same VIX range, same yield curve shape, same Fed stance — and shows the range of outcomes. Base rates before the thesis, not after.",
    accent: "#0FA77A",
  },
  {
    icon: BarChart3,
    tag: "Macro research",
    title: "Macro Analysts",
    problem: "You need historical context for a regime shift but don't want AI to summarize what it thinks happened.",
    body: "Every Fed pivot, inflation peak, and yield curve inversion has a labeled episode in FinMem. Read the actual episode with its real forward returns — not a generated summary of what usually happens.",
    accent: "#1AADB0",
  },
  {
    icon: Shield,
    tag: "Risk review",
    title: "Risk Teams",
    problem: "Your models flag a condition but you need to know if there's enough historical precedent to act on it.",
    body: "FinMem shows a similarity score and a confidence level on every answer. Weak analog conditions are surfaced explicitly — no confident narrative is generated when the data doesn't support it.",
    accent: "#7C3AED",
  },
];

const FAQS = [
  {
    question: "What does FinMem do?",
    answer:
      "FinMem maps the current market state to similar historical episodes using vector similarity search, then explains likely outcome ranges with explicit confidence. It is a retrieval-first research system — every answer is grounded in cited historical windows.",
  },
  {
    question: "Why episodic retrieval instead of ChatGPT?",
    answer:
      "ChatGPT and similar LLMs generate plausible-sounding market commentary without a structural analog basis — and there's no way to verify the source. Episodic retrieval ties every answer to a cited historical episode you can actually read and validate.",
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
    question: "Do I need an account to use FinMem?",
    answer:
      "No. FinMem is fully open — click 'Open Workspace' and you're in. No account, no sign-up, no credit card. Everything works immediately.",
  },
];

const TOUR_TABS = [
  { key: "chat", icon: MessageSquareText, title: "Ask FinMem", desc: "Natural-language questions answered with cited episodes and a confidence score." },
  { key: "today", icon: Gauge, title: "Today's Analog", desc: "Which historical episodes look most like today's market — ranked by structural similarity." },
  { key: "memory", icon: Database, title: "Episode Browser", desc: "Filter and explore all historical episodes by regime, VIX, return range, and date." },
  { key: "analytics", icon: BarChart3, title: "Outcome Analytics", desc: "6-month forward return distributions and per-regime performance statistics." },
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
        <span className={`${headingFontClass} text-sm font-semibold text-[#13352B]`}>{question}</span>
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
        <div className="grid grid-cols-4 border-b border-[#EEF5F2] bg-[#F4FAF7] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7A938A]">
          <span>Episode</span><span>Regime</span><span>Similarity</span><span>6M Return</span>
        </div>
        {[
          { ep: "2019-09", regime: "Stable",     sim: "0.86", fwd: "+2.4%"  },
          { ep: "2013-10", regime: "Bull",        sim: "0.81", fwd: "+5.8%"  },
          { ep: "2019-08", regime: "Tightening",  sim: "0.74", fwd: "+1.1%"  },
          { ep: "2008-09", regime: "Crisis",      sim: "0.69", fwd: "−31.2%" },
        ].map((row) => (
          <div key={row.ep} className="grid grid-cols-4 items-center border-b border-[#EEF5F2] px-3 py-2.5 text-xs last:border-0">
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

function TourToday() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#0A8A67]">Today&apos;s analog matches</p>
          <p className="mt-0.5 text-[11px] text-[#5A736A]">Ranked by structural similarity to current conditions</p>
        </div>
        <span className="rounded border border-[#C8EADB] bg-[#EAF9F3] px-2 py-0.5 text-[10px] font-semibold text-[#0A8A67]">Stable regime</span>
      </div>
      <div className="space-y-2">
        {[
          { ep: "2019-09 → 2020-01", regime: "Stable", sim: 0.86, fwd: "+2.4%" },
          { ep: "2013-10 → 2014-03", regime: "Bull",   sim: 0.79, fwd: "+5.8%" },
          { ep: "2015-12 → 2016-05", regime: "Stable", sim: 0.74, fwd: "+3.1%" },
        ].map((ep) => (
          <div key={ep.ep} className="flex items-center gap-3 rounded-lg border border-[#D9EAE2] bg-white px-3 py-2.5 text-xs">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[#0F2B23]">{ep.ep}</p>
              <p className="text-[#5A736A]">{ep.regime}</p>
            </div>
            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[#EEF6F2]">
              <div className="h-full rounded-full bg-[#0FA77A]" style={{ width: `${ep.sim * 100}%` }} />
            </div>
            <span className="w-8 text-right font-bold text-[#0A8A67]">{Math.round(ep.sim * 100)}%</span>
            <span className="w-12 text-right font-bold" style={{ color: ep.fwd.startsWith("+") ? "#0A8A67" : "#B91C1C" }}>{ep.fwd} 6M</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-[#7A938A]">
        6M forward return shows what happened after each analog ended. Updated daily from live market data.
      </p>
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
        <div className="mt-2 flex justify-between text-[9px] text-[#5A736A]">
          <span>−30%</span><span>0%</span><span>+60%</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Regimes tracked", value: "7" },
          { label: "Macro dimensions", value: "6" },
          { label: "Forward window", value: "6 months" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-[#D9EAE2] bg-white px-3 py-2">
            <p className="text-[10px] font-semibold uppercase text-[#6A827A]">{s.label}</p>
            <p className="mt-0.5 text-xs font-semibold text-[#0A8A67]">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const WORKFLOW_STEPS_DATA = [
  {
    step: "01",
    title: "You ask a question",
    subtitle: "Natural language, no syntax needed",
    accent: "#0FA77A",
    accentLight: "#EAF9F3",
    accentBorder: "#BCE8DA",
    preview: (
      <div className="space-y-3">
        <div className="rounded-xl border border-[#D5E5DD] bg-[#F8FCFA] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7A938A]">Query</p>
          <p className="mt-1.5 text-sm font-medium text-[#0F2B23]">
            What happened after yield curve inversions deeper than −0.30%?
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["VIX > 30 + Fed cutting", "Post-CPI peak 8%+", "2020 COVID analog", "Yield inversion −0.3%"].map((q) => (
            <span key={q} className="rounded-lg border border-[#D5E5DD] bg-white px-2.5 py-1 text-[10px] font-medium text-[#5A736A]">{q}</span>
          ))}
        </div>
      </div>
    ),
  },
  {
    step: "02",
    title: "Market state is structured",
    subtitle: "6 macro dimensions, refreshed daily",
    accent: "#1AADB0",
    accentLight: "#EAF8F9",
    accentBorder: "#B8E3E6",
    preview: (
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "SPY return", value: "−1.8%", color: "#B91C1C" },
          { label: "VIX", value: "28.4", color: "#F59B23" },
          { label: "CPI YoY", value: "3.2%", color: "#F59B23" },
          { label: "Fed rate", value: "5.25%", color: "#1AADB0" },
          { label: "Yield curve", value: "−0.41%", color: "#B91C1C" },
          { label: "Regime", value: "TIGHTENING", color: "#1AADB0" },
        ].map((m) => (
          <div key={m.label} className="rounded-lg border border-[#D5E5DD] bg-white px-2.5 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#7A938A]">{m.label}</p>
            <p className="mt-0.5 text-xs font-bold" style={{ color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    step: "03",
    title: "Historical episodes retrieved",
    subtitle: "Ranked by vector similarity, not recency",
    accent: "#7C3AED",
    accentLight: "#F5F3FF",
    accentBorder: "#DDD6FE",
    preview: (
      <div className="space-y-2">
        {[
          { ep: "2019-08 → 2020-02", regime: "TIGHTENING", sim: 0.84, fwd: "+1.1%" },
          { ep: "2006-07 → 2007-01", regime: "TIGHTENING", sim: 0.79, fwd: "−4.2%" },
          { ep: "2000-02 → 2000-09", regime: "SELLOFF", sim: 0.71, fwd: "−18.3%" },
        ].map((ep) => (
          <div key={ep.ep} className="flex items-center gap-2 rounded-lg border border-[#EDE9FD] bg-white px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-[#0F2B23]">{ep.ep}</p>
              <p className="text-[9px] text-[#7A938A]">{ep.regime}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#EEF6F2]">
                <div className="h-full rounded-full bg-[#7C3AED]" style={{ width: `${ep.sim * 100}%` }} />
              </div>
              <span className="w-8 text-right text-[10px] font-bold text-[#7C3AED]">{Math.round(ep.sim * 100)}%</span>
              <span className="w-12 text-right text-[10px] font-bold" style={{ color: ep.fwd.startsWith("+") ? "#0A8A67" : "#B91C1C" }}>{ep.fwd}</span>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    step: "04",
    title: "Cited answer returned",
    subtitle: "Confidence score, not false certainty",
    accent: "#F59B23",
    accentLight: "#FFF8EC",
    accentBorder: "#FDDFA6",
    preview: (
      <div className="rounded-xl border border-[#D5E5DD] bg-white px-4 py-3 text-sm leading-7 text-[#1F3F35]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A8A67]">FinMem · 3 analogs found</p>
        <p className="mt-2 text-xs text-[#1F3F35]">
          Mixed outcomes across 3 episodes. The 2019 analog saw modest recovery (+1.1%) while 2006 and 2000 saw drawdowns. Yield inversions do not uniformly predict direction.
        </p>
        <div className="mt-3 flex items-center gap-3 border-t border-[#EEF5F2] pt-2 text-[11px]">
          <span className="font-bold text-[#F59B23]">Confidence 68%</span>
          <span className="text-[#7A938A]">· Mixed analog quality</span>
        </div>
      </div>
    ),
  },
];

function WorkflowSection({ headingFont }: { headingFont: string }) {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const DURATION = 3500;
    const TICK = 40;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += TICK;
      setProgress(Math.min(100, (elapsed / DURATION) * 100));
      if (elapsed >= DURATION) {
        elapsed = 0;
        setProgress(0);
        setActive((a) => (a + 1) % WORKFLOW_STEPS_DATA.length);
      }
    }, TICK);
    return () => clearInterval(timer);
  }, [active]);

  const step = WORKFLOW_STEPS_DATA[active];

  return (
    <section id="workflow" className="py-20 bg-white border-y border-[#D6E8E0]">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <p className={`${headingFont} text-xs font-semibold uppercase tracking-[0.12em] text-[#0A8A67]`}>How it works</p>
        <h2 className={`${headingFont} mt-3 max-w-2xl text-3xl font-bold leading-tight text-[#0F2B23] md:text-4xl`}>
          From question to cited answer in four steps.
        </h2>
        <p className="mt-4 max-w-xl text-base text-[#4D665D] leading-7">
          Every response traces back to real historical episodes — ranked by structural similarity, not keyword match or calendar proximity.
        </p>

        <div className="mt-12 grid gap-8 lg:grid-cols-[340px_1fr]">
          {/* Step tabs */}
          <div className="flex flex-col gap-2">
            {WORKFLOW_STEPS_DATA.map((s, i) => {
              const isActive = i === active;
              return (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => { setActive(i); setProgress(0); }}
                  className={`group w-full rounded-2xl border p-4 text-left transition-all duration-200 ${
                    isActive
                      ? "border-[#BCE8DA] bg-[#EAF9F3] shadow-[0_8px_24px_-10px_rgba(15,167,122,0.25)]"
                      : "border-[#D7E8E0] bg-white hover:border-[#BCE8DA] hover:bg-[#F5FCF8]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold transition"
                      style={{
                        background: isActive ? s.accent : "#F2FAF6",
                        color: isActive ? "white" : "#5A736A",
                      }}
                    >
                      {s.step}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold ${isActive ? "text-[#0F2B23]" : "text-[#3D5248]"}`}>{s.title}</p>
                      <p className="mt-0.5 text-[11px] text-[#7A938A]">{s.subtitle}</p>
                      {isActive && (
                        <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#D4EDE3]">
                          <div
                            className="h-full rounded-full transition-none"
                            style={{ width: `${progress}%`, background: s.accent }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Preview panel */}
          <div
            className="relative overflow-hidden rounded-2xl border p-6 transition-all duration-300"
            style={{ borderColor: step.accentBorder, background: step.accentLight }}
          >
            {/* Step number watermark */}
            <span
              className={`${headingFont} pointer-events-none absolute -right-3 -top-4 select-none text-[96px] font-black opacity-[0.07]`}
              style={{ color: step.accent }}
              aria-hidden
            >
              {step.step}
            </span>

            <div className="relative">
              <div className="mb-1 flex items-center gap-2">
                <span
                  className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white"
                  style={{ background: step.accent }}
                >
                  Step {step.step}
                </span>
                <span className="text-[11px] text-[#5A736A]">{step.subtitle}</span>
              </div>
              <h3 className={`${headingFont} mb-4 text-xl font-bold text-[#0F2B23]`}>{step.title}</h3>
              <div key={active} className="slide-up">
                {step.preview}
              </div>
            </div>

            {/* Step dots nav */}
            <div className="absolute bottom-4 right-5 flex items-center gap-1.5">
              {WORKFLOW_STEPS_DATA.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setActive(i); setProgress(0); }}
                  className="h-1.5 rounded-full transition-all duration-200"
                  style={{
                    width: i === active ? "20px" : "6px",
                    background: i === active ? step.accent : "#C5D9D0",
                  }}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom connector hint */}
        <div className="mt-10 flex items-center justify-center gap-3 text-xs text-[#7A938A]">
          <span className="h-px flex-1 bg-[#D6E8E0]" />
          <span className="flex items-center gap-1.5 rounded-full border border-[#D6E8E0] bg-[#F8FCFA] px-4 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0FA77A] opacity-50" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#0FA77A]" />
            </span>
            Live · updated daily from FRED and yfinance
          </span>
          <span className="h-px flex-1 bg-[#D6E8E0]" />
        </div>
      </div>
    </section>
  );
}

function HeroRetrieval({ headingFont }: { headingFont: string }) {
  return (
    <div className="relative float-y">
      {/* Ambient glows */}
      <div
        className="pointer-events-none absolute -inset-10 rounded-3xl opacity-50 blur-3xl"
        style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(15,167,122,0.22) 0%, rgba(26,173,176,0.10) 45%, transparent 70%)" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-10 -left-10 h-44 w-44 rounded-full opacity-25 blur-2xl"
        style={{ background: "radial-gradient(circle, rgba(167,139,250,0.55), transparent)" }}
        aria-hidden
      />

      {/* Dot grid backdrop */}
      <div
        className="pointer-events-none absolute -inset-4 rounded-3xl opacity-[0.04]"
        style={{ backgroundImage: "radial-gradient(#0FA77A 1px, transparent 1px)", backgroundSize: "18px 18px" }}
        aria-hidden
      />

      {/* ── Floating graph: SPY sparkline (top-right, outside card) ── */}
      <div
        className="absolute -right-5 -top-3 z-20 slide-up float-chip-a w-[152px] rounded-2xl border border-[#D4EDE3] bg-white p-3 shadow-[0_14px_36px_-10px_rgba(12,58,44,0.24)]"
        style={{ animationDelay: "350ms" }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#5A736A]">SPY · 6-month</span>
          <span className="text-[11px] font-bold text-[#0A8A67]">+12.4%</span>
        </div>
        <svg width="124" height="36" viewBox="0 0 124 36" fill="none">
          <defs>
            <linearGradient id="spyFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0FA77A" stopOpacity="0.18"/>
              <stop offset="100%" stopColor="#0FA77A" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path
            d="M2,30 C10,28 16,26 24,22 C32,18 36,20 44,16 C52,12 58,14 66,10 C74,6 80,8 88,5 C96,2 104,4 122,2"
            fill="none" stroke="#0FA77A" strokeWidth="1.8" strokeLinecap="round"
          />
          <path
            d="M2,30 C10,28 16,26 24,22 C32,18 36,20 44,16 C52,12 58,14 66,10 C74,6 80,8 88,5 C96,2 104,4 122,2 L122,36 L2,36Z"
            fill="url(#spyFill)"
          />
          <circle cx="122" cy="2" r="2.5" fill="#0FA77A"/>
        </svg>
      </div>

      {/* ── Floating graph: Analog similarity bars (left-center, outside card) ── */}
      <div
        className="absolute -left-5 top-[38%] z-20 slide-up float-chip-b w-[158px] -translate-y-1/2 rounded-2xl border border-[#D4EDE3] bg-white p-3 shadow-[0_14px_36px_-10px_rgba(12,58,44,0.24)]"
        style={{ animationDelay: "550ms" }}
      >
        <p className="mb-2.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#5A736A]">Analog similarity</p>
        {([
          { ep: "2019-08", pct: 87, color: "#0FA77A" },
          { ep: "2006-07", pct: 81, color: "#1AADB0" },
          { ep: "2000-02", pct: 74, color: "#F59B23" },
        ] as const).map((r) => (
          <div key={r.ep} className="mb-1.5 flex items-center gap-2 last:mb-0">
            <span className="w-12 shrink-0 font-mono text-[8px] text-[#7A938A]">{r.ep}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EEF6F2]">
              <div
                className="h-full rounded-full"
                style={{ width: `${r.pct}%`, background: r.color }}
              />
            </div>
            <span className="w-7 text-right text-[9px] font-bold" style={{ color: r.color }}>{r.pct}%</span>
          </div>
        ))}
      </div>

      {/* ── Floating graph: Return distribution histogram (bottom-center) ── */}
      <div
        className="absolute -bottom-3 left-1/2 z-20 slide-up float-chip-a w-[178px] -translate-x-1/2 rounded-2xl border border-[#E8E0F8] bg-[#FAF8FF] p-3 shadow-[0_14px_36px_-10px_rgba(100,60,200,0.2)]"
        style={{ animationDelay: "750ms" }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#6B5A9A]">6M return dist.</span>
          <span className="text-[10px] font-bold text-[#7C3AED]">all episodes</span>
        </div>
        <div className="flex h-10 items-end gap-[3px]">
          {[6,10,16,24,34,42,36,26,16,10,6].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm"
              style={{
                height: `${(h / 42) * 100}%`,
                background: i === 5
                  ? "linear-gradient(180deg,#7C3AED,#A78BFA)"
                  : i === 4 || i === 6
                  ? "rgba(124,58,237,0.35)"
                  : "rgba(167,139,250,0.2)",
              }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[8px] text-[#8A7AB0]">
          <span>−30%</span>
          <span className="font-semibold text-[#7C3AED]">peak +8.4%</span>
          <span>+60%</span>
        </div>
      </div>

      {/* ── Live badge (top-left, inline with card) ── */}
      <div
        className="absolute -left-3 -top-4 z-20 slide-up flex items-center gap-1.5 rounded-xl border border-[#BCE8DA] bg-white px-2.5 py-1.5 shadow-[0_8px_20px_-8px_rgba(12,58,44,0.22)]"
        style={{ animationDelay: "200ms" }}
      >
        <span className="relative flex h-2 w-2">
          <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-[#0FA77A] opacity-50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0FA77A]" />
        </span>
        <span className="text-[10px] font-bold text-[#0F2B23]">Live</span>
      </div>

      {/* Dashboard mockup card */}
      <div className="relative overflow-hidden rounded-2xl border border-[#CDE8DC] bg-[#F4FAF7] shadow-[0_32px_80px_-20px_rgba(15,43,35,0.14),0_0_0_1px_rgba(15,167,122,0.08)]">
        {/* Inner top tint */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-40"
          style={{ background: "linear-gradient(180deg, rgba(15,167,122,0.06) 0%, transparent 100%)" }}
          aria-hidden
        />

        {/* Browser chrome */}
        <div className="relative flex items-center gap-3 border-b border-[#D7E8E0] bg-white px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F08680]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#F5C25F]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#8FE0B5]" />
          </div>
          <div className="flex flex-1 items-center gap-1.5 rounded-md border border-[#E0EDE7] bg-[#F8FCFA] px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-[#0FA77A]/40" />
            <span className="text-[10px] text-[#5A736A]">finmem.app/dashboard</span>
          </div>
        </div>

        {/* App shell: sidebar + main */}
        <div className="flex">
          {/* Mini sidebar */}
          <div className="shrink-0 border-r border-[#D7E8E0] bg-white py-4" style={{ width: "112px" }}>
            <div className="px-3 pb-3">
              <p className={`${headingFont} text-[11px] font-bold text-[#0F2B23]`}>FinMem</p>
              <p className="text-[8px] uppercase tracking-widest text-[#7A938A]">Research</p>
            </div>
            <div className="space-y-0.5 px-2">
              {[
                { label: "Dashboard", active: true,  color: "#0FA77A" },
                { label: "Today",     active: false, color: "#1AADB0" },
                { label: "Memory",    active: false, color: "#A78BFA" },
                { label: "Chat",      active: false, color: "#F59B23" },
                { label: "Analytics", active: false, color: "#7A938A" },
              ].map(({ label, active, color }) => (
                <div
                  key={label}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${active ? "bg-[#E9F9F3]" : ""}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? color : "#D7E8E0" }} />
                  <span className={`text-[9px] font-medium ${active ? "text-[#0A8A67]" : "text-[#5A736A]"}`}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Dashboard content */}
          <div className="flex-1 overflow-hidden px-4 py-3.5">
            {/* Page title row */}
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className={`${headingFont} text-[11px] font-bold text-[#0F2B23]`}>Dashboard</p>
                <p className="text-[9px] text-[#5A736A]">Research system overview</p>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-[#D7E8E0] bg-white px-2 py-1 text-[9px] text-[#5A736A]">
                <span className="text-[#0A8A67]">↻</span> Refresh
              </div>
            </div>

            {/* Market state tiles */}
            <p className="mb-1.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-[#0A8A67]">Current market state</p>
            <div className="mb-3 grid grid-cols-5 gap-1.5">
              {[
                { label: "SPY",      val: "$547",  color: "#0FA77A", delta: "+0.4%" },
                { label: "Regime",   val: "Stable", color: "#1AADB0", delta: null },
                { label: "VIX",      val: "18.4",  color: "#0FA77A", delta: null },
                { label: "Fed Rate", val: "4.25%", color: "#1AADB0", delta: null },
                { label: "CPI",      val: "3.2%",  color: "#A78BFA", delta: null },
              ].map(m => (
                <div key={m.label} className="rounded-lg border border-[#E5F0EA] bg-white px-1.5 py-2">
                  <p className="text-[7px] text-[#7A938A]">{m.label}</p>
                  <p className="mt-0.5 text-[9px] font-bold leading-none" style={{ color: m.color }}>{m.val}</p>
                  {m.delta && <p className="mt-0.5 text-[7px] font-semibold text-[#0A8A67]">{m.delta}</p>}
                </div>
              ))}
            </div>

            {/* Health + Episodes row */}
            <div className="mb-3 grid grid-cols-2 gap-2">
              {/* System health */}
              <div className="rounded-xl border border-[#D7E8E0] bg-white px-3 py-2.5">
                <p className="mb-2 text-[8px] font-semibold uppercase tracking-[0.1em] text-[#0A8A67]">System health</p>
                {[
                  { label: "Status",     val: "Ready", color: "#0FA77A" },
                  { label: "Episodes",   val: "72",    color: "#1AADB0" },
                  { label: "Complete",   val: "98%",   color: "#0FA77A", bar: 98 },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between border-t border-[#F0F8F4] py-1 first:border-0">
                    <span className="text-[8px] text-[#5A736A]">{r.label}</span>
                    <div className="flex items-center gap-1.5">
                      {r.bar && (
                        <div className="h-1 w-12 overflow-hidden rounded-full bg-[#E8F5EF]">
                          <div className="h-full rounded-full bg-[#0FA77A]" style={{ width: `${r.bar}%` }} />
                        </div>
                      )}
                      <span className="text-[8px] font-bold" style={{ color: r.color }}>{r.val}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Episode distribution */}
              <div className="rounded-xl border border-[#D7E8E0] bg-white px-3 py-2.5">
                <p className="mb-2 text-[8px] font-semibold uppercase tracking-[0.1em] text-[#0A8A67]">Episode distribution</p>
                {[
                  { label: "Stable",     count: 22, color: "#1AADB0", pct: 31 },
                  { label: "Bull",       count: 14, color: "#0FA77A", pct: 19 },
                  { label: "Tightening", count: 11, color: "#F59B23", pct: 15 },
                  { label: "Crisis",     count: 8,  color: "#E22134", pct: 11 },
                ].map(r => (
                  <div key={r.label} className="flex items-center gap-1.5 py-0.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: r.color }} />
                    <span className="flex-1 text-[8px] text-[#5A736A]">{r.label}</span>
                    <div className="h-1 w-10 overflow-hidden rounded-full bg-[#F0F8F4]">
                      <div className="h-full rounded-full" style={{ width: `${r.pct * 2}%`, background: r.color }} />
                    </div>
                    <span className="w-4 text-right text-[8px] font-bold text-[#0F2B23]">{r.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick nav */}
            <p className="mb-1.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-[#0A8A67]">Quick navigation</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: "Today\'s Analog Match", color: "#0FA77A" },
                { label: "Episode Memory",         color: "#1AADB0" },
                { label: "Ask FinMem",             color: "#A78BFA" },
                { label: "Outcome Analytics",      color: "#F59B23" },
              ].map(c => (
                <div key={c.label} className="flex items-center gap-2 rounded-lg border border-[#E5F0EA] bg-white px-2 py-1.5 transition hover:border-[#C5DDD5]">
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: `${c.color}30`, border: `1px solid ${c.color}50` }} />
                  <span className="text-[8px] font-medium text-[#0F2B23]">{c.label}</span>
                </div>
              ))}
            </div>
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

  useEffect(() => {
    if (!mobileOpen) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = orig; };
  }, [mobileOpen]);

  return (
    <div className={`${bodyFontClass} relative min-h-screen overflow-x-hidden bg-[#F4FAF7] text-[#102E25]`}>
      <style jsx global>{`
        @keyframes driftA { 0%,100%{transform:translate3d(0,0,0) scale(1)} 50%{transform:translate3d(32px,-20px,0) scale(1.07)} }
        @keyframes driftB { 0%,100%{transform:translate3d(0,0,0) scale(1)} 50%{transform:translate3d(-24px,22px,0) scale(1.1)} }
        @keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeSwap { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulseRing { 0%{transform:scale(1);opacity:0.6} 70%{transform:scale(2.8);opacity:0} 100%{transform:scale(2.8);opacity:0} }
        @keyframes floatChip { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-4px)} }
        .drift-a{animation:driftA 14s ease-in-out infinite}
        .drift-b{animation:driftB 17s ease-in-out infinite}
        .float-y{animation:floatY 6s ease-in-out infinite}
        .fade-in{animation:fadeIn 0.5s ease-out both}
        .fade-swap{animation:fadeSwap 200ms ease-out both}
        .slide-up{animation:slideUp 0.5s ease-out both}
        .pulse-ring{animation:pulseRing 2s cubic-bezier(0.22,1,0.36,1) infinite}
        .float-chip-a{animation:floatChip 3.2s ease-in-out infinite}
        .float-chip-b{animation:floatChip 4s ease-in-out infinite;animation-delay:0.8s}
        @media(prefers-reduced-motion:reduce){.drift-a,.drift-b,.float-y,.fade-in,.fade-swap,.slide-up,.pulse-ring,.float-chip-a,.float-chip-b{animation:none!important}}
      `}</style>

      {/* Background blobs */}
      <div className="pointer-events-none fixed inset-0" aria-hidden>
        <div className="drift-a absolute -left-40 -top-32 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(15,167,122,0.18)_0%,transparent_65%)] blur-3xl" />
        <div className="drift-b absolute -right-32 top-16 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(26,173,176,0.16)_0%,transparent_65%)] blur-3xl" />
        <div className="drift-a absolute bottom-0 left-1/3 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.10)_0%,transparent_65%)] blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#D4E6DE] bg-[#F4FAF7]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">

          {/* Logo */}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] shadow-[0_6px_14px_-6px_rgba(15,167,122,0.6)]">
              <TrendingUp className="h-3.5 w-3.5 text-white" />
            </span>
            <span className={`${headingFontClass} text-lg font-bold text-[#0F2B23]`}>FinMem</span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-8 lg:flex">
            {NAV_ITEMS.map((item) => (
              <a key={item.href} href={item.href} className="text-sm font-medium text-[#51685F] transition hover:text-[#0F2B23]">
                {item.label}
              </a>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden items-center lg:flex">
            <Link
              href="/dashboard"
              className={`${headingFontClass} inline-flex h-9 items-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] px-4 text-sm font-semibold text-white shadow-[0_10px_22px_-10px_rgba(15,167,122,0.7)] transition hover:brightness-95`}
            >
              Open Workspace
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Mobile burger */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#CDE2DA] bg-white text-[#1A4034] lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="absolute inset-x-0 top-16 border-b border-[#D4E6DE] bg-[#F4FAF7]/98 backdrop-blur-xl lg:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-4">
              <div className="mb-1 flex justify-end">
                <button type="button" onClick={() => setMobileOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#CDE2DA] bg-white text-[#1A4034]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {NAV_ITEMS.map((item) => (
                <a key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#1A4034] hover:bg-white">
                  {item.label}
                </a>
              ))}
              <div className="mt-3 border-t border-[#D4E6DE] pt-3">
                <Link
                  href="/dashboard"
                  className={`${headingFontClass} flex h-11 items-center justify-center gap-2 rounded-lg bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] text-sm font-semibold text-white`}
                  onClick={() => setMobileOpen(false)}
                >
                  Open Workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="pb-16 pt-6 md:pb-24 md:pt-10">
          <div className="mx-auto grid max-w-7xl gap-14 px-5 md:px-8 lg:grid-cols-[1fr_1fr] lg:items-start">
            <div className="fade-in">
              <div className="inline-flex items-center gap-2 rounded-lg border border-[#B8E7D8] bg-white/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#0A8A67] shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Episodic Memory · Grounded Market Research
              </div>

              <h1 className={`${headingFontClass} mt-5 text-4xl font-bold leading-[1.06] text-[#0F2B23] sm:text-5xl lg:text-[3.8rem]`}>
                What happened the last time markets looked like this?
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-[#4D665D]">
                FinMem maps today's market conditions — VIX, inflation, Fed rate, yield curve shape — to the closest historical episodes and tells you what happened after each one. Real cited data, forward return outcomes, and a confidence score on every answer.
              </p>

              <div className="mt-8">
                <Link
                  href="/dashboard"
                  className={`${headingFontClass} inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] px-8 text-sm font-semibold text-white shadow-[0_16px_32px_-16px_rgba(15,167,122,0.85)] transition hover:brightness-95`}
                >
                  Open Workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {TRUST_ITEMS.map((text, i) => (
                  <span key={text} className="flex items-center gap-1.5 text-xs text-[#5A736A]">
                    {i > 0 && <span className="h-3 w-px bg-[#C5DDD5]" aria-hidden />}
                    {text}
                  </span>
                ))}
              </div>
            </div>

            <div className="lg:pt-12">
              <HeroRetrieval headingFont={headingFontClass} />
            </div>
          </div>
        </section>

        {/* Stack badges */}
        <div className="border-y border-[#D6E8E0] bg-white/70 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2 px-5 py-4 md:px-8">
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#7A938A]">Powered by</span>
            {["yfinance", "FRED", "LanceDB", "PostgreSQL", "Episode detection", "OpenAI embeddings"].map((s) => (
              <span key={s} className="rounded-md border border-[#D8E9E2] bg-[#F8FCFA] px-3 py-1.5 text-[11px] font-semibold text-[#4F685F]">
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* How it works */}
        <WorkflowSection headingFont={headingFontClass} />

        {/* Research workspace */}
        <section id="product" className="border-y border-[#D6E8E0] bg-[#F8FCFA] py-20">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <p className={`${headingFontClass} text-xs font-semibold uppercase tracking-[0.12em] text-[#0A8A67]`}>The research workspace</p>
            <h2 className={`${headingFontClass} mt-3 max-w-2xl text-3xl font-bold leading-tight text-[#0F2B23] md:text-4xl`}>
              Four tools. Every answer backed by real episodes.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-[#4D665D]">
              Not a chat box — a full research environment where every surface draws from the same episodic memory layer.
            </p>
            <div className="mt-10 grid gap-5 lg:grid-cols-[300px_1fr]">
              <div className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-2 lg:overflow-visible">
                {TOUR_TABS.map((tab, idx) => {
                  const active = tourTab === idx;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setTourTab(idx)}
                      className={`flex min-w-[200px] shrink-0 items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition lg:min-w-0 ${
                        active
                          ? "border-[#BCE8DA] bg-white shadow-[0_6px_20px_-8px_rgba(15,167,122,0.2)]"
                          : "border-transparent bg-transparent hover:border-[#D7E8E0] hover:bg-white/70"
                      }`}
                    >
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${active ? "bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] text-white shadow-[0_8px_18px_-8px_rgba(15,167,122,0.6)]" : "bg-[#F2FAF6] text-[#0A8A67]"}`}>
                        <tab.icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className={`${headingFontClass} block text-sm font-semibold ${active ? "text-[#0F2B23]" : "text-[#4D665D]"}`}>{tab.title}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-[#5A736A]">{tab.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div key={tourTab} className="fade-swap">
                <BrowserChrome label={`finmem.app/${TOUR_TABS[tourTab].key}`}>
                  {tourTab === 0 && <TourChat />}
                  {tourTab === 1 && <TourToday />}
                  {tourTab === 2 && <TourMemory />}
                  {tourTab === 3 && <TourAnalytics />}
                </BrowserChrome>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <p className={`${headingFontClass} text-xs font-semibold uppercase tracking-[0.12em] text-[#0A8A67]`}>What makes it different</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <h2 className={`${headingFontClass} max-w-xl text-3xl font-bold leading-tight text-[#0F2B23] md:text-4xl`}>
                Not a chatbot. A research system built on real episodes.
              </h2>
              <p className="max-w-sm text-sm leading-7 text-[#5A736A]">
                Every design decision optimizes for accuracy and traceability, not fluency.
              </p>
            </div>
            <div className="mt-10 grid gap-4 lg:grid-cols-2">
              {/* Feature 1 — hero card, spans full width on lg */}
              {FEATURES.slice(0, 1).map((f) => (
                <div
                  key={f.title}
                  className="lg:col-span-2 relative overflow-hidden rounded-2xl border p-6 md:p-8"
                  style={{ borderColor: f.accent + "30", background: f.accentBg }}
                >
                  <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
                    <div className="flex-1">
                      <span
                        className="inline-flex items-center rounded-md px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                        style={{ background: f.accent + "22", color: f.accent }}
                      >
                        {f.tag}
                      </span>
                      <h3 className={`${headingFontClass} mt-3 text-xl font-bold text-[#0F2B23] md:text-2xl`}>{f.title}</h3>
                      <p className="mt-3 max-w-lg text-sm leading-7 text-[#4D665D]">{f.body}</p>
                    </div>
                    <div className="shrink-0 flex items-center justify-center rounded-2xl border bg-white p-4 shadow-sm md:h-20 md:w-20" style={{ borderColor: f.accent + "30" }}>
                      <f.icon className="h-8 w-8 md:h-10 md:w-10" style={{ color: f.accent }} />
                    </div>
                  </div>
                </div>
              ))}
              {/* Features 2–4 — vertical flashcards side by side */}
              <div className="lg:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {FEATURES.slice(1).map((f) => (
                  <div
                    key={f.title}
                    className="flex flex-col overflow-hidden rounded-2xl border border-[#D7E8E0] bg-white shadow-[0_18px_40px_-26px_rgba(12,58,44,0.18)]"
                  >
                    {/* Colored top strip */}
                    <div className="h-1 w-full" style={{ background: f.accent }} />
                    {/* Icon block */}
                    <div className="flex items-center justify-center py-7" style={{ background: f.accentBg }}>
                      <span
                        className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-[0_8px_20px_-8px_rgba(0,0,0,0.15)]"
                        style={{ background: f.accent }}
                      >
                        <f.icon className="h-7 w-7 text-white" />
                      </span>
                    </div>
                    {/* Text block */}
                    <div className="flex flex-1 flex-col p-5">
                      <span
                        className="self-start mb-3 inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                        style={{ background: f.accent + "18", color: f.accent }}
                      >
                        {f.tag}
                      </span>
                      <h3 className={`${headingFontClass} text-sm font-bold leading-snug text-[#0F2B23]`}>{f.title}</h3>
                      <p className="mt-2.5 flex-1 text-sm leading-7 text-[#4D665D]">{f.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section id="compare" className="border-y border-[#D6E8E0] bg-white py-20">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <p className={`${headingFontClass} text-xs font-semibold uppercase tracking-[0.12em] text-[#0A8A67]`}>Why retrieval-first</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <h2 className={`${headingFontClass} max-w-xl text-3xl font-bold leading-tight text-[#0F2B23] md:text-4xl`}>
                FinMem vs ChatGPT vs a date-range lookup.
              </h2>
              <p className="max-w-xs text-sm leading-7 text-[#5A736A]">
                Three very different ways to ask a market question — with very different guarantees.
              </p>
            </div>
            <div className="mt-10 overflow-x-auto rounded-2xl border border-[#D7E8E0] shadow-[0_12px_40px_-20px_rgba(12,58,44,0.12)]">
              {/* Header */}
              <div className="grid min-w-[680px] grid-cols-[1.3fr_1.2fr_1fr_1fr] border-b border-[#DDECE6]">
                <div className="bg-[#F4FAF7] px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7A938A]">Capability</div>
                <div className="flex items-center gap-2 bg-[#0F2B23] px-5 py-3.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#0FA77A]" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-white">FinMem</span>
                </div>
                <div className="bg-[#F4FAF7] px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7A938A]">ChatGPT / LLMs</div>
                <div className="bg-[#F4FAF7] px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7A938A]">Date-range lookup</div>
              </div>
              {COMPARISON_ROWS.map((row, i) => (
                <div
                  key={row.metric}
                  className="grid min-w-[680px] grid-cols-[1.3fr_1.2fr_1fr_1fr] border-b border-[#EEF5F2] last:border-0"
                >
                  <div className={`${headingFontClass} bg-[#FAFCFB] px-5 py-4 text-sm font-semibold text-[#173F33]`}>{row.metric}</div>
                  {/* FinMem cell — always highlighted */}
                  <div className={`flex items-start gap-2 px-5 py-4 ${i % 2 === 0 ? "bg-[#F2FAF6]" : "bg-[#F8FCFA]"}`}>
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                      row.finmem.status === "pro" ? "bg-[#0FA77A] text-white" : row.finmem.status === "partial" ? "bg-[#F59B23] text-white" : "bg-[#E2E8E4] text-[#7A938A]"
                    }`}>
                      {row.finmem.status === "pro" ? "✓" : row.finmem.status === "partial" ? "~" : "✗"}
                    </span>
                    <span className="text-sm font-medium text-[#0A8A67]">{row.finmem.text}</span>
                  </div>
                  {/* LLM cell */}
                  <div className="flex items-start gap-2 px-5 py-4">
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                      row.llm.status === "pro" ? "bg-[#0FA77A] text-white" : row.llm.status === "partial" ? "bg-[#F59B23] text-white" : "bg-[#F1EAEA] text-[#A05050]"
                    }`}>
                      {row.llm.status === "pro" ? "✓" : row.llm.status === "partial" ? "~" : "✗"}
                    </span>
                    <span className="text-sm text-[#5A736A]">{row.llm.text}</span>
                  </div>
                  {/* Window cell */}
                  <div className="flex items-start gap-2 px-5 py-4">
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                      row.window.status === "pro" ? "bg-[#0FA77A] text-white" : row.window.status === "partial" ? "bg-[#F59B23] text-white" : "bg-[#F1EAEA] text-[#A05050]"
                    }`}>
                      {row.window.status === "pro" ? "✓" : row.window.status === "partial" ? "~" : "✗"}
                    </span>
                    <span className="text-sm text-[#5A736A]">{row.window.text}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-xs text-[#7A938A]">
              ✓ native capability &nbsp;·&nbsp; ~ partial or conditional &nbsp;·&nbsp; ✗ not supported
            </p>
          </div>
        </section>

        {/* Who it's for */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <p className={`${headingFontClass} text-xs font-semibold uppercase tracking-[0.12em] text-[#0A8A67]`}>Who it&apos;s for</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <h2 className={`${headingFontClass} max-w-xl text-3xl font-bold leading-tight text-[#0F2B23] md:text-4xl`}>
                If you&apos;ve ever asked &ldquo;has the market been here before?&rdquo;
              </h2>
              <p className="max-w-xs text-sm leading-7 text-[#5A736A]">
                FinMem is built for people who need evidence, not eloquence.
              </p>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {PERSONAS.map((p) => (
                <div
                  key={p.title}
                  className="flex flex-col overflow-hidden rounded-2xl border border-[#D7E8E0] bg-white shadow-[0_18px_40px_-26px_rgba(12,58,44,0.18)]"
                >
                  {/* Accent top bar */}
                  <div className="h-1 w-full" style={{ background: p.accent }} />
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: p.accent + "18" }}
                      >
                        <p.icon className="h-4 w-4" style={{ color: p.accent }} />
                      </span>
                      <div>
                        <span
                          className="block text-[10px] font-bold uppercase tracking-[0.12em]"
                          style={{ color: p.accent }}
                        >
                          {p.tag}
                        </span>
                        <h3 className={`${headingFontClass} text-sm font-bold text-[#0F2B23]`}>{p.title}</h3>
                      </div>
                    </div>
                    <div className="mt-4 rounded-lg border border-[#EEF5F2] bg-[#FAFCFB] px-3.5 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7A938A]">The situation</p>
                      <p className="mt-1 text-xs leading-6 text-[#3D5248] italic">{p.problem}</p>
                    </div>
                    <p className="mt-4 flex-1 text-sm leading-7 text-[#4D665D]">{p.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-y border-[#D6E8E0] bg-[#F8FCFA] py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 md:px-8 lg:grid-cols-[300px_1fr]">
            <div>
              <p className={`${headingFontClass} text-xs font-semibold uppercase tracking-[0.12em] text-[#0A8A67]`}>FAQ</p>
              <h2 className={`${headingFontClass} mt-3 text-3xl font-bold leading-tight text-[#0F2B23]`}>
                Questions about FinMem.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#4D665D]">
                Straight answers about what the system does, how retrieval works, and what it doesn&apos;t do.
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
            <p className={`${headingFontClass} text-xs font-semibold uppercase tracking-[0.12em] text-[#0A8A67]`}>Get started</p>
            <h2 className={`${headingFontClass} mt-4 text-3xl font-bold leading-tight text-[#0F2B23] md:text-4xl`}>
              See what history says about today's market.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-[#4D665D]">
              No account. No sign-up. Click once and the full research workspace opens — episode browser, chat, analytics, and today's live analog match.
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                href="/dashboard"
                className={`${headingFontClass} inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] px-10 text-sm font-semibold text-white shadow-[0_18px_36px_-18px_rgba(15,167,122,0.85)] transition hover:brightness-95`}
              >
                Open Workspace
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
              <span className={`${headingFontClass} text-xl font-bold text-[#0F2B23]`}>FinMem</span>
              <p className="mt-3 text-sm leading-7 text-[#5A736A]">
                Episodic market memory for financial analysts. Cited historical analogs, confidence-aware answers, and a full research workspace.
              </p>
              <div className="mt-4">
                <Link
                  href="/dashboard"
                  className={`${headingFontClass} inline-flex h-9 items-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] px-4 text-xs font-semibold text-white hover:brightness-95`}
                >
                  Open Workspace
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              <div>
                <p className={`${headingFontClass} text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A8A67]`}>Product</p>
                <ul className="mt-3 space-y-2">
                  {[
                    { label: "How it works", href: "#workflow" },
                    { label: "Workspace", href: "#product" },
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
                <p className={`${headingFontClass} text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A8A67]`}>Workspace</p>
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
                <p className={`${headingFontClass} text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A8A67]`}>Data</p>
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
              <Link href="/dashboard" className="hover:text-[#0F2B23]">Sign In</Link>
              <Link href="/dashboard" className="hover:text-[#0F2B23]">Guest Access</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
