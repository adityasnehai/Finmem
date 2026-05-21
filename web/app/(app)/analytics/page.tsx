"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fetchAblation, fetchMemory, fetchOutcomesDistribution, fetchCalibration, fetchCompression } from "@/lib/api";
import { REGIME_COLORS, regimeColor, regimeLabel, ABLATION_LABELS, ABLATION_COLORS } from "@/lib/constants";
import { BarChart3, CheckCircle2, Sparkles, TrendingUp, ArrowDownRight, Activity, FlaskConical, Layers, Info } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

interface AblationRow {
  avg_quality: number;
  grounded_pct: number;
  lat_p50_ms: number;
  lat_p95_ms: number;
}
interface MemoryData {
  total_episodes: number;
  regimes: Record<string, number>;
  ready: boolean;
  start_date: string;
  end_date: string;
}
interface CalibrationBin {
  bin_center: number;
  mean_confidence: number;
  mean_accuracy: number;
  perfect: number;
  count: number;
}
interface CalibrationResult {
  available: boolean;
  n?: number;
  k?: number;
  directional_accuracy?: number;
  ci_lo?: number;
  ci_hi?: number;
  brier_score?: number;
  mae_pct?: number;
  ece?: number;
  reliability_bins?: CalibrationBin[];
  note?: string;
}
interface CompressionPoint {
  dim: number;
  recall_at_k: number;
  directional_accuracy: number | null;
  storage_kb: number;
  latency_us: number;
}
interface CompressionResult {
  available: boolean;
  k?: number;
  n_episodes?: number;
  n_with_outcomes?: number;
  full_dim?: number;
  results?: CompressionPoint[];
  note?: string;
}

interface OutcomesDistribution {
  returns: {
    episodes: number[];
    mean: number;
    median: number;
    std: number;
    min: number;
    max: number;
  };
  drawdowns: {
    episodes: number[];
    mean: number;
    median: number;
    std: number;
    min: number;
    max: number;
  };
  by_regime: Record<string, { mean: number; median: number; count: number }>;
}

// REGIME_COLORS, regimeColor, regimeLabel, ABLATION_LABELS, ABLATION_COLORS imported from @/lib/constants
const SYS_LABELS = ABLATION_LABELS;
const SYS_COLORS = ABLATION_COLORS;

const CHART_TOOLTIP_STYLE = {
  background: "white",
  border: "1px solid #D7E8E0",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "0 20px 45px -30px rgba(12,58,44,0.4)",
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; fill: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#D7E8E0] bg-white p-3 text-xs shadow-[0_20px_45px_-30px_rgba(12,58,44,0.4)]">
      {label && (
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A938A]">{label}</p>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: p.fill }} />
            <span className="text-[#5A736A]">{p.name}:</span>
            <span className="font-semibold text-[#0F2B23]">{p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* === Histogram binning helpers === */
function binValues(values: number[], binCount = 12) {
  if (!values.length) return [] as { label: string; count: number; mid: number }[];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (max - min) / binCount || 1;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    label: `${(min + i * width).toFixed(0)} to ${(min + (i + 1) * width).toFixed(0)}`,
    mid: min + (i + 0.5) * width,
    count: 0,
  }));
  values.forEach((v) => {
    const idx = Math.min(binCount - 1, Math.max(0, Math.floor((v - min) / width)));
    bins[idx].count += 1;
  });
  return bins;
}

export default function AnalyticsPage() {
  const [ablation, setAblation] = useState<{ available: boolean; results?: Record<string, AblationRow> } | null>(null);
  const [memory, setMemory] = useState<MemoryData | null>(null);
  const [distribution, setDistribution] = useState<OutcomesDistribution | null>(null);
  const [calibration, setCalibration] = useState<CalibrationResult | null>(null);
  const [compression, setCompression] = useState<CompressionResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchAblation(),
      fetchMemory().catch(() => null),
      fetchOutcomesDistribution().catch(() => null),
      fetchCalibration().catch(() => ({ available: false })),
      fetchCompression().catch(() => ({ available: false })),
    ])
      .then(([abl, mem, dist, calib, comp]) => {
        setAblation(abl);
        setMemory(mem);
        setDistribution(dist);
        setCalibration(calib as CalibrationResult);
        setCompression(comp as CompressionResult);
      })
      .finally(() => setLoading(false));
  }, []);

  const qualityData = ablation?.results
    ? [
        {
          metric: "Quality /3",
          ...Object.fromEntries(
            Object.entries(ablation.results).map(([k, v]) => [SYS_LABELS[k], v.avg_quality]),
          ),
        },
        {
          metric: "Grounded %",
          ...Object.fromEntries(
            Object.entries(ablation.results).map(([k, v]) => [
              SYS_LABELS[k],
              +((v.grounded_pct / 100) * 3).toFixed(2),
            ]),
          ),
        },
      ]
    : [];

  const latencyData = ablation?.results
    ? Object.entries(ablation.results).map(([k, v]) => ({
        name: SYS_LABELS[k],
        "P50 ms": v.lat_p50_ms,
        "P95 ms": v.lat_p95_ms,
        color: SYS_COLORS[k as keyof typeof SYS_COLORS] ?? "#7A938A",
      }))
    : [];

  const returnsBins = useMemo(
    () => (distribution ? binValues(distribution.returns.episodes, 12) : []),
    [distribution],
  );
  const drawdownBins = useMemo(
    () => (distribution ? binValues(distribution.drawdowns.episodes, 12) : []),
    [distribution],
  );

  const pieData = memory?.regimes
    ? Object.entries(memory.regimes).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[#D7E8E0] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-5 md:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] text-white shadow-[0_10px_22px_-12px_rgba(15,167,122,0.55)]">
              <BarChart3 size={16} />
            </span>
            <div>
              <h1 className="font-[var(--font-heading)] text-2xl font-bold tracking-tight text-[#0F2B23]">
                Analytics
              </h1>
              <p className="text-sm text-[#5A736A]">
                Ablation benchmarks · outcome distributions · regime coverage
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          {loading && !ablation ? (
            <>
              <div className="skeleton h-64 rounded-xl" />
              <div className="skeleton h-64 rounded-xl" />
            </>
          ) : (
            <>
              {/* === Ablation === */}
              <Card>
                <CardHeader
                  label="Retrieval Quality Benchmark"
                  description="How FinMem's episodic retrieval compares to a recency window and a no-retrieval baseline on response quality and groundedness."
                  rightSlot={
                    ablation?.available ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-[#BCE8DA] bg-[#E9F9F3] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0A8A67]">
                        <CheckCircle2 size={11} /> Results available
                      </span>
                    ) : null
                  }
                />

                {ablation?.available && ablation.results ? (
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div>
                      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A938A]">
                        Quality score (0–3)
                      </p>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={qualityData} barGap={6} margin={{ left: -10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5EFE9" vertical={false} />
                            <XAxis dataKey="metric" tick={{ fill: "#5A736A", fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis domain={[0, 3]} tick={{ fill: "#5A736A", fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(15,167,122,0.06)" }} />
                            <Bar dataKey="FinMem (Episodic RAG)" fill="#0FA77A" radius={[6, 6, 0, 0]} />
                            <Bar dataKey="Recency Window (90d)" fill="#1AADB0" radius={[6, 6, 0, 0]} />
                            <Bar dataKey="No Retrieval" fill="#A0B3A9" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div>
                      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A938A]">
                        Retrieval latency (ms)
                      </p>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={latencyData} barGap={6} margin={{ left: -10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5EFE9" vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: "#5A736A", fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: "#5A736A", fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(15,167,122,0.06)" }} />
                            <Bar dataKey="P50 ms" fill="#0FA77A" radius={[6, 6, 0, 0]} />
                            <Bar dataKey="P95 ms" fill="#1AADB0" radius={[6, 6, 0, 0]} opacity={0.55} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="lg:col-span-2">
                      <div className="overflow-hidden rounded-xl border border-[#E2EEE9]">
                        <table className="w-full text-sm">
                          <thead className="bg-[#F2FAF6] text-[10px] uppercase tracking-[0.12em] text-[#7A938A]">
                            <tr>
                              <th className="px-4 py-2.5 text-left font-semibold">System</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Quality /3</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Grounded %</th>
                              <th className="px-4 py-2.5 text-right font-semibold">P50 latency</th>
                              <th className="px-4 py-2.5 text-right font-semibold">P95 latency</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(ablation.results).map(([sys, row]) => (
                              <tr key={sys} className="border-t border-[#EEF5F2] bg-white text-[#102E25]">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="h-2.5 w-2.5 rounded-full"
                                      style={{ background: SYS_COLORS[sys as keyof typeof SYS_COLORS] ?? "#7A938A" }}
                                    />
                                    <span className={sys === "rag" ? "font-semibold" : ""}>{SYS_LABELS[sys]}</span>
                                    {sys === "rag" && (
                                      <span className="rounded-md bg-[#E9F9F3] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A8A67]">
                                        Best
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ color: sys === "rag" ? "#0A8A67" : "#5A736A" }}>
                                  {row.avg_quality}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums text-[#5A736A]">{row.grounded_pct}%</td>
                                <td className="px-4 py-3 text-right tabular-nums text-[#5A736A]">{row.lat_p50_ms} ms</td>
                                <td className="px-4 py-3 text-right tabular-nums text-[#5A736A]">{row.lat_p95_ms} ms</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={Sparkles}
                    title="No benchmark results yet"
                    body="Benchmark results will appear here once the evaluation suite has been run."
                  />
                )}
              </Card>

              {/* === Calibration === */}
              <Card>
                <CardHeader
                  label="Retrieval Calibration"
                  description="Leave-one-out evaluation: for each episode, the most-similar retrieved neighbor is used to predict 6-month direction. Ground truth is the stored forward return."
                  rightSlot={
                    calibration?.available ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-[#BCE8DA] bg-[#E9F9F3] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0A8A67]">
                        <FlaskConical size={11} /> n = {calibration.n}
                      </span>
                    ) : null
                  }
                />
                {calibration?.available ? (
                  <div className="flex flex-col gap-5">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {[
                        {
                          label: "Directional Accuracy",
                          value: `${((calibration.directional_accuracy ?? 0) * 100).toFixed(1)}%`,
                          sub: `95% CI [${((calibration.ci_lo ?? 0) * 100).toFixed(1)}%–${((calibration.ci_hi ?? 0) * 100).toFixed(1)}%]`,
                          color: "#0A8A67",
                          info: "Leave-one-out: fraction of held-out episodes where the most-similar analog predicted the correct 6-month return direction (positive vs. negative).",
                        },
                        {
                          label: "Brier Score",
                          value: (calibration.brier_score ?? 0).toFixed(3),
                          sub: "lower = better (0.25 = random baseline)",
                          color: "#1AADB0",
                          info: "Mean squared error between predicted probability and binary outcome. 0.25 is the uninformed baseline for a 50/50 coin flip; lower values indicate better probabilistic accuracy.",
                        },
                        {
                          label: "MAE",
                          value: `${(calibration.mae_pct ?? 0).toFixed(1)} pp`,
                          sub: "mean absolute error in return",
                          color: "#F59B23",
                          info: "Mean absolute error in percentage-point terms between the analog's forward return and the held-out episode's actual forward return.",
                        },
                        {
                          label: "ECE",
                          value: (calibration.ece ?? 0).toFixed(3),
                          sub: "calibration error (0 = perfect)",
                          color: "#E22134",
                          info: "Expected Calibration Error: weighted average gap between reported similarity-based confidence and observed accuracy across reliability bins. Closer to 0 is better.",
                        },
                      ].map(({ label, value, sub, color, info }) => (
                        <div key={label} className="rounded-xl border border-[#D7E8E0] bg-white p-4">
                          <p className="flex items-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A938A]">
                            {label}
                            <InfoTooltip text={info} />
                          </p>
                          <p className="mt-2 font-[var(--font-heading)] text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
                          <p className="mt-1 text-[10px] text-[#7A938A]">{sub}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                      <div>
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A938A]">
                          Reliability diagram — confidence vs accuracy per bin
                        </p>
                        <div className="h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={(calibration.reliability_bins ?? []).map(b => ({
                                bin: `n=${b.count}`,
                                "Confidence": +(b.mean_confidence * 100).toFixed(1),
                                "Accuracy": +(b.mean_accuracy * 100).toFixed(1),
                              }))}
                              barGap={4}
                              margin={{ left: -10 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#E5EFE9" vertical={false} />
                              <XAxis dataKey="bin" tick={{ fill: "#5A736A", fontSize: 10 }} axisLine={false} tickLine={false} />
                              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "#5A736A", fontSize: 10 }} axisLine={false} tickLine={false} />
                              <Tooltip
                                cursor={{ fill: "rgba(15,167,122,0.06)" }}
                                contentStyle={CHART_TOOLTIP_STYLE}
                                formatter={(v) => [`${v}%`, ""]}
                              />
                              <Legend wrapperStyle={{ fontSize: 10, color: "#5A736A" }} />
                              <Bar dataKey="Confidence" fill="#1AADB0" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="Accuracy" fill="#0FA77A" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {(() => {
                        const bins = calibration.reliability_bins ?? [];
                        const underconfident = bins.length > 0 && bins.filter(b => b.count > 0).every(b => b.mean_accuracy >= b.mean_confidence - 0.05);
                        const fullDim = compression?.full_dim ?? 519;
                        const acc = ((calibration.directional_accuracy ?? 0) * 100).toFixed(1);
                        const ece = (calibration.ece ?? 0).toFixed(3);
                        const baseline_pp = (((calibration.directional_accuracy ?? 0.5) - 0.5) * 100).toFixed(0);
                        if (underconfident) {
                          return (
                            <div className="flex flex-col justify-center gap-3 rounded-xl border border-[#BCE8DA] bg-[#E9F9F3] p-4 text-sm">
                              <p className="text-xs font-semibold text-[#065F46]">Research finding: well-calibrated (slightly underconfident)</p>
                              <p className="text-xs leading-6 text-[#064E3B]">
                                With text-embedding-3-small + all-but-the-top whitening in {fullDim}-dim space, cosine similarities span a wide range (median≈0 across episodes). ECE = {ece} indicates moderate calibration error. Directional accuracy ({acc}%) exceeds confidence in each reliability bin — the system is slightly underconfident — and beats the 50% random baseline by +{baseline_pp} pp.
                              </p>
                              {calibration.note && <p className="text-[10px] text-[#047857]">{calibration.note}</p>}
                            </div>
                          );
                        }
                        return (
                          <div className="flex flex-col justify-center gap-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm">
                            <p className="text-xs font-semibold text-[#92400E]">Research finding: overconfidence detected</p>
                            <p className="text-xs leading-6 text-[#78350F]">
                              ECE = {ece} means reported similarity scores are higher than actual directional accuracy warrants. Directional accuracy ({acc}%) nonetheless beats the 50% random baseline by +{baseline_pp} pp.
                            </p>
                            {calibration.note && <p className="text-[10px] text-[#A16207]">{calibration.note}</p>}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <EmptyState icon={FlaskConical} title="Calibration not available" body="Start the API server to compute leave-one-out calibration on stored episodes." />
                )}
              </Card>

              {/* === Compression Ablation === */}
              <Card>
                <CardHeader
                  label="Embedding Compression"
                  description={`Recall@${compression?.k ?? 5} vs the full ${compression?.full_dim ?? 519}-dim system at each PCA dimension. Measures capability preserved under compression.`}
                  rightSlot={
                    compression?.available ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-[#BCE8DA] bg-[#E9F9F3] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0A8A67]">
                        <Layers size={11} /> {compression.n_episodes} episodes
                      </span>
                    ) : null
                  }
                />
                {compression?.available && compression.results ? (() => {
                  const sorted = [...compression.results].sort((a, b) => a.dim - b.dim);
                  const chartData = sorted.map((r) => ({
                    dim: r.dim === compression.full_dim ? `${r.dim} (full)` : `${r.dim}`,
                    [`Recall@${compression.k}`]: +(r.recall_at_k * 100).toFixed(1),
                    "Dir. accuracy": r.directional_accuracy != null ? +(r.directional_accuracy * 100).toFixed(1) : null,
                  }));
                  return (
                    <div className="flex flex-col gap-5">
                      <div className="grid gap-5 lg:grid-cols-2">
                        <div>
                          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A938A]">
                            Recall@{compression.k} and directional accuracy vs embedding dimension
                          </p>
                          <div className="h-52">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData} margin={{ left: -10, right: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E5EFE9" vertical={false} />
                                <XAxis dataKey="dim" tick={{ fill: "#5A736A", fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "#5A736A", fontSize: 10 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                  contentStyle={CHART_TOOLTIP_STYLE}
                                  formatter={(v) => [`${v}%`, ""]}
                                />
                                <Legend wrapperStyle={{ fontSize: 11, color: "#5A736A" }} />
                                <Line type="monotone" dataKey={`Recall@${compression.k}`} stroke="#0FA77A" strokeWidth={2} dot={{ r: 4, fill: "#0FA77A" }} />
                                <Line type="monotone" dataKey="Dir. accuracy" stroke="#1AADB0" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 4, fill: "#1AADB0" }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <div>
                          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A938A]">
                            Detail: per-dimension metrics
                          </p>
                          <div className="overflow-hidden rounded-xl border border-[#E2EEE9]">
                            <table className="w-full text-xs">
                              <thead className="bg-[#F2FAF6] text-[10px] uppercase tracking-[0.1em] text-[#7A938A]">
                                <tr>
                                  <th className="px-3 py-2 text-left font-semibold">Dim</th>
                                  <th className="px-3 py-2 text-right font-semibold">Recall@{compression.k}</th>
                                  <th className="px-3 py-2 text-right font-semibold">Dir. acc</th>
                                  <th className="px-3 py-2 text-right font-semibold">Storage</th>
                                  <th className="px-3 py-2 text-right font-semibold">Latency</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sorted.map((r) => (
                                  <tr key={r.dim} className={`border-t border-[#EEF5F2] ${r.dim === compression.full_dim ? "bg-[#F2FAF6]" : "bg-white"}`}>
                                    <td className="px-3 py-2 font-semibold text-[#0F2B23]">
                                      {r.dim}
                                      {r.dim === compression.full_dim && (
                                        <span className="ml-1.5 rounded bg-[#E9F9F3] px-1.5 py-0.5 text-[9px] font-semibold text-[#0A8A67]">full</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-right font-semibold tabular-nums" style={{ color: r.recall_at_k >= 0.9 ? "#0A8A67" : r.recall_at_k >= 0.75 ? "#F59B23" : "#B91C1C" }}>
                                      {(r.recall_at_k * 100).toFixed(1)}%
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums text-[#5A736A]">
                                      {r.directional_accuracy != null ? `${(r.directional_accuracy * 100).toFixed(1)}%` : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums text-[#5A736A]">{r.storage_kb} KB</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-[#5A736A]">{r.latency_us.toFixed(0)} µs</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                      <p className="text-[10px] leading-5 text-[#7A938A]">{compression.note}</p>
                    </div>
                  );
                })() : (
                  <EmptyState icon={Layers} title="Compression data not available" body="Start the API server to compute PCA compression ablation on stored embeddings." />
                )}
              </Card>

              {/* === Outcome Distribution === */}
              {distribution && (
                <Card>
                  <CardHeader
                    label="Outcome distribution"
                    description="6-month forward returns and max drawdowns binned across all historical episodes. These are realized outcomes stored in the episode database — not predictions."
                  />

                  <div className="grid gap-6 lg:grid-cols-2">
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A938A]">
                          6-month returns (%)
                        </p>
                        <span className="rounded-md bg-[#E9F9F3] px-2 py-0.5 text-[10px] font-semibold text-[#0A8A67]">
                          n = {distribution.returns.episodes.length}
                        </span>
                      </div>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={returnsBins} margin={{ left: -10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5EFE9" vertical={false} />
                            <XAxis
                              dataKey="mid"
                              tickFormatter={(v) => `${v.toFixed(0)}%`}
                              tick={{ fill: "#5A736A", fontSize: 10 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis tick={{ fill: "#5A736A", fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip
                              cursor={{ fill: "rgba(15,167,122,0.06)" }}
                              contentStyle={CHART_TOOLTIP_STYLE}
                              labelFormatter={(v) => `Return bin: ${(v as number).toFixed(0)}%`}
                              formatter={(v) => [`${v} episodes`, ""]}
                            />
                            <Bar dataKey="count" fill="#0FA77A" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <StatsRow
                        items={[
                          { label: "Mean", value: `${distribution.returns.mean.toFixed(1)}%`, color: "#0A8A67" },
                          { label: "Median", value: `${distribution.returns.median.toFixed(1)}%`, color: "#0A8A67" },
                          { label: "Std", value: `${distribution.returns.std.toFixed(1)}%`, color: "#F59B23" },
                          {
                            label: "Range",
                            value: `${distribution.returns.min.toFixed(1)}% — ${distribution.returns.max.toFixed(1)}%`,
                            color: "#5A736A",
                          },
                        ]}
                      />
                    </div>

                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A938A]">
                          Max drawdowns (%)
                        </p>
                        <span className="rounded-md bg-[#FFEDED] px-2 py-0.5 text-[10px] font-semibold text-[#B91C1C]">
                          n = {distribution.drawdowns.episodes.length}
                        </span>
                      </div>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={drawdownBins} margin={{ left: -10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5EFE9" vertical={false} />
                            <XAxis
                              dataKey="mid"
                              tickFormatter={(v) => `${v.toFixed(0)}%`}
                              tick={{ fill: "#5A736A", fontSize: 10 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis tick={{ fill: "#5A736A", fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip
                              cursor={{ fill: "rgba(226,33,52,0.06)" }}
                              contentStyle={CHART_TOOLTIP_STYLE}
                              labelFormatter={(v) => `Drawdown bin: ${(v as number).toFixed(0)}%`}
                              formatter={(v) => [`${v} episodes`, ""]}
                            />
                            <Bar dataKey="count" fill="#E22134" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <StatsRow
                        items={[
                          { label: "Mean", value: `${distribution.drawdowns.mean.toFixed(1)}%`, color: "#B91C1C" },
                          { label: "Median", value: `${distribution.drawdowns.median.toFixed(1)}%`, color: "#B91C1C" },
                          { label: "Std", value: `${distribution.drawdowns.std.toFixed(1)}%`, color: "#F59B23" },
                          {
                            label: "Range",
                            value: `${distribution.drawdowns.min.toFixed(1)}% — ${distribution.drawdowns.max.toFixed(1)}%`,
                            color: "#5A736A",
                          },
                        ]}
                      />
                    </div>

                    {Object.keys(distribution.by_regime).length > 0 && (
                      <div className="lg:col-span-2">
                        <div className="mb-3 flex items-center gap-2">
                          <TrendingUp size={13} className="text-[#0A8A67]" />
                          <p className="flex items-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0A8A67]">
                            Mean return by regime
                            <InfoTooltip text="Average 6-month forward SPY return across all episodes in each detected market regime. Based on stored outcomes — use as a base rate, not a prediction." />
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                          {Object.entries(distribution.by_regime).map(([regime, stats]) => {
                            const accent = regimeColor(regime);
                            return (
                              <div
                                key={regime}
                                className="rounded-xl border border-[#D7E8E0] bg-white p-4 shadow-[0_14px_36px_-30px_rgba(12,58,44,0.3)]"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A938A]">{regimeLabel(regime)}</span>
                                  <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
                                </div>
                                <p
                                  className="mt-3 font-[var(--font-heading)] text-2xl font-bold tabular-nums"
                                  style={{ color: stats.mean >= 0 ? "#0A8A67" : "#B91C1C" }}
                                >
                                  {stats.mean > 0 ? "+" : ""}
                                  {stats.mean.toFixed(1)}%
                                </p>
                                <p className="mt-1 text-xs text-[#5A736A]">n = {stats.count} episodes</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* === Coverage row === */}
              <div className="grid gap-5 lg:grid-cols-2">
                <Card>
                  <CardHeader
                    label="Regime distribution"
                    description="Share of historical episodes by detected regime."
                  />
                  {pieData.length > 0 ? (
                    <div className="grid grid-cols-2 items-center gap-4">
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={42}
                              outerRadius={76}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {pieData.map((entry) => (
                                <Cell
                                  key={entry.name}
                                  fill={REGIME_COLORS[entry.name] ?? "#7A938A"}
                                  stroke="white"
                                  strokeWidth={2}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={CHART_TOOLTIP_STYLE}
                              formatter={(v) => [`${v} episodes`, ""]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-col gap-2">
                        {pieData.map(({ name, value }) => (
                          <div key={name} className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ background: REGIME_COLORS[name] ?? "#7A938A" }}
                            />
                            <span className="flex-1 truncate text-xs text-[#4D665D]">{regimeLabel(name)}</span>
                            <span className="text-xs font-semibold text-[#0F2B23] tabular-nums">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <EmptyState icon={Activity} title="No memory loaded" />
                  )}
                </Card>

                <Card>
                  <CardHeader
                    label="Memory coverage"
                    description="Historical span and episode count fed into retrieval."
                  />
                  {memory ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "Total episodes", value: memory.total_episodes, color: "#0FA77A" },
                          {
                            label: "Years covered",
                            value:
                              memory.start_date && memory.end_date
                                ? `${new Date(memory.end_date).getFullYear() - new Date(memory.start_date).getFullYear()} yrs`
                                : "—",
                            color: "#1AADB0",
                          },
                          { label: "Start date", value: memory.start_date?.slice(0, 7) || "—", color: "#5A736A" },
                          { label: "End date", value: memory.end_date?.slice(0, 7) || "—", color: "#5A736A" },
                        ].map(({ label, value, color }) => (
                          <div
                            key={label}
                            className="rounded-xl border border-[#D7E8E0] bg-white p-4 shadow-[0_14px_36px_-30px_rgba(12,58,44,0.26)]"
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A938A]">{label}</p>
                            <p
                              className="mt-2 font-[var(--font-heading)] text-xl font-bold tabular-nums"
                              style={{ color }}
                            >
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>
                      <p className="mt-4 text-xs leading-6 text-[#5A736A]">
                        Episodes are detected from structural market changes using statistical methods. Each episode is embedded using a combination of price, macro, and volatility features for retrieval.
                      </p>
                    </>
                  ) : (
                    <EmptyState icon={ArrowDownRight} title="No memory loaded" />
                  )}
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* === Subcomponents === */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#D7E8E0] bg-white p-6 shadow-[0_22px_55px_-32px_rgba(12,58,44,0.32)]">
      {children}
    </section>
  );
}

function CardHeader({
  label,
  description,
  rightSlot,
}: {
  label: string;
  description?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A8A67]">{label}</p>
        {description && <p className="mt-1.5 text-sm text-[#4D665D]">{description}</p>}
      </div>
      {rightSlot}
    </div>
  );
}

function StatsRow({ items }: { items: { label: string; value: string; color: string }[] }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-[#EEF5F2] bg-[#F8FCFA] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7A938A]">{item.label}</p>
          <p className="mt-1 font-semibold tabular-nums" style={{ color: item.color }}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ElementType;
  title: string;
  body?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#D7E8E0] bg-[#F8FCFA] px-6 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#0A8A67] shadow-sm">
        <Icon size={16} />
      </span>
      <p className="font-[var(--font-heading)] text-sm font-semibold text-[#0F2B23]">{title}</p>
      {body && <p className="max-w-md text-xs leading-6 text-[#5A736A]">{body}</p>}
    </div>
  );
}

function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos]         = useState({ top: 0, left: 0 });
  const iconRef               = useRef<HTMLSpanElement>(null);

  const show = () => {
    if (iconRef.current) {
      const r = iconRef.current.getBoundingClientRect();
      setPos({ top: r.top + window.scrollY, left: r.left + r.width / 2 });
    }
    setVisible(true);
  };

  return (
    <>
      <span
        ref={iconRef}
        className="ml-1 inline-flex cursor-help align-middle"
        onMouseEnter={show}
        onMouseLeave={() => setVisible(false)}
      >
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
