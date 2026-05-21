"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchState } from "@/lib/api";
import { regimeColor, regimeLabel } from "@/lib/constants";
import { AlertCircle, ArrowUpRight, Calendar, Gauge, Sparkles } from "lucide-react";

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
        <div className="h-5 w-5 rounded-full border-2 border-[#0FA77A]/25 border-t-[#0FA77A] animate-spin" />
        Loading market state…
      </div>
    );
  }

  if (!state || error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFEDED] text-[#B91C1C]">
          <AlertCircle size={18} />
        </span>
        <p className="text-sm text-[#5A736A]">{error || "Unable to load market state."}</p>
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
              <p className="text-sm text-[#5A736A]">Live market context versus the closest historical analogs.</p>
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
          {/* Current state */}
          <section className="rounded-xl border border-[#D7E8E0] bg-white p-6 shadow-[0_22px_55px_-32px_rgba(12,58,44,0.32)]">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A8A67]">
                  Current conditions
                </p>
                <p className="mt-1 text-sm text-[#4D665D]">
                  Snapshot of price, volatility, inflation, policy, and curve signals.
                </p>
              </div>
              <span
                className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{
                  background: `${accent}18`,
                  color: accent,
                  borderColor: `${accent}33`,
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: accent }} />
                {regimeLabel(state.regime)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile
                label="SPY price"
                value={`$${state.spy_price.toFixed(2)}`}
                delta={state.spy_return_1d}
                deltaSuffix="%"
                accent="#0FA77A"
              />
              <Tile
                label="SPY 21d"
                value={`${state.spy_return_21d > 0 ? "+" : ""}${state.spy_return_21d.toFixed(2)}%`}
                accent={state.spy_return_21d >= 0 ? "#0A8A67" : "#B91C1C"}
                caption="21-day momentum"
              />
              <Tile
                label="VIX"
                value={state.vix.toFixed(1)}
                accent={state.vix > 30 ? "#B91C1C" : state.vix > 20 ? "#F59B23" : "#0FA77A"}
                caption="Implied vol"
              />
              <Tile
                label="Fed rate"
                value={`${state.fed_rate.toFixed(2)}%`}
                accent="#1AADB0"
                caption="Policy"
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile
                label="CPI"
                value={`${state.cpi.toFixed(1)}%`}
                accent={state.cpi > 5 ? "#F59B23" : "#0FA77A"}
                caption="YoY inflation"
              />
              <Tile
                label="Yield spread"
                value={`${state.yield_spread.toFixed(2)}%`}
                accent={state.yield_spread < 0 ? "#B91C1C" : "#0A8A67"}
                caption={state.yield_spread < 0 ? "Inverted" : "Normal"}
              />
              <Tile
                label="Unemployment"
                value={`${state.unemployment.toFixed(1)}%`}
                accent="#7A938A"
                caption="Labour"
              />
              <Tile
                label="SPY 5d"
                value={`${state.spy_return_5d > 0 ? "+" : ""}${state.spy_return_5d.toFixed(2)}%`}
                accent={state.spy_return_5d >= 0 ? "#0A8A67" : "#B91C1C"}
                caption="Short-term"
              />
            </div>
          </section>

          {/* Analogs */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Sparkles size={14} className="text-[#0A8A67]" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A8A67]">
                Matching historical episodes
              </p>
            </div>
            <div className="mb-4 rounded-lg border border-[#D7E8E0] bg-white px-4 py-3 text-xs leading-6 text-[#4D665D]">
              <span className="mr-1.5 font-semibold text-[#0F2B23]">Note:</span>
              {episodes.length} episode{episodes.length === 1 ? "" : "s"} matched today&apos;s conditions.
              The 6-month forward return shows what happened after each analog ended — use it as a base rate, not a prediction.
            </div>

            <div className="grid gap-3">
              {episodes.map((ep, idx) => {
                const epAccent = regimeColor(ep.regime);
                return (
                  <Link
                    key={idx}
                    href={`/episodes/${idx}`}
                    className="group rounded-xl border border-[#D7E8E0] bg-white p-5 shadow-[0_18px_45px_-32px_rgba(12,58,44,0.3)] transition hover:-translate-y-0.5 hover:border-[#BCE8DA] hover:shadow-[0_22px_55px_-32px_rgba(15,167,122,0.4)]"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <span
                        className="rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]"
                        style={{
                          background: `${epAccent}18`,
                          color: epAccent,
                          borderColor: `${epAccent}33`,
                        }}
                      >
                        {regimeLabel(ep.regime)}
                      </span>
                      <span className="text-xs text-[#5A736A]">
                        {ep.start_date} → {ep.end_date}
                      </span>
                      <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-[#E9F9F3] px-2.5 py-0.5 text-[11px] font-semibold text-[#0A8A67]">
                        Similarity {ep.similarity_pct}
                      </span>
                      <ArrowUpRight size={14} className="text-[#7A938A] transition group-hover:text-[#0A8A67]" />
                    </div>

                    <div className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-5">
                      <Metric label="VIX" value={ep.vix_level.toFixed(1)} />
                      <Metric label="CPI" value={`${ep.cpi.toFixed(1)}%`} />
                      <Metric label="Fed" value={`${ep.fed_rate.toFixed(2)}%`} />
                      <Metric
                        label="Episode return"
                        value={`${ep.total_return > 0 ? "+" : ""}${ep.total_return.toFixed(1)}%`}
                        color={ep.total_return > 0 ? "#0A8A67" : "#B91C1C"}
                      />
                      <div className="flex flex-col leading-tight">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A938A]">6M after</span>
                        {ep.spy_return_6m_after != null ? (
                          <span
                            className="font-[var(--font-heading)] text-sm font-bold tabular-nums"
                            style={{ color: ep.spy_return_6m_after > 0 ? "#0A8A67" : "#B91C1C" }}
                          >
                            {ep.spy_return_6m_after > 0 ? "+" : ""}{ep.spy_return_6m_after.toFixed(1)}%
                          </span>
                        ) : (
                          <span
                            className="text-xs text-[#7A938A]"
                            title="6-month outcome not yet available — this episode ended recently"
                          >
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

function Tile({
  label,
  value,
  delta,
  deltaSuffix,
  caption,
  accent,
}: {
  label: string;
  value: string;
  delta?: number;
  deltaSuffix?: string;
  caption?: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-[#D7E8E0] bg-white p-4 shadow-[0_14px_36px_-30px_rgba(12,58,44,0.26)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A938A]">{label}</p>
      <p className="mt-2 font-[var(--font-heading)] text-xl font-bold tabular-nums text-[#0F2B23]" style={{ color: accent }}>
        {value}
      </p>
      {typeof delta === "number" ? (
        <p
          className="mt-1 text-xs font-semibold tabular-nums"
          style={{ color: delta >= 0 ? "#0A8A67" : "#B91C1C" }}
        >
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(2)}
          {deltaSuffix} today
        </p>
      ) : caption ? (
        <p className="mt-1 text-xs text-[#5A736A]">{caption}</p>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  color = "#0F2B23",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A938A]">{label}</span>
      <span className="font-[var(--font-heading)] text-sm font-bold tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
