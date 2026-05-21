"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { fetchState, fetchMemory, fetchDataQuality } from "@/lib/api";
import { REGIME_COLORS, regimeColor, regimeLabel } from "@/lib/constants";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Sector,
} from "recharts";
import {
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  CheckCircle2,
  Activity,
  TrendingUp,
  Gauge,
  Database,
  MessageSquare,
  BarChart3,
  ShieldCheck,
} from "lucide-react";

interface StateData {
  date: string;
  spy_price: number;
  spy_return_1d: number;
  spy_return_21d: number;
  vix: number;
  cpi: number;
  fed_rate: number;
  yield_spread: number;
  regime: string;
}

interface MemoryData {
  total_episodes: number;
  regimes: Record<string, number>;
  ready: boolean;
}

interface QualityData {
  status: string;
  total_episodes: number;
  overall_completeness_pct: number;
  last_updated: string;
}

export default function Dashboard() {
  const [state, setState] = useState<StateData | null>(null);
  const [memory, setMemory] = useState<MemoryData | null>(null);
  const [quality, setQuality] = useState<QualityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const didLoad = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [stateData, memData, qualityData] = await Promise.all([
        fetchState(),
        fetchMemory(),
        fetchDataQuality(),
      ]);
      setState(stateData.state || stateData);
      setMemory(memData);
      setQuality(qualityData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!didLoad.current) {
      didLoad.current = true;
      refresh();
    }
  }, [refresh]);

  const regimeData = memory?.regimes
    ? Object.entries(memory.regimes)
        .map(([name, count]) => ({
          name,
          value: count,
          color: regimeColor(name),
        }))
        .sort((a, b) => b.value - a.value)
    : [];

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Dashboard"
        subtitle="Research system overview and live market context."
        asOf={state?.date}
        onRefresh={refresh}
        loading={loading}
      />

      <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="mx-auto flex max-w-7xl flex-col gap-8">
          {/* === Market State === */}
          <Section
            label="Current market state"
            description="Today's price, volatility, inflation, policy, and curve signals."
          >
            {loading && !state ? (
              <MetricGridSkeleton count={5} />
            ) : state ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <MetricTile
                    label="SPY Price"
                    value={`$${state.spy_price.toFixed(2)}`}
                    tone="neutral"
                    delta={state.spy_return_1d}
                    deltaSuffix="%"
                    icon={TrendingUp}
                    accent="#0FA77A"
                  />
                  <RegimeTile regime={state.regime} />
                  <MetricTile
                    label="VIX"
                    value={state.vix.toFixed(1)}
                    tone={state.vix > 30 ? "danger" : state.vix > 20 ? "warning" : "good"}
                    caption="21d volatility"
                    icon={Activity}
                    accent={state.vix > 30 ? "#E22134" : state.vix > 20 ? "#F59B23" : "#0FA77A"}
                  />
                  <MetricTile
                    label="Fed Rate"
                    value={`${state.fed_rate.toFixed(2)}%`}
                    tone="neutral"
                    icon={Gauge}
                    accent="#1AADB0"
                  />
                  <MetricTile
                    label="CPI"
                    value={`${state.cpi.toFixed(1)}%`}
                    tone="neutral"
                    icon={Info}
                    accent="#A78BFA"
                  />
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <MetricTile
                    label="21-Day Return"
                    value={`${state.spy_return_21d > 0 ? "+" : ""}${state.spy_return_21d.toFixed(2)}%`}
                    tone={state.spy_return_21d >= 0 ? "good" : "danger"}
                    caption="Momentum"
                    accent={state.spy_return_21d >= 0 ? "#0FA77A" : "#E22134"}
                  />
                  <MetricTile
                    label="Yield Spread"
                    value={`${state.yield_spread.toFixed(2)}%`}
                    tone={state.yield_spread < 0 ? "danger" : "good"}
                    caption={state.yield_spread < 0 ? "Inverted curve" : "Normal curve"}
                    accent={state.yield_spread < 0 ? "#E22134" : "#0FA77A"}
                  />
                </div>
              </>
            ) : (
              <EmptyState text="No market state available right now." />
            )}
          </Section>

          {/* === System Health + Distribution === */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.05fr_1.4fr]">
            <Section
              label="System health"
              description="Data freshness, completeness, and research readiness."
              compact
            >
              {loading && !quality ? (
                <div className="space-y-3">
                  <div className="skeleton h-24 rounded-xl" />
                  <div className="skeleton h-24 rounded-xl" />
                  <div className="skeleton h-24 rounded-xl" />
                </div>
              ) : quality ? (
                <div className="rounded-xl border border-[#D7E8E0] bg-white shadow-[0_18px_40px_-32px_rgba(12,58,44,0.26)] divide-y divide-[#EEF5F2]">
                  <HealthRow
                    label="Data status"
                    icon={CheckCircle2}
                    value={quality.status === "ready" ? "Ready" : "Caution"}
                    accent={quality.status === "ready" ? "#0FA77A" : "#F59B23"}
                    detail={`Updated ${new Date(quality.last_updated).toLocaleDateString()}`}
                  />
                  <HealthRow
                    label="Episodes"
                    icon={Database}
                    value={`${quality.total_episodes}`}
                    accent="#1AADB0"
                    detail="historical episodes"
                  />
                  <HealthRow
                    label="Completeness"
                    icon={ShieldCheck}
                    value={`${quality.overall_completeness_pct}%`}
                    accent={quality.overall_completeness_pct >= 95 ? "#0FA77A" : "#F59B23"}
                    progress={quality.overall_completeness_pct}
                  />
                </div>
              ) : (
                <EmptyState text="No system health data." />
              )}
            </Section>

            <Section
              label="Episode distribution"
              description="Breakdown of historical episodes by detected market regime."
              compact
            >
              {loading && !memory ? (
                <div className="skeleton h-[280px] rounded-xl" />
              ) : regimeData.length ? (
                <div className="grid gap-6 rounded-xl border border-[#D7E8E0] bg-white p-5 shadow-[0_18px_45px_-30px_rgba(12,58,44,0.26)] md:grid-cols-[1fr_1fr]">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={regimeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={96}
                        paddingAngle={2}
                        dataKey="value"
                        activeShape={renderActiveShape}
                      >
                        {regimeData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} stroke="white" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        cursor={{ fill: "transparent" }}
                        contentStyle={{
                          background: "white",
                          border: "1px solid #D7E8E0",
                          borderRadius: 10,
                          fontSize: 12,
                          boxShadow: "0 20px 45px -30px rgba(12,58,44,0.4)",
                        }}
                        formatter={(value) => [`${value} episodes`, ""]}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="flex flex-col justify-center gap-2">
                    {regimeData.map((entry) => {
                      const pct = memory ? ((entry.value / memory.total_episodes) * 100).toFixed(0) : "0";
                      return (
                        <div
                          key={entry.name}
                          className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-1.5 transition hover:border-[#D7E8E0] hover:bg-[#F8FCFA]"
                        >
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: entry.color }} />
                          <span className="flex-1 text-sm font-medium text-[#102E25]">{regimeLabel(entry.name)}</span>
                          <span className="text-xs font-semibold text-[#5A736A]">{pct}%</span>
                          <span className="w-8 text-right text-xs font-semibold text-[#0F2B23]">{entry.value}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <EmptyState text="No episodes detected yet." />
              )}
            </Section>
          </div>

          {/* === Quick Actions === */}
          <Section label="Quick navigation">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <QuickActionCard
                href="/today"
                title="Live Market Today"
                description="Current conditions matched against history's closest analogs."
                icon={Gauge}
              />
              <QuickActionCard
                href="/memory"
                title="Episode Memory"
                description={memory ? `Browse and filter ${memory.total_episodes} labeled episodes.` : "Browse and filter historical episodes."}
                icon={Database}
              />
              <QuickActionCard
                href="/chat"
                title="Ask FinMem"
                description="Ask questions grounded in historical episodes and cited analogs."
                icon={MessageSquare}
              />
              <QuickActionCard
                href="/analytics"
                title="Outcome Analytics"
                description="Distributions, base rates, and retrieval quality benchmarks."
                icon={BarChart3}
              />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

/* ============ Subcomponents ============ */

function PageHeader({
  title,
  subtitle,
  asOf,
  onRefresh,
  loading,
}: {
  title: string;
  subtitle: string;
  asOf?: string;
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <header className="border-b border-[#D7E8E0] bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between md:px-8">
        <div>
          <h1 className="font-[var(--font-heading)] text-2xl font-bold tracking-tight text-[#0F2B23] md:text-3xl">
            {title}
          </h1>
          <p className="mt-1 text-sm text-[#5A736A]">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {asOf && (
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A938A]">As of</p>
              <p className="font-[var(--font-heading)] text-sm font-semibold text-[#0F2B23]">{asOf}</p>
            </div>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#CDE2DA] bg-white px-4 text-sm font-semibold text-[#0F2B23] shadow-sm transition hover:bg-[#F2FAF6] disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-[#0FA77A]" : "text-[#0A8A67]"} />
            Refresh
          </button>
        </div>
      </div>
    </header>
  );
}

function Section({
  label,
  description,
  children,
  compact = false,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0A8A67]">{label}</p>
        {description && !compact && <p className="mt-1.5 text-sm text-[#4D665D]">{description}</p>}
        {description && compact && <p className="mt-1 text-xs text-[#5A736A]">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function MetricTile({
  label,
  value,
  caption,
  delta,
  deltaSuffix = "",
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  caption?: string;
  delta?: number;
  deltaSuffix?: string;
  tone?: "neutral" | "good" | "warning" | "danger";
  icon?: React.ElementType;
  accent: string;
}) {
  const positive = typeof delta === "number" && delta >= 0;
  return (
    <div className="group relative overflow-hidden rounded-xl border border-[#D7E8E0] bg-white p-4 shadow-[0_18px_40px_-32px_rgba(12,58,44,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_50px_-32px_rgba(12,58,44,0.4)]">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A938A]">{label}</p>
        {Icon && (
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: `${accent}14`, color: accent }}
          >
            <Icon size={13} />
          </span>
        )}
      </div>
      <p className="mt-3 font-[var(--font-heading)] text-2xl font-bold tracking-tight" style={{ color: "#0F2B23" }}>
        {value}
      </p>
      {typeof delta === "number" ? (
        <div className="mt-2 flex items-center gap-1 text-xs">
          {positive ? (
            <ArrowUpRight size={12} className="text-[#0A8A67]" />
          ) : (
            <ArrowDownRight size={12} className="text-[#E22134]" />
          )}
          <span className={positive ? "font-semibold text-[#0A8A67]" : "font-semibold text-[#E22134]"}>
            {positive ? "+" : ""}
            {delta.toFixed(2)}
            {deltaSuffix}
          </span>
          <span className="text-[#7A938A]">today</span>
        </div>
      ) : caption ? (
        <p className="mt-2 text-xs text-[#5A736A]">{caption}</p>
      ) : null}
    </div>
  );
}

function RegimeTile({ regime }: { regime: string }) {
  const accent = regimeColor(regime);
  return (
    <div className="rounded-xl border border-[#D7E8E0] bg-white p-4 shadow-[0_18px_40px_-32px_rgba(12,58,44,0.3)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A938A]">Current regime</p>
      <p
        className="mt-3 inline-block rounded-md px-2.5 py-1 font-[var(--font-heading)] text-sm font-bold tracking-wide"
        style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}33` }}
      >
        {regimeLabel(regime)}
      </p>
      <p className="mt-2 text-xs text-[#5A736A]">Current market regime</p>
    </div>
  );
}

function HealthRow({
  label,
  icon: Icon,
  value,
  accent,
  detail,
  progress,
}: {
  label: string;
  icon: React.ElementType;
  value: string;
  accent: string;
  detail?: string;
  progress?: number;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${accent}14`, color: accent }}
      >
        <Icon size={13} />
      </span>
      <span className="w-28 shrink-0 text-xs font-semibold text-[#5A736A]">{label}</span>
      <span className="font-[var(--font-heading)] text-sm font-bold text-[#0F2B23]" style={{ color: accent }}>
        {value}
      </span>
      {typeof progress === "number" ? (
        <div className="ml-auto flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#EEF5F1]">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, progress)}%`, background: "linear-gradient(90deg,#0FA77A,#1AADB0)" }}
            />
          </div>
        </div>
      ) : detail ? (
        <span className="ml-auto text-xs text-[#7A938A]">{detail}</span>
      ) : null}
    </div>
  );
}

function QuickActionCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col gap-3 rounded-xl border border-[#D7E8E0] bg-white p-5 shadow-[0_18px_40px_-32px_rgba(12,58,44,0.26)] transition hover:-translate-y-0.5 hover:border-[#BCE8DA] hover:shadow-[0_22px_50px_-32px_rgba(15,167,122,0.4)]"
    >
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F2FAF6] text-[#0A8A67] transition group-hover:bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] group-hover:text-white">
          <Icon size={16} />
        </span>
        <ArrowUpRight size={14} className="text-[#7A938A] transition group-hover:text-[#0A8A67]" />
      </div>
      <div>
        <p className="font-[var(--font-heading)] text-sm font-semibold text-[#0F2B23]">{title}</p>
        <p className="mt-1.5 text-xs leading-6 text-[#5A736A]">{description}</p>
      </div>
    </Link>
  );
}

function MetricGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton h-[120px] rounded-xl" />
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#D7E8E0] bg-white px-6 py-10 text-center text-sm text-[#5A736A]">
      {text}
    </div>
  );
}

/* recharts active sector */
function renderActiveShape(props: unknown) {
  const p = props as {
    cx: number;
    cy: number;
    innerRadius: number;
    outerRadius: number;
    startAngle: number;
    endAngle: number;
    fill: string;
  };
  return (
    <g>
      <Sector
        cx={p.cx}
        cy={p.cy}
        innerRadius={p.innerRadius}
        outerRadius={p.outerRadius + 6}
        startAngle={p.startAngle}
        endAngle={p.endAngle}
        fill={p.fill}
      />
    </g>
  );
}
