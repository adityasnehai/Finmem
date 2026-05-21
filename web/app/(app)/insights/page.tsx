"use client";
import { useEffect, useState } from "react";
import { fetchPrecursorFrequencies, fetchRegimeTransitions } from "@/lib/api";
import { regimeColor, regimeLabel } from "@/lib/constants";
import { TrendingUp, AlertCircle, Zap, Activity } from "lucide-react";

interface PrecursorData {
  [key: string]: number;
}

interface RegimeTransition {
  from_regime: string;
  to_regime: string;
  probability: number;
  count: number;
}

export default function InsightsPage() {
  const [precursorFreq, setPrecursorFreq] = useState<Record<string, PrecursorData>>({});
  const [transitions, setTransitions] = useState<RegimeTransition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [freqData, transData] = await Promise.all([
          fetchPrecursorFrequencies(),
          fetchRegimeTransitions(),
        ]);
        setPrecursorFreq(freqData || {});
        if (transData && Array.isArray(transData)) {
          setTransitions(transData);
        }
      } catch {
        setError("Failed to load insights data");
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
        Loading insights…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[#D7E8E0] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-5 md:px-8">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] text-white shadow-[0_10px_22px_-12px_rgba(15,167,122,0.55)]">
            <Zap size={16} />
          </span>
          <div>
            <h1 className="font-[var(--font-heading)] text-2xl font-bold text-[#0F2B23]">Research Insights</h1>
            <p className="text-sm text-[#5A736A]">
              Precursor indicators · regime transition probabilities.
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-[#F4C7CC] bg-[#FFEDED] px-4 py-3 text-sm text-[#B91C1C]">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Precursor frequency table */}
          <section className="rounded-xl border border-[#D7E8E0] bg-white p-6 shadow-[0_22px_55px_-32px_rgba(12,58,44,0.32)]">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A8A67]">
                  Precursor frequencies
                </p>
                <p className="mt-1.5 text-sm text-[#4D665D]">
                  How often each indicator appears in the 20-day window before a regime transition.
                </p>
              </div>
              <Activity size={14} className="text-[#F59B23]" />
            </div>

            {Object.keys(precursorFreq).length === 0 ? (
              <EmptyState body="No precursor patterns detected yet. This view populates as more regime transitions accumulate in the database." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#E2EEE9]">
                <table className="w-full text-sm">
                  <thead className="bg-[#F2FAF6] text-[10px] uppercase tracking-[0.12em] text-[#7A938A]">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-semibold">Regime transition</th>
                      <th className="px-4 py-2.5 text-center font-semibold">VIX spike</th>
                      <th className="px-4 py-2.5 text-center font-semibold">Yield inversion</th>
                      <th className="px-4 py-2.5 text-center font-semibold">Fed tightening</th>
                      <th className="px-4 py-2.5 text-center font-semibold">Fed easing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(precursorFreq).map(([key, indicators]) => (
                      <tr key={key} className="border-t border-[#EEF5F2] bg-white transition hover:bg-[#F8FCFA]">
                        <td className="px-4 py-3 font-[var(--font-heading)] text-sm font-semibold text-[#0F2B23]">
                          {key.includes("→")
                            ? key.split("→").map((r, i) => (
                                <span key={i}>
                                  {i > 0 && <span className="mx-1 text-[#7A938A]">→</span>}
                                  {regimeLabel(r.trim())}
                                </span>
                              ))
                            : regimeLabel(key)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <FreqPill value={Number(indicators.vix_spike_freq || 0)} accent="#F59B23" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <FreqPill value={Number(indicators.yield_inversion_freq || 0)} accent="#B91C1C" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <FreqPill value={Number(indicators.fed_tightening_freq || 0)} accent="#1AADB0" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <FreqPill value={Number(indicators.fed_easing_freq || 0)} accent="#A78BFA" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Regime Transition Matrix */}
          <section className="rounded-xl border border-[#D7E8E0] bg-white p-6 shadow-[0_22px_55px_-32px_rgba(12,58,44,0.32)]">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A8A67]">
                  Regime transition matrix
                </p>
                <p className="mt-1.5 text-sm text-[#4D665D]">
                  Probability of moving from one regime to another, based on historical episode boundaries.
                </p>
              </div>
              <TrendingUp size={14} className="text-[#0A8A67]" />
            </div>

            {transitions.length === 0 ? (
              <EmptyState body="No regime transitions available. Transition data builds up as episodes are processed over time." />
            ) : (
              <div className="grid gap-3">
                {transitions.map((trans, idx) => {
                  const fromColor = regimeColor(trans.from_regime);
                  const toColor = regimeColor(trans.to_regime);
                  const pct = Math.min(trans.probability * 100, 100);
                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-[#EEF5F2] bg-[#F8FCFA] p-4"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-3">
                        <span
                          className="rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
                          style={{
                            background: `${fromColor}18`,
                            color: fromColor,
                            borderColor: `${fromColor}33`,
                          }}
                        >
                          {regimeLabel(trans.from_regime)}
                        </span>
                        <span className="text-[#7A938A]">→</span>
                        <span
                          className="rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
                          style={{
                            background: `${toColor}18`,
                            color: toColor,
                            borderColor: `${toColor}33`,
                          }}
                        >
                          {regimeLabel(trans.to_regime)}
                        </span>
                        <span className="ml-auto text-xs text-[#5A736A]">
                          {trans.count} episodes
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E5EFE9]">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,#0FA77A,#1AADB0)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-12 text-right font-[var(--font-heading)] text-sm font-bold tabular-nums text-[#0A8A67]">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function FreqPill({ value, accent }: { value: number; accent: string }) {
  const isStrong = value > 50;
  return (
    <span
      className="inline-flex items-center justify-center rounded-md border px-2.5 py-1 text-xs font-semibold tabular-nums"
      style={
        isStrong
          ? {
              background: `${accent}18`,
              color: accent,
              borderColor: `${accent}40`,
            }
          : {
              background: "#F2FAF6",
              color: "#5A736A",
              borderColor: "#E2EEE9",
            }
      }
    >
      {value.toFixed(0)}%
    </span>
  );
}

function EmptyState({ body }: { body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#D7E8E0] bg-[#F8FCFA] px-6 py-10 text-center text-sm text-[#5A736A]">
      {body}
    </div>
  );
}
