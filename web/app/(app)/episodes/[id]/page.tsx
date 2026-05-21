"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchEpisodeDetail, fetchEpisodePrecursors } from "@/lib/api";
import { ArrowLeft, AlertCircle, Zap, TrendingUp, Calendar } from "lucide-react";
import { regimeColor, regimeLabel } from "@/lib/constants";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Episode {
  id: number;
  start_date: string;
  end_date: string;
  regime: string;
  duration_days: number;
  cpi: number;
  fed_rate: number;
  vix_level: number;
  yield_spread: number;
  unemployment: number;
  total_return: number;
  max_drawdown: number;
  spy_return_1m_after: number | null;
  spy_return_3m_after: number | null;
  spy_return_6m_after: number | null;
  spy_return_1y_after: number | null;
  prose_summary: string;
}

interface Precursor {
  shift_from_regime?: string;
  shift_to_regime?: string;
  shift_date?: string;
  vix_5d_avg?: number;
  vix_10d_avg?: number;
  vix_20d_avg?: number;
  yield_spread_5d?: number;
  yield_inversion_detected?: boolean;
  vix_spike_detected?: boolean;
  fed_tightening?: boolean;
  cpi_change_pct?: number;
  fed_rate_change_bps?: number;
}


export default function EpisodeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const episodeId = parseInt(params.id as string);

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [precursor, setPrecursor] = useState<Precursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [epData, precData] = await Promise.all([
          fetchEpisodeDetail(episodeId),
          fetchEpisodePrecursors(episodeId),
        ]);
        setEpisode(epData);
        setPrecursor(precData && Object.keys(precData).length > 0 ? precData : null);
      } catch {
        setError("Failed to load episode");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [episodeId]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-3 bg-[#F4FAF7] text-sm text-[#5A736A]">
        <div className="h-5 w-5 rounded-full border-2 border-[#0FA77A]/25 border-t-[#0FA77A] animate-spin" />
        Loading episode…
      </div>
    );
  }

  if (error || !episode) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#F4FAF7]">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFEDED] text-[#B91C1C]">
          <AlertCircle size={18} />
        </span>
        <p className="text-sm text-[#5A736A]">{error || "Episode not found"}</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#D7E8E0] bg-white px-4 text-xs font-semibold text-[#0F2B23] transition hover:bg-[#F2FAF6]"
        >
          <ArrowLeft size={13} />
          Go back
        </button>
      </div>
    );
  }

  const accent = regimeColor(episode.regime);
  const metricsData = [
    { name: "VIX", value: episode.vix_level },
    { name: "Fed Rate", value: episode.fed_rate },
    { name: "CPI", value: episode.cpi },
    { name: "Unemployment", value: episode.unemployment },
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[#D7E8E0] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-5 md:px-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#D7E8E0] bg-white text-[#5A736A] transition hover:border-[#BCE8DA] hover:text-[#0A8A67]"
          >
            <ArrowLeft size={15} />
          </button>
          <div className="flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <span
                className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]"
                style={{
                  background: `${accent}18`,
                  color: accent,
                  borderColor: `${accent}33`,
                }}
              >
                {regimeLabel(episode.regime)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-[#5A736A]">
                <Calendar size={12} className="text-[#7A938A]" />
                {episode.start_date} → {episode.end_date}
              </span>
              <span className="rounded-md bg-[#F2FAF6] px-2 py-0.5 text-[10px] font-semibold text-[#0A8A67]">
                {episode.duration_days} days
              </span>
            </div>
            <h1 className="font-[var(--font-heading)] text-2xl font-bold text-[#0F2B23]">
              Episode #{episode.id}
            </h1>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          {/* Summary */}
          <Card>
            <SectionLabel>Summary</SectionLabel>
            <p className="mt-3 text-sm leading-7 text-[#1F3F35]">{episode.prose_summary}</p>
          </Card>

          {/* Key Metrics Grid */}
          <div>
            <SectionLabel>Forward returns</SectionLabel>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
              <MetricCard
                label="Episode return"
                value={`${episode.total_return > 0 ? "+" : ""}${episode.total_return.toFixed(1)}%`}
                tone={episode.total_return > 0 ? "good" : "danger"}
              />
              <MetricCard
                label="Max drawdown"
                value={`${episode.max_drawdown.toFixed(1)}%`}
                tone="danger"
              />
              <MetricCard
                label="1M after"
                value={
                  episode.spy_return_1m_after != null
                    ? `${episode.spy_return_1m_after > 0 ? "+" : ""}${episode.spy_return_1m_after.toFixed(1)}%`
                    : "—"
                }
                tone={
                  episode.spy_return_1m_after != null
                    ? episode.spy_return_1m_after > 0
                      ? "good"
                      : "danger"
                    : "neutral"
                }
                naTitle={episode.spy_return_1m_after == null ? "1-month outcome not yet available" : undefined}
              />
              <MetricCard
                label="3M after"
                value={
                  episode.spy_return_3m_after != null
                    ? `${episode.spy_return_3m_after > 0 ? "+" : ""}${episode.spy_return_3m_after.toFixed(1)}%`
                    : "—"
                }
                tone={
                  episode.spy_return_3m_after != null
                    ? episode.spy_return_3m_after > 0
                      ? "good"
                      : "danger"
                    : "neutral"
                }
                naTitle={episode.spy_return_3m_after == null ? "3-month outcome not yet available" : undefined}
              />
              <MetricCard
                label="6M after"
                value={
                  episode.spy_return_6m_after != null
                    ? `${episode.spy_return_6m_after > 0 ? "+" : ""}${episode.spy_return_6m_after.toFixed(1)}%`
                    : "—"
                }
                tone={
                  episode.spy_return_6m_after != null
                    ? episode.spy_return_6m_after > 0
                      ? "good"
                      : "danger"
                    : "neutral"
                }
                naTitle={episode.spy_return_6m_after == null ? "6-month outcome not yet available" : undefined}
              />
            </div>
          </div>

          {/* 1Y Return */}
          {episode.spy_return_1y_after != null && (
            <Card>
              <SectionLabel>12-month forward return</SectionLabel>
              <p
                className="mt-3 font-[var(--font-heading)] text-4xl font-bold"
                style={{ color: episode.spy_return_1y_after > 0 ? "#0A8A67" : "#B91C1C" }}
              >
                {episode.spy_return_1y_after > 0 ? "+" : ""}
                {episode.spy_return_1y_after.toFixed(1)}%
              </p>
              <p className="mt-2 text-xs text-[#5A736A]">
                Realised SPY total return one year after this episode ended.
              </p>
            </Card>
          )}

          {/* Market Conditions Chart */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <SectionLabel>Market conditions during episode</SectionLabel>
              <TrendingUp size={14} className="text-[#0A8A67]" />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metricsData} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5EFE9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#5A736A", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#5A736A", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(15,167,122,0.06)" }}
                    contentStyle={{
                      background: "white",
                      border: "1px solid #D7E8E0",
                      borderRadius: 10,
                      fontSize: 12,
                      boxShadow: "0 20px 45px -30px rgba(12,58,44,0.4)",
                    }}
                  />
                  <Bar dataKey="value" fill="#0FA77A" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Precursor Data */}
          {precursor && (
            <Card>
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF5E0] text-[#A56C17]">
                  <Zap size={14} />
                </span>
                <SectionLabel>What preceded this shift</SectionLabel>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {precursor.vix_5d_avg != null && (
                  <PrecursorCard label="VIX 5d avg" value={precursor.vix_5d_avg.toFixed(1)} accent="#F59B23" />
                )}
                {precursor.vix_10d_avg != null && (
                  <PrecursorCard label="VIX 10d avg" value={precursor.vix_10d_avg.toFixed(1)} accent="#F59B23" />
                )}
                {precursor.vix_20d_avg != null && (
                  <PrecursorCard label="VIX 20d avg" value={precursor.vix_20d_avg.toFixed(1)} accent="#F59B23" />
                )}
                {precursor.yield_spread_5d != null && (
                  <PrecursorCard
                    label="Yield spread 5d"
                    value={precursor.yield_spread_5d.toFixed(2)}
                    accent={precursor.yield_spread_5d < 0 ? "#B91C1C" : "#1AADB0"}
                  />
                )}
                {precursor.cpi_change_pct != null && (
                  <PrecursorCard
                    label="CPI change"
                    value={`${precursor.cpi_change_pct.toFixed(1)}%`}
                    accent={precursor.cpi_change_pct > 0 ? "#F59B23" : "#5A736A"}
                  />
                )}
                {precursor.fed_rate_change_bps != null && (
                  <PrecursorCard
                    label="Fed change"
                    value={`${precursor.fed_rate_change_bps} bps`}
                    accent={precursor.fed_rate_change_bps > 0 ? "#1AADB0" : "#5A736A"}
                  />
                )}
              </div>

              <div className="mt-4 border-t border-[#EEF5F2] pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A938A]">Detected signals</p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <IndicatorBadge label="VIX spike" active={precursor.vix_spike_detected === true} />
                  <IndicatorBadge label="Yield inversion" active={precursor.yield_inversion_detected === true} />
                  <IndicatorBadge label="Fed tightening" active={precursor.fed_tightening === true} />
                </div>
              </div>
            </Card>
          )}

          {/* Detailed Metrics */}
          <div>
            <SectionLabel>Episode-level metrics</SectionLabel>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
              <DetailMetric label="CPI" value={`${episode.cpi.toFixed(1)}%`} />
              <DetailMetric label="Fed rate" value={`${episode.fed_rate.toFixed(2)}%`} />
              <DetailMetric label="Yield spread" value={`${episode.yield_spread.toFixed(2)}%`} />
              <DetailMetric label="Unemployment" value={`${episode.unemployment.toFixed(1)}%`} />
              <DetailMetric label="Max drawdown" value={`${episode.max_drawdown.toFixed(1)}%`} />
              <DetailMetric label="Duration" value={`${episode.duration_days} days`} />
            </div>
          </div>

          {/* Pattern Insight */}
          <Card variant="muted">
            <SectionLabel>Historical context</SectionLabel>
            <p className="mt-3 text-sm leading-7 text-[#1F3F35]">
              This <strong className="text-[#0F2B23]">{regimeLabel(episode.regime)}</strong> episode lasted{" "}
              {episode.duration_days} days with{" "}
              {episode.total_return > 0 ? "positive" : "negative"} returns. Market volatility (VIX)
              averaged {episode.vix_level.toFixed(1)}, with inflation at {episode.cpi.toFixed(1)}% and
              Fed rates at {episode.fed_rate.toFixed(2)}%.{" "}
              {episode.spy_return_6m_after != null && (
                <>
                  Six months after, SPY had moved{" "}
                  <span className={episode.spy_return_6m_after > 0 ? "font-semibold text-[#0A8A67]" : "font-semibold text-[#B91C1C]"}>
                    {episode.spy_return_6m_after > 0 ? "+" : ""}
                    {episode.spy_return_6m_after.toFixed(1)}%
                  </span>.
                </>
              )}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* === Subcomponents === */

function Card({ children, variant }: { children: React.ReactNode; variant?: "muted" }) {
  return (
    <section
      className={`rounded-xl border border-[#D7E8E0] p-6 shadow-[0_22px_55px_-32px_rgba(12,58,44,0.32)] ${
        variant === "muted" ? "bg-[#F8FCFA]" : "bg-white"
      }`}
    >
      {children}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A8A67]">{children}</p>
  );
}

function MetricCard({
  label,
  value,
  tone,
  naTitle,
}: {
  label: string;
  value: string;
  tone: "good" | "danger" | "neutral";
  naTitle?: string;
}) {
  const isNA = value === "—";
  const color = isNA ? "#9598A1" : tone === "good" ? "#0A8A67" : tone === "danger" ? "#B91C1C" : "#1F3F35";
  return (
    <div className="rounded-xl border border-[#D7E8E0] bg-white p-4 shadow-[0_14px_36px_-30px_rgba(12,58,44,0.26)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A938A]">{label}</p>
      <p
        className="mt-2 font-[var(--font-heading)] text-xl font-bold tabular-nums"
        style={{ color }}
        title={isNA ? naTitle : undefined}
      >
        {value}
      </p>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#D7E8E0] bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A938A]">{label}</p>
      <p className="mt-1.5 font-[var(--font-heading)] text-sm font-semibold tabular-nums text-[#0F2B23]">
        {value}
      </p>
    </div>
  );
}

function PrecursorCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-[#EEF5F2] bg-[#F8FCFA] p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A938A]">{label}</p>
      <p className="mt-1.5 font-[var(--font-heading)] text-base font-bold tabular-nums" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}

function IndicatorBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
        active
          ? "border-[#F0D8A8] bg-[#FFF8EA] text-[#A56C17]"
          : "border-[#E5EFE9] bg-[#F8FCFA] text-[#7A938A]"
      }`}
    >
      <span className="font-semibold">{label}</span>
      <span
        className={`h-2 w-2 rounded-full ${active ? "bg-[#A56C17]" : "bg-[#C3D5CC]"}`}
        aria-hidden
      />
    </div>
  );
}
