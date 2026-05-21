"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchAllEpisodes, fetchEpisodesExport } from "@/lib/api";
import { ALL_REGIMES, regimeColor, regimeLabel } from "@/lib/constants";
import { Database, Search, Filter, Eye, GitCompare, Download, ChevronDown } from "lucide-react";

interface Episode {
  id?: string | number;
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
  spy_return_6m_after: number | null;
  prose_summary: string;
}

export default function MemoryPage() {
  const router = useRouter();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [regime, setRegime] = useState("ALL");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [vixMin, setVixMin] = useState(0);
  const [vixMax, setVixMax] = useState(80);
  const [returnMin, setReturnMin] = useState(-50);
  const [returnMax, setReturnMax] = useState(100);
  const [fedMin, setFedMin] = useState(0);
  const [fedMax, setFedMax] = useState(8);
  const [exporting, setExporting] = useState(false);

  async function handleExportCSV() {
    try {
      setExporting(true);
      const data = await fetchEpisodesExport(regime !== "ALL" ? regime : undefined);
      const csv = [
        [
          "Start Date",
          "End Date",
          "Duration (days)",
          "Regime",
          "SPY Return %",
          "Max Drawdown %",
          "6M After %",
          "VIX Avg",
          "CPI %",
          "Fed Rate %",
          "Yield Spread %",
          "Unemployment %",
          "Summary",
        ].join(","),
        ...data.episodes.map((ep: Record<string, unknown>) =>
          [
            `="${ep.start_date}"`,
            `="${ep.end_date}"`,
            ep.duration_days,
            ep.regime,
            ep["spy_return_%"] ?? "",
            ep["max_drawdown_%"] ?? "",
            ep["spy_return_6m_after_%"] ?? "",
            ep.vix_avg ?? "",
            ep["cpi_%"] ?? "",
            ep["fed_rate_%"] ?? "",
            ep["yield_spread_%"] ?? "",
            ep["unemployment_%"] ?? "",
            `"${String(ep.summary ?? "").replace(/"/g, '""')}"`,
          ].join(","),
        ),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finmem-episodes-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const load = useCallback(async (reg: string) => {
    setLoading(true);
    try {
      const data = await fetchAllEpisodes(reg !== "ALL" ? reg : undefined);
      setEpisodes(data.episodes ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(regime), 0);
    return () => clearTimeout(t);
  }, [regime, load]);

  const filtered = episodes.filter((ep) => {
    const matchesQuery =
      query === "" ||
      ep.start_date.includes(query) ||
      ep.regime.toLowerCase().includes(query.toLowerCase()) ||
      ep.prose_summary.toLowerCase().includes(query.toLowerCase());

    const matchesVix = ep.vix_level >= vixMin && ep.vix_level <= vixMax;

    const matchesReturn = ep.total_return >= returnMin && ep.total_return <= returnMax;

    const matchesFed = ep.fed_rate >= fedMin && ep.fed_rate <= fedMax;

    return matchesQuery && matchesVix && matchesReturn && matchesFed;
  });

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="border-b border-[#D7E8E0] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] text-white shadow-[0_10px_22px_-12px_rgba(15,167,122,0.55)]">
              <Database size={16} />
            </span>
            <div>
              <h1 className="font-[var(--font-heading)] text-2xl font-bold text-[#0F2B23]">Episode Memory</h1>
              <p className="text-sm text-[#5A736A]">
                {filtered.length} of {episodes.length} episodes
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                size={13}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7A938A]"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search episodes…"
                className="h-10 w-60 rounded-lg border border-[#CDE2DA] bg-white pl-9 pr-3 text-sm text-[#0F2B23] placeholder:text-[#7A938A] focus:border-[#0FA77A] focus:outline-none focus:ring-2 focus:ring-[#0FA77A]/15"
              />
            </div>
            <button
              type="button"
              onClick={() => router.push("/compare")}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#CDE2DA] bg-white px-3 text-sm font-semibold text-[#0F2B23] transition hover:bg-[#F2FAF6]"
            >
              <GitCompare size={13} className="text-[#0A8A67]" />
              Compare
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={exporting}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] px-3 text-sm font-semibold text-white shadow-[0_12px_24px_-15px_rgba(15,167,122,0.55)] transition hover:brightness-95 disabled:opacity-50"
            >
              <Download size={13} />
              {exporting ? "Preparing download…" : "Download CSV"}
            </button>
          </div>
        </div>
      </header>

      {/* Regime filter bar */}
      <div className="border-b border-[#D7E8E0] bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-6 py-3 md:px-8">
          <Filter size={13} className="shrink-0 text-[#7A938A]" />
          {ALL_REGIMES.map((r) => {
            const active = r === regime;
            const color = r !== "ALL" ? regimeColor(r) : "#0FA77A";
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRegime(r)}
                className="shrink-0 rounded-md border px-3 py-1.5 text-[11px] font-semibold transition"
                style={
                  active
                    ? {
                        background: `${color}18`,
                        color,
                        borderColor: `${color}40`,
                      }
                    : {
                        background: "white",
                        color: "#5A736A",
                        borderColor: "#E2EEE9",
                      }
                }
              >
                {r === "ALL" ? "All" : regimeLabel(r)}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="ml-auto shrink-0 rounded-md border border-[#E2EEE9] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#5A736A] transition hover:border-[#BCE8DA] hover:text-[#0A8A67]"
          >
            {showFilters ? "Hide filters" : "More filters"}
          </button>
        </div>
      </div>

      {/* Advanced filters panel */}
      {showFilters && (
        <div className="border-b border-[#D7E8E0] bg-[#F8FCFA]">
          <div className="mx-auto grid max-w-7xl gap-5 px-6 py-5 md:grid-cols-3 md:px-8">
            <RangeField
              label="VIX range"
              min={0}
              max={80}
              from={vixMin}
              to={vixMax}
              onFrom={setVixMin}
              onTo={setVixMax}
            />
            <RangeField
              label="Return range %"
              min={-50}
              max={100}
              from={returnMin}
              to={returnMax}
              onFrom={setReturnMin}
              onTo={setReturnMax}
            />
            <RangeField
              label="Fed rate range %"
              min={0}
              max={8}
              step={0.1}
              from={fedMin}
              to={fedMax}
              onFrom={setFedMin}
              onTo={setFedMax}
            />
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setRegime("ALL");
                setVixMin(0);
                setVixMax(80);
                setReturnMin(-50);
                setReturnMax(100);
                setFedMin(0);
                setFedMax(8);
              }}
              className="justify-self-start text-xs font-semibold text-[#0A8A67] hover:underline"
            >
              Reset all filters
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8">
        <div className="mx-auto max-w-7xl">
          {loading ? (
            <div className="grid gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-20 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3">
              {filtered.map((ep, i) => {
                const accent = regimeColor(ep.regime);
                const isOpen = expanded === i;
                const outcome = ep.spy_return_6m_after;
                return (
                  <div
                    key={i}
                    className="overflow-hidden rounded-xl border border-[#D7E8E0] bg-white shadow-[0_14px_36px_-30px_rgba(12,58,44,0.26)] transition hover:border-[#BCE8DA]"
                  >
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : i)}
                      className="flex w-full items-center gap-4 px-5 py-4 text-left"
                    >
                      <span
                        className="shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]"
                        style={{
                          background: `${accent}18`,
                          color: accent,
                          borderColor: `${accent}33`,
                        }}
                      >
                        {regimeLabel(ep.regime)}
                      </span>
                      <div className="w-36 shrink-0">
                        <p className="font-[var(--font-heading)] text-sm font-semibold tabular-nums text-[#0F2B23]">
                          {ep.start_date}
                        </p>
                        <p className="text-xs text-[#5A736A]">→ {ep.end_date}</p>
                      </div>
                      <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-2">
                        <Metric
                          label="SPY"
                          value={`${ep.total_return > 0 ? "+" : ""}${ep.total_return.toFixed(1)}%`}
                          color={ep.total_return > 0 ? "#0A8A67" : "#B91C1C"}
                        />
                        <Metric
                          label="DD"
                          value={`${ep.max_drawdown.toFixed(1)}%`}
                          color="#B91C1C"
                        />
                        <Metric
                          label="VIX"
                          value={ep.vix_level.toFixed(1)}
                          color={ep.vix_level > 30 ? "#B91C1C" : ep.vix_level > 20 ? "#F59B23" : "#5A736A"}
                        />
                        <Metric label="FED" value={`${ep.fed_rate.toFixed(2)}%`} color="#5A736A" />
                      </div>
                      <div className="shrink-0 text-right">
                        {outcome != null ? (
                          <>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7A938A]">
                              6M after
                            </p>
                            <p
                              className="font-[var(--font-heading)] text-sm font-bold tabular-nums"
                              style={{ color: outcome > 0 ? "#0A8A67" : "#B91C1C" }}
                            >
                              {outcome > 0 ? "+" : ""}
                              {outcome.toFixed(1)}%
                            </p>
                          </>
                        ) : (
                          <span className="text-xs text-[#7A938A]" title="6-month outcome not yet available for this episode">—</span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/episodes/${ep.id}`);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D7E8E0] text-[#0A8A67] transition hover:border-[#BCE8DA] hover:bg-[#F2FAF6]"
                          title="View details"
                        >
                          <Eye size={13} />
                        </button>
                        <ChevronDown
                          size={14}
                          className={`text-[#7A938A] transition ${isOpen ? "rotate-180" : ""}`}
                        />
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-[#EEF5F2] bg-[#F8FCFA] px-5 pb-5 pt-4">
                        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                          <Metric
                            label="CPI"
                            value={`${ep.cpi.toFixed(1)}%`}
                            color={ep.cpi > 5 ? "#F59B23" : "#5A736A"}
                          />
                          <Metric label="Fed" value={`${ep.fed_rate.toFixed(2)}%`} color="#5A736A" />
                          <Metric
                            label="Yield"
                            value={`${ep.yield_spread > 0 ? "+" : ""}${ep.yield_spread.toFixed(2)}%`}
                            color={ep.yield_spread < 0 ? "#B91C1C" : "#5A736A"}
                          />
                          <Metric
                            label="Unempl"
                            value={`${ep.unemployment.toFixed(1)}%`}
                            color="#5A736A"
                          />
                          <Metric
                            label="VIX"
                            value={ep.vix_level.toFixed(1)}
                            color={ep.vix_level > 30 ? "#B91C1C" : "#5A736A"}
                          />
                          <Metric
                            label="Max DD"
                            value={`${ep.max_drawdown.toFixed(1)}%`}
                            color="#B91C1C"
                          />
                        </div>
                        <p className="text-sm leading-7 text-[#1F3F35]">{ep.prose_summary}</p>
                      </div>
                    )}
                  </div>
                );
              })}

              {filtered.length === 0 && !loading && (
                <div className="rounded-xl border border-dashed border-[#D7E8E0] bg-white px-6 py-12 text-center">
                  <p className="text-sm text-[#5A736A]">No episodes match your current filters.</p>
                  <button
                    type="button"
                    onClick={() => { setQuery(""); setRegime("ALL"); setVixMin(0); setVixMax(80); setReturnMin(-50); setReturnMax(100); setFedMin(0); setFedMax(8); }}
                    className="mt-3 text-xs font-semibold text-[#0A8A67] hover:underline"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A938A]">{label}</span>
      <span className="font-[var(--font-heading)] text-sm font-bold tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function RangeField({
  label,
  min,
  max,
  step = 1,
  from,
  to,
  onFrom,
  onTo,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  from: number;
  to: number;
  onFrom: (v: number) => void;
  onTo: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0A8A67]">{label}</label>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={from}
          onChange={(e) => onFrom(Number(e.target.value))}
          className="w-16 rounded-md border border-[#CDE2DA] bg-white px-2 py-1 text-center text-xs text-[#0F2B23] focus:border-[#0FA77A] focus:outline-none focus:ring-2 focus:ring-[#0FA77A]/15"
        />
        <span className="text-xs text-[#7A938A]">to</span>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={to}
          onChange={(e) => onTo(Number(e.target.value))}
          className="w-16 rounded-md border border-[#CDE2DA] bg-white px-2 py-1 text-center text-xs text-[#0F2B23] focus:border-[#0FA77A] focus:outline-none focus:ring-2 focus:ring-[#0FA77A]/15"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={from}
        onChange={(e) => onFrom(Number(e.target.value))}
        className="mt-2 h-1 w-full appearance-none rounded-full bg-[#E2EEE9] accent-[#0FA77A]"
      />
    </div>
  );
}
