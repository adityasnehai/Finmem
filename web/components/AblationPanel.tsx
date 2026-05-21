"use client";

interface AblationRow {
  avg_quality: number; grounded_pct: number; lat_p50_ms: number; lat_p95_ms: number;
}

const LABELS: Record<string, string> = {
  rag: "FinMem RAG",
  fixed_window: "Fixed 90d Win",
  prompt_only: "Prompt Only",
};

export default function AblationPanel({ data }: { data: { available: boolean; results?: Record<string, AblationRow> } }) {
  return (
    <div className="bg-[#111] border border-[#1e1e1e] p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-widest text-[#444]">COMPRESSION ABLATION</span>
        <span className="text-[10px] text-[#333]">RAG vs Fixed vs Prompt-only</span>
      </div>
      {!data.available ? (
        <div className="text-[#333] text-xs py-2">
          Run <code className="text-[#00ff9f44]">make eval</code> to populate ablation results.
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] text-[#444] tracking-wider border-b border-[#1e1e1e]">
              <th className="text-left py-1.5 font-normal">SYSTEM</th>
              <th className="text-right py-1.5 font-normal">QUALITY /3</th>
              <th className="text-right py-1.5 font-normal">GROUNDED</th>
              <th className="text-right py-1.5 font-normal">LAT P50</th>
              <th className="text-right py-1.5 font-normal">LAT P95</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.results ?? {}).map(([sys, row]) => (
              <tr key={sys} className={`border-b border-[#161616] ${sys === "rag" ? "text-[#e2e8f0]" : "text-[#555]"}`}>
                <td className="py-2 pr-4">
                  {LABELS[sys]}
                  {sys === "rag" && <span className="ml-2 text-[10px] text-[#00ff9f]">← best</span>}
                </td>
                <td className="text-right">{row.avg_quality}</td>
                <td className="text-right">{row.grounded_pct}%</td>
                <td className="text-right">{row.lat_p50_ms}ms</td>
                <td className="text-right">{row.lat_p95_ms}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
