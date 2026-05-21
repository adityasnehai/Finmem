"use client";
import { useEffect, useState } from "react";
import { fetchDataQuality } from "@/lib/api";
import { regimeColor, regimeLabel } from "@/lib/constants";
import { CheckCircle2, AlertCircle, Database, ShieldCheck, Activity } from "lucide-react";

interface DataQualityInfo {
  status: string;
  total_episodes: number;
  date_range: {
    start: string;
    end: string;
    years_covered: number;
  };
  episodes_by_regime: Record<string, number>;
  completeness: Record<string, number>;
  overall_completeness_pct: number;
  last_updated: string;
  data_sources: string[];
  coverage: {
    start_year: number;
    end_year: number;
    years_span: number;
  };
}

function formatMetricName(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DataQualityPage() {
  const [quality, setQuality] = useState<DataQualityInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchDataQuality();
        setQuality(data);
      } catch {
        // data quality unavailable — UI shows empty state
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
        Loading data quality report…
      </div>
    );
  }

  if (!quality) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#5A736A]">
        Unable to load data quality information.
      </div>
    );
  }

  const lastUpdated = new Date(quality.last_updated);
  const isRecent = Date.now() - lastUpdated.getTime() < 24 * 60 * 60 * 1000;
  const ready = quality.status === "ready";

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[#D7E8E0] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-5 md:px-8">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] text-white shadow-[0_10px_22px_-12px_rgba(15,167,122,0.55)]">
            <Database size={16} />
          </span>
          <div>
            <h1 className="font-[var(--font-heading)] text-2xl font-bold text-[#0F2B23]">Data Quality</h1>
            <p className="text-sm text-[#5A736A]">
              Dataset completeness, source freshness, and research readiness.
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          {/* Status banner */}
          <div
            className={`flex items-center gap-3 rounded-xl border px-5 py-4 ${
              ready
                ? "border-[#BCE8DA] bg-[#E9F9F3]"
                : "border-[#F0D8A8] bg-[#FFF8EA]"
            }`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                ready ? "bg-white text-[#0A8A67]" : "bg-white text-[#A56C17]"
              }`}
            >
              {ready ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            </span>
            <div>
              <p className={`font-[var(--font-heading)] text-sm font-semibold ${ready ? "text-[#0A6E52]" : "text-[#5F420F]"}`}>
                {ready ? "Data ready for research" : "Data may be incomplete"}
              </p>
              <p className={`mt-0.5 text-xs ${ready ? "text-[#1F4E3F]" : "text-[#7B5C2C]"}`}>
                {isRecent ? "Updated within the last 24 hours" : `Last updated ${lastUpdated.toLocaleDateString()}`}
              </p>
            </div>
          </div>

          {/* Top stats */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Total episodes" value={`${quality.total_episodes}`} accent="#0FA77A" />
            <Stat label="Years covered" value={`${quality.coverage.years_span} yrs`} accent="#1AADB0" />
            <Stat
              label="Completeness"
              value={`${quality.overall_completeness_pct}%`}
              accent={quality.overall_completeness_pct > 95 ? "#0FA77A" : "#F59B23"}
              progress={quality.overall_completeness_pct}
            />
            <Stat label="Start year" value={`${quality.coverage.start_year}`} accent="#7A938A" />
          </div>

          {/* Coverage timeline */}
          <Card>
            <CardHeader label="Coverage period" description="Spans of market data feeding the retrieval layer." />
            <div className="flex items-end gap-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A938A]">From</p>
                <p className="mt-1 font-[var(--font-heading)] text-xl font-bold text-[#0F2B23]">
                  {quality.date_range.start}
                </p>
              </div>
              <div className="flex-1 pb-1.5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#E5EFE9]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#0FA77A,#1AADB0,#F59B23)]"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A938A]">To</p>
                <p className="mt-1 font-[var(--font-heading)] text-xl font-bold text-[#0F2B23]">
                  {quality.date_range.end}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-[#5A736A]">
              {quality.coverage.years_span} year span covering{" "}
              {Math.round(quality.date_range.years_covered)} years of market history.
            </p>
          </Card>

          {/* Episodes by regime */}
          <Card>
            <CardHeader
              label="Episodes by regime"
              description="Episode count per detected regime label."
            />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {Object.entries(quality.episodes_by_regime).map(([regime, count]) => {
                const accent = regimeColor(regime);
                return (
                  <div key={regime} className="rounded-xl border border-[#EEF5F2] bg-[#F8FCFA] p-4">
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[10px] font-semibold uppercase tracking-[0.1em]"
                        style={{ color: accent }}
                      >
                        {regimeLabel(regime)}
                      </span>
                      <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
                    </div>
                    <p className="mt-2 font-[var(--font-heading)] text-2xl font-bold tabular-nums text-[#0F2B23]">
                      {count}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Metric completeness */}
          <Card>
            <CardHeader
              label="Metric completeness"
              description="Per-metric coverage across the dataset."
            />
            <div className="space-y-3">
              {Object.entries(quality.completeness).map(([metric, pct]) => (
                <div key={metric} className="flex items-center gap-4">
                  <span className="w-32 shrink-0 text-xs font-semibold text-[#0F2B23]">{formatMetricName(metric)}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E5EFE9]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background:
                          pct >= 95
                            ? "linear-gradient(90deg,#0FA77A,#1AADB0)"
                            : pct >= 80
                              ? "linear-gradient(90deg,#F59B23,#FBBF24)"
                              : "linear-gradient(90deg,#E22134,#F97316)",
                      }}
                    />
                  </div>
                  <span
                    className="w-12 text-right font-[var(--font-heading)] text-sm font-bold tabular-nums"
                    style={{
                      color: pct >= 95 ? "#0A8A67" : pct >= 80 ? "#A56C17" : "#B91C1C",
                    }}
                  >
                    {pct}%
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Data Sources */}
          <Card>
            <CardHeader label="Data sources" description="Upstream providers feeding the FinMem stack." />
            <ul className="grid gap-2 md:grid-cols-2">
              {quality.data_sources.map((source, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-3 rounded-lg border border-[#EEF5F2] bg-[#F8FCFA] px-3 py-2.5 text-sm text-[#1F3F35]"
                >
                  <CheckCircle2 size={14} className="text-[#0A8A67]" />
                  <span>{source}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Confidence */}
          <Card variant="muted">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#0A8A67]">
                <ShieldCheck size={16} />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A8A67]">
                  Data summary
                </p>
                <p className="mt-2 text-sm leading-7 text-[#1F3F35]">
                  Dataset covers <strong>{quality.coverage.years_span} years</strong> of market history
                  with <strong>{quality.overall_completeness_pct}% metric completeness</strong>.
                  {quality.overall_completeness_pct >= 95 &&
                    " High data quality enables confident analysis."}
                  {quality.overall_completeness_pct >= 80 &&
                    quality.overall_completeness_pct < 95 &&
                    " Generally reliable for analysis with minor data gaps."}
                  {quality.overall_completeness_pct < 80 &&
                    " Caution recommended due to data gaps in some metrics."}{" "}
                  Sources are refreshed daily.
                </p>
              </div>
            </div>
          </Card>

          {/* Footer */}
          <div className="flex items-center justify-center gap-2 border-t border-[#D7E8E0] pt-4 text-xs text-[#5A736A]">
            <Activity size={12} className="text-[#0A8A67]" />
            Last updated: {lastUpdated.toLocaleString()}
          </div>
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

function CardHeader({ label, description }: { label: string; description?: string }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A8A67]">{label}</p>
      {description && <p className="mt-1.5 text-sm text-[#4D665D]">{description}</p>}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  progress,
}: {
  label: string;
  value: string;
  accent: string;
  progress?: number;
}) {
  return (
    <div className="rounded-xl border border-[#D7E8E0] bg-white p-4 shadow-[0_14px_36px_-30px_rgba(12,58,44,0.26)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A938A]">{label}</p>
      <p className="mt-2 font-[var(--font-heading)] text-2xl font-bold tabular-nums" style={{ color: accent }}>
        {value}
      </p>
      {typeof progress === "number" && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#EEF5F1]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, progress)}%`,
              background: "linear-gradient(90deg,#0FA77A,#1AADB0)",
            }}
          />
        </div>
      )}
    </div>
  );
}
