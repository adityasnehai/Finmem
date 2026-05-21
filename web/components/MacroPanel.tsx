"use client";

interface State {
  fed_rate: number; cpi: number; yield_spread: number; unemployment: number;
}
interface MemoryStats {
  total_episodes: number; start_date: string; end_date: string;
  regimes: Record<string, number>; ready: boolean;
}

const REGIME_COLORS: Record<string, string> = {
  STABLE: "#2563eb", BULL: "#0f9d7a", CRISIS: "#dc2626",
  SELLOFF: "#ea580c", TIGHTENING: "#d97706",
  "TIGHTENING+SLOWDOWN": "#ca8a04", "EASING+RECOVERY": "#0284c7",
};

export default function MacroPanel({ state, memory }: { state: State; memory: MemoryStats }) {
  const rows = [
    {
      label: "FED FUNDS", value: `${state.fed_rate.toFixed(2)}%`, code: "FEDFUNDS",
      color: state.fed_rate > 5 ? "#dc2626" : state.fed_rate > 3 ? "#d97706" : "#64748b",
      bar: Math.min(state.fed_rate / 6, 1),
    },
    {
      label: "CPI YoY", value: `${state.cpi.toFixed(1)}%`, code: "CPIAUCSL",
      color: state.cpi > 6 ? "#dc2626" : state.cpi > 4 ? "#d97706" : "#0f9d7a",
      bar: Math.min(state.cpi / 10, 1),
    },
    {
      label: "10Y – 2Y", value: `${state.yield_spread > 0 ? "+" : ""}${state.yield_spread.toFixed(2)}%`, code: "T10Y2Y",
      color: state.yield_spread < -0.2 ? "#dc2626" : state.yield_spread < 0 ? "#d97706" : "#64748b",
      bar: Math.min((state.yield_spread + 2) / 4, 1),
    },
    {
      label: "UNEMPLOYMENT", value: `${state.unemployment.toFixed(1)}%`, code: "UNRATE",
      color: state.unemployment > 7 ? "#dc2626" : state.unemployment > 5 ? "#d97706" : "#64748b",
      bar: Math.min(state.unemployment / 12, 1),
    },
  ];

  const totalEps = memory.total_episodes;
  const topRegimes = Object.entries(memory.regimes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="flex h-full flex-col gap-4 rounded-[28px] border border-emerald-100/80 bg-white/92 p-5 shadow-[0_24px_55px_-34px_rgba(15,23,42,0.16)]">
      <span className="text-xs font-semibold tracking-[0.08em] text-slate-500">Macro Indicators · FRED</span>

      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.label} className="group flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-0">
            <div className="flex w-28 shrink-0 flex-col gap-0.5">
              <span className="text-xs font-medium tracking-[0.08em] text-slate-500">{r.label}</span>
              <span className="text-xs text-slate-400">{r.code}</span>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full" style={{ width: `${r.bar * 100}%`, background: r.color, opacity: 0.6 }} />
              </div>
            </div>
            <span className="w-16 text-right text-[0.95rem] font-bold tabular-nums" style={{ color: r.color }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium tracking-[0.08em] text-slate-500">EPISODES</span>
          <span className={memory.ready ? "font-bold text-emerald-700" : "text-red-600"}>{totalEps}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium tracking-[0.08em] text-slate-500">COVERAGE</span>
          <span className="tabular-nums text-slate-500">
            {memory.start_date?.slice(0, 7)} → {memory.end_date?.slice(0, 7)}
          </span>
        </div>

        {topRegimes.length > 0 && (
          <div className="mt-1 flex flex-col gap-1">
            {topRegimes.map(([regime, count]) => (
              <div key={regime} className="flex items-center gap-2">
                <span className="w-24 truncate text-xs font-medium" style={{ color: REGIME_COLORS[regime] ?? "#64748b" }}>
                  {regime}
                </span>
                <div className="h-0.5 flex-1 rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{
                    width: `${(count / totalEps) * 100}%`,
                    background: REGIME_COLORS[regime] ?? "#2563eb",
                    opacity: 0.5,
                  }} />
                </div>
                <span className="w-6 text-right text-xs tabular-nums text-slate-400">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
