"use client";

interface State {
  spy_price: number; spy_return_1d: number; spy_return_5d: number;
  vix: number; cpi: number; fed_rate: number;
  yield_spread: number; unemployment: number; regime: string; date: string;
}

function Metric({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] tracking-widest text-[#444]">{label}</span>
      <span className={`text-xl font-bold ${color ?? "text-[#e2e8f0]"}`}>{value}</span>
      {sub && <span className={`text-[10px] ${color ?? "text-[#555]"}`}>{sub}</span>}
    </div>
  );
}

export default function MarketState({ state }: { state: State }) {
  const spyColor  = state.spy_return_1d < 0 ? "text-red-400" : "text-[#00ff9f]";
  const vixColor  = state.vix > 30 ? "text-red-400" : state.vix > 20 ? "text-yellow-400" : "text-[#00ff9f]";
  const crvColor  = state.yield_spread < 0 ? "text-red-400" : "text-[#e2e8f0]";
  const cpiColor  = state.cpi > 4 ? "text-yellow-400" : "text-[#e2e8f0]";

  return (
    <div className="bg-[#111] border border-[#1e1e1e] p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-widest text-[#444]">CURRENT MARKET STATE</span>
        <span className="text-[10px] px-2 py-0.5 border border-[#2a2a2a] text-yellow-400 tracking-wider">
          {state.regime}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-x-6 gap-y-4">
        <Metric label="SPY"          value={`$${state.spy_price.toFixed(2)}`}
          sub={`${state.spy_return_1d > 0 ? "+" : ""}${state.spy_return_1d.toFixed(2)}% 1d · ${state.spy_return_5d > 0 ? "+" : ""}${state.spy_return_5d.toFixed(1)}% 5d`} color={spyColor} />
        <Metric label="VIX"          value={state.vix.toFixed(1)}
          sub={state.vix > 25 ? "ELEVATED" : "NORMAL"} color={vixColor} />
        <Metric label="CPI YoY"      value={`${state.cpi.toFixed(1)}%`}
          sub="CPIAUCSL" color={cpiColor} />
        <Metric label="FED RATE"     value={`${state.fed_rate.toFixed(2)}%`}
          sub="FEDFUNDS" />
        <Metric label="YIELD CURVE"  value={`${state.yield_spread > 0 ? "+" : ""}${state.yield_spread.toFixed(2)}%`}
          sub={state.yield_spread < 0 ? "INVERTED · T10Y2Y" : "T10Y2Y"} color={crvColor} />
        <Metric label="UNEMPLOYMENT" value={`${state.unemployment.toFixed(1)}%`}
          sub="UNRATE" />
      </div>
    </div>
  );
}
