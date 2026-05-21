"use client";
import { useEffect, useState } from "react";
import { fetchAllEpisodes, fetchCompareEpisodes } from "@/lib/api";
import { regimeColor, regimeLabel } from "@/lib/constants";
import { ArrowRight, GitCompare } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Episode {
  id: string | number;
  start_date: string;
  end_date: string;
  regime: string;
  cpi: number;
  fed_rate: number;
  vix_level: number;
  yield_spread: number;
  unemployment: number;
  total_return: number;
  max_drawdown: number;
  spy_return_1m_after?: number | null;
  spy_return_3m_after?: number | null;
  spy_return_6m_after: number | null;
  spy_return_1y_after?: number | null;
}

interface ComparisonData {
  episode_1: Episode;
  episode_2: Episode;
}


export default function ComparePage() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selected, setSelected] = useState<[number, number]>([0, 1]);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchAllEpisodes();
        setEpisodes(data.episodes || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    async function loadComparison() {
      if (episodes.length < 2) return;
      try {
        const data = await fetchCompareEpisodes(selected[0], selected[1]);
        setComparison(data);
      } catch {
        // comparison unavailable — UI shows empty state
      }
    }
    loadComparison();
  }, [selected, episodes]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F4FAF7] text-sm text-[#5A736A]">
        Loading episodes…
      </div>
    );
  }

  if (episodes.length < 2) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F4FAF7] text-sm text-[#5A736A]">
        Need at least 2 episodes to compare.
      </div>
    );
  }

  const ep1 = comparison?.episode_1;
  const ep2 = comparison?.episode_2;

  const comparisonChartData =
    ep1 && ep2
      ? [
          { metric: "VIX", "Episode 1": ep1.vix_level, "Episode 2": ep2.vix_level },
          { metric: "Fed Rate", "Episode 1": ep1.fed_rate, "Episode 2": ep2.fed_rate },
          { metric: "CPI", "Episode 1": ep1.cpi, "Episode 2": ep2.cpi },
          { metric: "Unemployment", "Episode 1": ep1.unemployment, "Episode 2": ep2.unemployment },
          {
            metric: "Max DD %",
            "Episode 1": parseFloat((Math.abs(ep1.max_drawdown) * 100).toFixed(1)),
            "Episode 2": parseFloat((Math.abs(ep2.max_drawdown) * 100).toFixed(1)),
          },
        ]
      : [];

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[#D7E8E0] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-5 md:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] text-white shadow-[0_10px_22px_-12px_rgba(15,167,122,0.55)]">
              <GitCompare size={16} />
            </span>
            <div>
              <h1 className="font-[var(--font-heading)] text-2xl font-bold text-[#0F2B23]">Compare</h1>
              <p className="text-sm text-[#5A736A]">Side-by-side metrics for any two historical episodes.</p>
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-[#D7E8E0] bg-white">
        <div className="mx-auto grid max-w-6xl items-end gap-3 px-6 py-5 md:grid-cols-[1fr_auto_1fr] md:px-8">
          <SelectField
            label="Episode 1"
            value={selected[0]}
            onChange={(v) => setSelected([v, selected[1]])}
            episodes={episodes}
          />
          <div className="flex justify-center pb-1">
            <ArrowRight size={18} className="text-[#0A8A67]" />
          </div>
          <SelectField
            label="Episode 2"
            value={selected[1]}
            onChange={(v) => setSelected([selected[0], v])}
            episodes={episodes}
          />
        </div>
      </div>

      {ep1 && ep2 && (
        <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <Card>
              <CardHeader label="Market conditions comparison" />
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonChartData} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5EFE9" vertical={false} />
                    <XAxis dataKey="metric" tick={{ fill: "#5A736A", fontSize: 11 }} axisLine={false} tickLine={false} />
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
                    <Legend wrapperStyle={{ fontSize: 12, color: "#5A736A" }} />
                    <Bar dataKey="Episode 1" fill="#0FA77A" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Episode 2" fill="#F59B23" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <EpisodeCard episode={ep1} label="Episode 1" />
              <EpisodeCard episode={ep2} label="Episode 2" />
            </div>

            <Card variant="muted">
              <CardHeader label="Comparison insights" />
              <ul className="mt-3 space-y-2 text-sm leading-7 text-[#1F3F35]">
                <li>
                  <strong className="text-[#0F2B23]">Regime:</strong>{" "}
                  {ep1.regime === ep2.regime
                    ? `Both episodes are in the same regime (${regimeLabel(ep1.regime)}).`
                    : `Different regimes — ${regimeLabel(ep1.regime)} vs ${regimeLabel(ep2.regime)}.`}
                </li>
                <li>
                  <strong className="text-[#0F2B23]">6M forward returns:</strong>{" "}
                  Episode 1: {ep1.spy_return_6m_after != null ? `${(ep1.spy_return_6m_after * 100).toFixed(1)}%` : "—"} · Episode 2:{" "}
                  {ep2.spy_return_6m_after != null ? `${(ep2.spy_return_6m_after * 100).toFixed(1)}%` : "—"}
                </li>
                <li>
                  <strong className="text-[#0F2B23]">Volatility:</strong>{" "}
                  Episode 1 VIX={ep1.vix_level.toFixed(1)} · Episode 2 VIX={ep2.vix_level.toFixed(1)}
                </li>
                <li>
                  <strong className="text-[#0F2B23]">Policy:</strong>{" "}
                  Episode 1 Fed={ep1.fed_rate.toFixed(2)}% · Episode 2 Fed={ep2.fed_rate.toFixed(2)}%
                </li>
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

/* === Subcomponents === */

function SelectField({
  label,
  value,
  onChange,
  episodes,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  episodes: Episode[];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A8A67]">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full rounded-lg border border-[#CDE2DA] bg-white px-3 py-2.5 text-sm text-[#0F2B23] shadow-sm transition focus:border-[#0FA77A] focus:outline-none focus:ring-2 focus:ring-[#0FA77A]/15"
      >
        {episodes.map((ep, idx) => (
          <option key={idx} value={idx}>
            {ep.start_date} · {regimeLabel(ep.regime)}
          </option>
        ))}
      </select>
    </div>
  );
}

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

function CardHeader({ label }: { label: string }) {
  return (
    <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A8A67]">{label}</p>
  );
}

function EpisodeCard({ episode, label }: { episode: Episode; label: string }) {
  const accent = regimeColor(episode.regime);
  return (
    <Card>
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A938A]">{label}</p>
        <div className="mt-2 flex items-center gap-2">
          <span
            className="rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]"
            style={{
              background: `${accent}18`,
              color: accent,
              borderColor: `${accent}33`,
            }}
          >
            {regimeLabel(episode.regime)}
          </span>
          <span className="text-xs text-[#5A736A]">{episode.start_date}</span>
        </div>
      </div>

      <div className="grid gap-2">
        <Row label="SPY return" value={`${(episode.total_return * 100).toFixed(1)}%`} positive={episode.total_return > 0} />
        <Row label="Max drawdown" value={`${(episode.max_drawdown * 100).toFixed(1)}%`} positive={false} />
        <Row
          label="6M forward"
          value={episode.spy_return_6m_after != null ? `${(episode.spy_return_6m_after * 100).toFixed(1)}%` : "—"}
          positive={episode.spy_return_6m_after != null ? episode.spy_return_6m_after > 0 : undefined}
          naTitle={episode.spy_return_6m_after == null ? "6-month outcome not yet available — this episode ended recently" : undefined}
        />
        <Row label="VIX level" value={episode.vix_level.toFixed(1)} />
        <Row label="Fed rate" value={`${episode.fed_rate.toFixed(2)}%`} />
        <Row label="CPI" value={`${episode.cpi.toFixed(1)}%`} />
        <Row label="Yield spread" value={`${episode.yield_spread.toFixed(2)}%`} />
      </div>
    </Card>
  );
}

function Row({
  label,
  value,
  positive,
  naTitle,
}: {
  label: string;
  value: string;
  positive?: boolean;
  naTitle?: string;
}) {
  const color =
    positive === true ? "#0A8A67" : positive === false ? "#B91C1C" : "#0F2B23";
  const isNA = value === "—";
  return (
    <div className="flex items-center justify-between rounded-lg border border-[#EEF5F2] bg-[#F8FCFA] px-3 py-2 text-sm">
      <span className="text-xs font-medium text-[#5A736A]">{label}</span>
      <span
        className="font-semibold tabular-nums"
        style={{ color: isNA ? "#9598A1" : color }}
        title={isNA ? naTitle : undefined}
      >
        {value}
      </span>
    </div>
  );
}
