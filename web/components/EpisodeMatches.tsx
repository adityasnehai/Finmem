"use client";

interface Episode {
  start_date: string; end_date: string; regime: string;
  similarity: number; similarity_pct: string;
  spy_return_6m_after: number | null;
}

const REGIME_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  STABLE:               { bg: "rgba(59,130,246,0.1)",  text: "#2563eb", bar: "#2563eb" },
  BULL:                 { bg: "rgba(16,185,129,0.1)",  text: "#0f9d7a", bar: "#0f9d7a" },
  CRISIS:               { bg: "rgba(239,68,68,0.1)",   text: "#dc2626", bar: "#dc2626" },
  SELLOFF:              { bg: "rgba(249,115,22,0.1)",  text: "#ea580c", bar: "#ea580c" },
  TIGHTENING:           { bg: "rgba(245,158,11,0.12)", text: "#d97706", bar: "#d97706" },
  "TIGHTENING+SLOWDOWN":{ bg: "rgba(234,179,8,0.12)",  text: "#ca8a04", bar: "#ca8a04" },
  "EASING+RECOVERY":    { bg: "rgba(14,165,233,0.1)",  text: "#0284c7", bar: "#0284c7" },
};

const rc = (regime: string) => REGIME_COLORS[regime] ?? REGIME_COLORS.STABLE;

export default function EpisodeMatches({ episodes, confidence }: {
  episodes: Episode[]; confidence: number;
}) {
  const confLabel = confidence >= 0.27 ? "HIGH CONFIDENCE" : confidence >= 0.15 ? "MODERATE" : "LOW";
  const confColor = confidence >= 0.27 ? "#0f9d7a" : confidence >= 0.15 ? "#d97706" : "#dc2626";

  return (
    <div className="flex h-full flex-col gap-4 rounded-[28px] border border-emerald-100/80 bg-white/92 p-5 shadow-[0_24px_55px_-34px_rgba(15,23,42,0.16)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold tracking-[0.08em] text-slate-500">Memory Matches</span>
          <span className="text-sm text-slate-400">top {episodes.length} analogs</span>
        </div>
        <div className="flex items-center gap-1.5" style={{ color: confColor }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: confColor }} />
          <span className="text-xs font-medium">{confLabel}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {episodes.map((ep, i) => {
          const c       = rc(ep.regime);
          const outcome = ep.spy_return_6m_after;
          const outStr  = outcome != null ? `${outcome > 0 ? "+" : ""}${(outcome * 100).toFixed(1)}% 6m` : "N/A";
          const outColor = outcome == null ? "#64748b" : outcome < 0 ? "#dc2626" : "#0f9d7a";

          return (
            <div key={i} className="group relative flex items-center gap-4 rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,251,250,0.98))] px-4 py-3.5 transition-all hover:border-emerald-200 hover:shadow-[0_16px_34px_-24px_rgba(15,23,42,0.12)]">
              <span className="w-5 shrink-0 text-xs tabular-nums text-slate-400">{i + 1}</span>

              <div className="flex w-28 shrink-0 flex-col gap-0.5">
                <span className="text-sm tabular-nums text-slate-600">{ep.start_date}</span>
                <span className="w-fit rounded-md border px-1.5 py-0.5 text-xs font-medium"
                  style={{ background: c.bg, color: c.text, borderColor: c.text + "40" }}>
                  {ep.regime}
                </span>
              </div>

              <div className="flex flex-1 items-center gap-2.5">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${ep.similarity * 100}%`, background: c.bar }} />
                </div>
                <span className="w-10 text-right text-sm font-bold tabular-nums" style={{ color: c.bar }}>
                  {ep.similarity_pct}
                </span>
              </div>

              <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums" style={{ color: outColor }}>
                {outStr}
              </span>
            </div>
          );
        })}

        {episodes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <span className="text-sm text-slate-500">No historical analogs found</span>
            <span className="text-xs text-slate-400">The memory database may still be loading</span>
          </div>
        )}
      </div>

      {episodes.length > 0 && (
        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-medium tracking-[0.08em] text-slate-400">
          <span>SIMILARITY · COSINE + REGIME BONUS</span>
          <span>6M FORWARD RETURN</span>
        </div>
      )}
    </div>
  );
}
