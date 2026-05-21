"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { fetchState } from "@/lib/api";
import { regimeColor, regimeLabel } from "@/lib/constants";
import { AlertCircle, ArrowUpRight, Calendar, Gauge, Info, Sparkles } from "lucide-react";

interface MarketState {
  date: string;
  spy_price: number;
  spy_return_1d: number;
  spy_return_5d: number;
  spy_return_21d: number;
  vix: number;
  cpi: number;
  fed_rate: number;
  yield_spread: number;
  unemployment: number;
  regime: string;
}

interface Episode {
  id: string;
  start_date: string;
  end_date: string;
  regime: string;
  similarity: number;
  similarity_pct: string;
  spy_return_6m_after: number | null;
  total_return: number;
  max_drawdown: number;
  vix_level: number;
  cpi: number;
  fed_rate: number;
  yield_spread: number;
  prose_summary: string;
}

/* ── info content ─────────────────────────────────────────────────── */
const TILE_INFO: Record<string, string> = {
  spy_price:
    "The latest closing price of SPY, the S&P 500 ETF.\n\nThe number below it shows how much it moved today as a percentage.",
  spy_21d:
    "How much SPY has gained or lost over the last 21 trading days — roughly one month.\n\nPositive = the market has been trending up. Negative = it's been falling.",
  vix:
    "The VIX is the market's 'fear gauge' — it measures how much volatility traders expect over the next 30 days.\n\nBelow 20 → calm\n20–30 → elevated stress\nAbove 30 → high fear or crisis",
  fed_rate:
    "The Federal Funds Rate — the interest rate the Fed sets to control borrowing costs across the economy.\n\nHigh rates cool inflation but slow growth. Low rates stimulate the economy.",
  cpi:
    "Year-over-year inflation. Shows how much prices have risen compared to 12 months ago.\n\nThe Fed's target is around 2%. Above 4–5% is considered high inflation.",
  yield_spread:
    "The gap between the 10-year and 2-year U.S. Treasury yields.\n\nNormal (positive) = economy is growing. Inverted (negative) = often a warning sign that a recession may be coming.",
  unemployment:
    "The percentage of people actively looking for work who can't find a job.\n\nBelow 4% is considered very healthy. Above 6% signals economic weakness.",
  spy_5d:
    "SPY's return over the last 5 trading days — about one week.\n\nA quick look at very short-term momentum.",
};

const ANALOG_INFO = {
  section:
    "How this works:\n\n1. FinMem takes today's market conditions (VIX, CPI, Fed rate, yield spread, SPY momentum) and converts them into a numeric fingerprint.\n\n2. It searches the full historical episode library and finds the periods whose fingerprints are most similar to today's.\n\n3. These are your analogs — not predictions, but historical base rates. They show what the market did after similar past environments.",
  similarity:
    "How closely this historical period's conditions matched today's market.\n\n100% would mean an identical match. In practice, 20–40% is a strong match across 30+ years of history.",
  episode_return:
    "How much SPY gained or lost during this historical episode itself — from its start date to its end date.",
  after_6m:
    "What SPY did in the 6 months after this historical episode ended.\n\nThis is the most useful number — it gives you a base rate. If most analogs show positive 6-month returns, history suggests a similar outcome, though it's never guaranteed.",
  vix_in_ep:
    "The average VIX level during this historical episode. Lets you compare how fearful the market was then vs. today.",
  similarity_score:
    "The similarity score tells you how closely this historical period matches today's market conditions. It's calculated using a vector embedding of six features: SPY return, volatility, VIX, CPI, Fed rate, and yield spread.",
};

/* ── main page ───────────────────────────────────────────────────── */
export default function TodayPage() {
  const [state, setState] = useState<MarketState | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchState();
        setState(data.state);
        setEpisodes(data.episodes || []);
      } catch {
        setError("Failed to load current market state");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-3 text-sm text-[#5A736A]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#0FA77A]/25 border-t-[#0FA77A]" />
        Loading market state…
      </div>
    );
  }

  if (!state || error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFEDED] text-[#B91C1C]">
          <AlertCircle size={18} />
        </span>
        <div className="text-center">
          <p className="text-sm font-semibold text-[#0F2B23]">Unable to load market data</p>
          <p className="mt-1 text-xs text-[#5A736A]">The API may still be starting up — wait a moment and try again.</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#D7E8E0] bg-white px-4 text-xs font-semibold text-[#0F2B23] transition hover:bg-[#F2FAF6]"
        >
          Retry
        </button>
      </div>
    );
  }

  const accent = regimeColor(state.regime);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[#D7E8E0] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-5 md:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] text-white shadow-[0_10px_22px_-12px_rgba(15,167,122,0.55)]">
              <Gauge size={16} />
            </span>
            <div>
              <h1 className="font-[var(--font-heading)] text-2xl font-bold text-[#0F2B23]">Today</h1>
              <p className="text-sm text-[#5A736A]">Live market conditions matched against the closest historical analogs.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-[#D7E8E0] bg-white px-3 py-1.5 text-xs text-[#5A736A]">
            <Calendar size={12} className="text-[#0A8A67]" />
            {state.date}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">

          {/* ── Current conditions ── */}
          <section className="rounded-xl border border-[#D7E8E0] bg-white p-6 shadow-[0_22px_55px_-32px_rgba(12,58,44,0.32)]">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#0A8A67]">Current conditions</p>
                <p className="mt-1 text-xs text-[#5A736A]">
                  Today's price, volatility, inflation, policy rate, and yield curve signals.
                </p>
              </div>
              <span
                className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[11px] font-semibold"
                style={{ background: `${accent}18`, color: accent, borderColor: `${accent}33` }}
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: accent }} />
                {regimeLabel(state.regime)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile label="SPY price"        value={`$${state.spy_price.toFixed(2)}`}                                                          delta={state.spy_return_1d} deltaSuffix="%" accent="#0FA77A"                                        info={TILE_INFO.spy_price} />
              <Tile label="21-day return"    value={`${state.spy_return_21d >= 0 ? "+" : ""}${state.spy_return_21d.toFixed(2)}%`}              accent={state.spy_return_21d >= 0 ? "#0A8A67" : "#B91C1C"} caption="1-month momentum"                info={TILE_INFO.spy_21d} />
              <Tile label="VIX"              value={state.vix.toFixed(1)}                                                                       accent={state.vix > 30 ? "#B91C1C" : state.vix > 20 ? "#F59B23" : "#0FA77A"} caption="Fear gauge" info={TILE_INFO.vix} />
              <Tile label="Fed rate"         value={`${state.fed_rate.toFixed(2)}%`}                                                            accent="#1AADB0" caption="Overnight lending rate"                                                   info={TILE_INFO.fed_rate} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile label="Inflation (CPI)"  value={`${state.cpi.toFixed(1)}%`}                                                                 accent={state.cpi > 5 ? "#F59B23" : "#0FA77A"} caption="Year-over-year"                           info={TILE_INFO.cpi} />
              <Tile label="Yield spread"     value={`${state.yield_spread.toFixed(2)}%`}                                                        accent={state.yield_spread < 0 ? "#B91C1C" : "#0A8A67"} caption={state.yield_spread < 0 ? "Inverted curve ⚠" : "Normal curve"} info={TILE_INFO.yield_spread} />
              <Tile label="Unemployment"     value={`${state.unemployment.toFixed(1)}%`}                                                        accent="#7A938A" caption="Labour market"                                                            info={TILE_INFO.unemployment} />
              <Tile label="5-day return"     value={`${state.spy_return_5d >= 0 ? "+" : ""}${state.spy_return_5d.toFixed(2)}%`}                 accent={state.spy_return_5d >= 0 ? "#0A8A67" : "#B91C1C"} caption="This week"                       info={TILE_INFO.spy_5d} />
            </div>
          </section>

          {/* ── Matching historical episodes ── */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Sparkles size={14} className="text-[#0A8A67]" />
              <p className="flex items-center text-sm font-semibold text-[#0A8A67]">
                Matching historical episodes
                <InfoTooltip text={ANALOG_INFO.section} />
              </p>
            </div>

            <div className="mb-4 rounded-lg border border-[#D7E8E0] bg-[#F8FCF9] px-4 py-3 text-xs leading-6 text-[#4D665D]">
              <span className="mr-1.5 font-semibold text-[#0F2B23]">Note:</span>
              {`${episodes.length} episode${episodes.length === 1 ? "" : "s"} matched today's conditions.`}
              {" "}The 6-month forward return shows what happened after each analog ended — use it as a base rate, not a prediction.
            </div>

            <div className="grid gap-3">
              {episodes.map((ep, idx) => {
                const epAccent = regimeColor(ep.regime);
                // total_return, max_drawdown, spy_return_6m_after are stored as decimals → multiply by 100 for display
                const totalRetPct   = ep.total_return * 100;
                const drawdownPct   = ep.max_drawdown * 100;
                const after6mPct    = ep.spy_return_6m_after != null ? ep.spy_return_6m_after * 100 : null;

                return (
                  <Link
                    key={ep.id}
                    href={`/episodes/${ep.id}`}
                    className="group rounded-xl border border-[#D7E8E0] bg-white p-5 shadow-[0_18px_45px_-32px_rgba(12,58,44,0.3)] transition hover:-translate-y-0.5 hover:border-[#BCE8DA] hover:shadow-[0_22px_55px_-32px_rgba(15,167,122,0.4)]"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <span
                        className="rounded-md border px-2.5 py-1 text-[11px] font-semibold"
                        style={{ background: `${epAccent}18`, color: epAccent, borderColor: `${epAccent}33` }}
                      >
                        {regimeLabel(ep.regime)}
                      </span>
                      <span className="text-xs text-[#5A736A]">
                        {ep.start_date} → {ep.end_date}
                      </span>
                      <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-[#E9F9F3] px-2.5 py-0.5 text-[11px] font-semibold text-[#0A8A67]">
                        {ep.similarity_pct} match
                        <InfoTooltip text={ANALOG_INFO.similarity_score} />
                      </span>
                      <ArrowUpRight size={14} className="text-[#7A938A] transition group-hover:text-[#0A8A67]" />
                    </div>

                    <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-5">
                      <EpMetric
                        label="VIX then"
                        value={ep.vix_level.toFixed(1)}
                        info={ANALOG_INFO.vix_in_ep}
                      />
                      <EpMetric label="CPI"       value={`${ep.cpi.toFixed(1)}%`} />
                      <EpMetric label="Fed rate"  value={`${ep.fed_rate.toFixed(2)}%`} />
                      <EpMetric
                        label="Episode return"
                        value={`${totalRetPct >= 0 ? "+" : ""}${totalRetPct.toFixed(1)}%`}
                        color={totalRetPct >= 0 ? "#0A8A67" : "#B91C1C"}
                        info={ANALOG_INFO.episode_return}
                      />
                      <div className="flex flex-col leading-tight">
                        <span className="flex items-center text-[11px] font-semibold text-[#7A938A]">
                          6M after
                          <InfoTooltip text={ANALOG_INFO.after_6m} />
                        </span>
                        {after6mPct != null ? (
                          <span
                            className="font-[var(--font-heading)] text-sm font-bold tabular-nums"
                            style={{ color: after6mPct >= 0 ? "#0A8A67" : "#B91C1C" }}
                          >
                            {after6mPct >= 0 ? "+" : ""}{after6mPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-xs text-[#7A938A]" title="This episode ended recently — 6-month outcome not yet available">
                            Not yet available
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="mt-4 line-clamp-3 text-xs leading-6 text-[#5A736A]">{ep.prose_summary}</p>
                  </Link>
                );
              })}

              {episodes.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#D7E8E0] bg-white px-6 py-12 text-center">
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#F2FAF6] text-[#0A8A67]">
                    <Sparkles size={18} />
                  </span>
                  <p className="mt-3 text-sm text-[#5A736A]">No historical analogs found for today&apos;s conditions.</p>
                  <p className="mt-1.5 text-xs text-[#7A938A]">The system may be warming up, or current conditions are outside the historical range.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ── InfoTooltip (portal-based, never clipped) ───────────────────── */
function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos]         = useState({ top: 0, left: 0 });
  const ref                   = useRef<HTMLSpanElement>(null);

  const show = () => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ top: r.top + window.scrollY, left: r.left + r.width / 2 });
    }
    setVisible(true);
  };

  return (
    <>
      <span ref={ref} className="ml-1 inline-flex cursor-help align-middle" onMouseEnter={show} onMouseLeave={() => setVisible(false)}>
        <Info size={11} className={`transition ${visible ? "text-[#0A8A67]" : "text-[#B8CEC9]"}`} />
      </span>
      {visible && typeof document !== "undefined" && createPortal(
        <div
          className="pointer-events-none fixed z-[9999] w-64 -translate-x-1/2 -translate-y-full whitespace-pre-line rounded-xl border border-[#D7E8E0] bg-white p-3.5 text-[12px] font-normal leading-[1.65] tracking-normal text-[#374151] shadow-[0_12px_32px_-8px_rgba(12,58,44,0.3)]"
          style={{ top: pos.top - 10, left: pos.left }}
        >
          {text}
          <span className="absolute -bottom-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r border-[#D7E8E0] bg-white" />
        </div>,
        document.body,
      )}
    </>
  );
}

/* ── Tile ────────────────────────────────────────────────────────── */
function Tile({
  label, value, delta, deltaSuffix, caption, accent, info,
}: {
  label: string; value: string; delta?: number; deltaSuffix?: string;
  caption?: string; accent: string; info?: string;
}) {
  return (
    <div className="rounded-xl border border-[#D7E8E0] bg-white p-4 shadow-[0_14px_36px_-30px_rgba(12,58,44,0.26)]">
      <p className="flex items-center text-[11px] font-semibold text-[#7A938A]">
        {label}
        {info && <InfoTooltip text={info} />}
      </p>
      <p className="mt-2 font-[var(--font-heading)] text-xl font-bold tabular-nums" style={{ color: accent }}>
        {value}
      </p>
      {typeof delta === "number" ? (
        <p className="mt-1 text-xs font-semibold tabular-nums" style={{ color: delta >= 0 ? "#0A8A67" : "#B91C1C" }}>
          {delta >= 0 ? "+" : ""}{delta.toFixed(2)}{deltaSuffix} today
        </p>
      ) : caption ? (
        <p className="mt-1 text-xs text-[#5A736A]">{caption}</p>
      ) : null}
    </div>
  );
}

/* ── EpMetric ────────────────────────────────────────────────────── */
function EpMetric({ label, value, color = "#0F2B23", info }: {
  label: string; value: string; color?: string; info?: string;
}) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="flex items-center text-[11px] font-semibold text-[#7A938A]">
        {label}
        {info && <InfoTooltip text={info} />}
      </span>
      <span className="font-[var(--font-heading)] text-sm font-bold tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
