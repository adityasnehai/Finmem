export const REGIME_COLORS: Record<string, string> = {
  STABLE: "#1AADB0",
  BULL: "#0FA77A",
  CRISIS: "#E22134",
  SELLOFF: "#F97316",
  TIGHTENING: "#F59B23",
  "TIGHTENING+SLOWDOWN": "#FBBF24",
  "EASING+RECOVERY": "#A78BFA",
};

export function regimeColor(r: string): string {
  return REGIME_COLORS[r] ?? "#9598A1";
}

export const REGIME_LABELS: Record<string, string> = {
  STABLE: "Stable",
  BULL: "Bull",
  CRISIS: "Crisis",
  SELLOFF: "Selloff",
  TIGHTENING: "Tightening",
  "TIGHTENING+SLOWDOWN": "Tightening + Slowdown",
  "EASING+RECOVERY": "Easing + Recovery",
};

export function regimeLabel(r: string): string {
  return REGIME_LABELS[r] ?? r;
}

export const ABLATION_LABELS: Record<string, string> = {
  rag: "FinMem (Episodic RAG)",
  fixed_window: "Recency Window (90d)",
  prompt_only: "No Retrieval",
};

export const ABLATION_COLORS: Record<string, string> = {
  rag: "#0FA77A",
  fixed_window: "#1AADB0",
  prompt_only: "#7A938A",
};

export const ALL_REGIMES = [
  "ALL",
  "STABLE",
  "BULL",
  "CRISIS",
  "SELLOFF",
  "TIGHTENING",
  "TIGHTENING+SLOWDOWN",
  "EASING+RECOVERY",
] as const;
