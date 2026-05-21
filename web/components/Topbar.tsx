"use client";

export default function Topbar({ episodes, date }: { episodes: number; date: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e1e1e] bg-[#0d0d0d]">
      <div className="flex items-center gap-3">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff9f] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00ff9f]" />
        </span>
        <span className="text-[#00ff9f] font-bold tracking-widest text-sm">FINMEM</span>
        <span className="text-[#333] text-xs tracking-wider">Financial Episodic Memory</span>
      </div>
      <div className="flex items-center gap-4 text-[#333] text-xs tracking-wider">
        <span>{episodes > 0 ? `${episodes} episodes` : "no memory — run make ingest"}</span>
        <span className="text-[#1e1e1e]">|</span>
        <span>1993 – 2026</span>
        <span className="text-[#1e1e1e]">|</span>
        <span>{date}</span>
      </div>
    </div>
  );
}
