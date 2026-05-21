export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function buildDemoChatResponse(message: string): { text: string; confidence: number; latency_ms: number } {
  const prompt = message.toLowerCase();

  if (prompt.includes("2008") || prompt.includes("crisis")) {
    return {
      text: "The closest crisis-style analogs are 2008-09-12 to 2008-12-05 and 2020-02-24 to 2020-04-17, where volatility spiked, liquidity conditions tightened, and forward dispersion stayed elevated. In those episodes, the useful signal was not just the selloff itself but whether policy response and volatility compression stabilized the regime. If today is tracking those periods, the main takeaway is to watch whether stress is broadening or beginning to normalize before assuming a durable recovery. → Source: [2008-09-12, 2020-02-24] · sim 0.81",
      confidence: 0.81,
      latency_ms: 420,
    };
  }

  if (prompt.includes("vix") || prompt.includes("vol")) {
    return {
      text: "When VIX spikes above 40, the nearest historical episodes usually transition into either fast mean reversion with policy support or prolonged stress with repeated volatility aftershocks. The better analogs to inspect are 2011-08, 2020-03, and late 2008, where the path depended on whether cross-asset stress faded quickly after the initial shock. A high-volatility regime by itself is not enough; follow-through in credit, breadth, and rate expectations determines whether the episode resolves or extends. → Source: [2011-08-01, 2020-02-24, 2008-09-12] · sim 0.76",
      confidence: 0.76,
      latency_ms: 396,
    };
  }

  if (prompt.includes("yield") || prompt.includes("inversion") || prompt.includes("curve")) {
    return {
      text: "Yield-curve inversion analogs in FinMem usually map to late-cycle tightening periods where equities can stay resilient for a time even as macro fragility builds underneath. The closest episodes tend to show mixed short-horizon returns but weaker forward breadth and a higher chance of volatility repricing once growth slows. The practical read is that inversion is better as a regime-context signal than as a direct timing trigger. → Source: [2000-07-14, 2006-06-30, 2019-08-23] · sim 0.74",
      confidence: 0.74,
      latency_ms: 388,
    };
  }

  return {
    text: "In demo mode, FinMem is showing a sample grounded answer built from historical analog retrieval rather than a live backend query. The closest matches in this mock state are stable-to-bull episodes with contained volatility, moderate inflation, and positive but less explosive forward returns than pure risk-on environments. The main product behavior to notice is that answers are framed around matched episodes and historical support instead of generic market commentary. → Source: [2017-09-01, 2013-10-01, 2004-06-01] · sim 0.78",
    confidence: 0.78,
    latency_ms: 365,
  };
}

export async function fetchState() {
  const res = await fetch(`${API}/api/state`, { cache: "no-store" });
  if (!res.ok) throw new Error("API unavailable");
  return res.json();
}

export async function fetchMemory() {
  const res = await fetch(`${API}/api/memory`, { cache: "no-store" });
  if (!res.ok) throw new Error("API unavailable");
  return res.json();
}

export async function fetchEpisodes(params: Record<string, string | number>) {
  const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await fetch(`${API}/api/episodes/search?${q}`, { cache: "no-store" });
  if (!res.ok) throw new Error("API unavailable");
  return res.json();
}

export async function fetchAllEpisodes(regime?: string) {
  const params = new URLSearchParams();
  if (regime) params.append("regime", regime);
  const res = await fetch(`${API}/api/episodes?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error("API unavailable");
  return res.json();
}

export async function fetchEpisodeDetail(episodeId: number) {
  const res = await fetch(`${API}/api/episodes/${episodeId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Episode not found");
  return res.json();
}

export async function fetchCompareEpisodes(id1: number, id2: number) {
  const res = await fetch(`${API}/api/episodes/${id1}/compare/${id2}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Comparison failed");
  return res.json();
}

export async function fetchOutcomesDistribution(regime?: string) {
  const params = new URLSearchParams();
  if (regime) params.append("regime", regime);
  const res = await fetch(`${API}/api/outcomes/distribution?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Distribution data unavailable");
  return res.json();
}

export async function fetchEpisodePrecursors(episodeId: number) {
  const res = await fetch(`${API}/api/episodes/${episodeId}/precursors`, { cache: "no-store" });
  if (!res.ok) throw new Error("Precursor data unavailable");
  return res.json();
}

export async function fetchRegimeTransitions() {
  const res = await fetch(`${API}/api/regime-transitions`, { cache: "no-store" });
  if (!res.ok) throw new Error("Transition data unavailable");
  return res.json();
}

export async function fetchPrecursorFrequencies(regime?: string) {
  const params = new URLSearchParams();
  if (regime) params.append("regime", regime);
  const res = await fetch(`${API}/api/precursor-frequencies?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Precursor frequencies unavailable");
  return res.json();
}

export async function fetchAblation() {
  const res = await fetch(`${API}/api/ablation`, { cache: "no-store" });
  if (!res.ok) return { available: false };
  return res.json();
}

export async function fetchCalibration() {
  const res = await fetch(`${API}/api/eval/calibration`, { cache: "no-store" });
  if (!res.ok) return { available: false };
  return res.json();
}

export async function fetchCompression() {
  const res = await fetch(`${API}/api/eval/compression`, { cache: "no-store" });
  if (!res.ok) return { available: false };
  return res.json();
}

export async function fetchEpisodesExport(regime?: string) {
  const params = new URLSearchParams();
  if (regime) params.append("regime", regime);
  const res = await fetch(`${API}/api/episodes/export?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Export unavailable");
  return res.json();
}

export async function fetchDataQuality() {
  const res = await fetch(`${API}/api/data-quality`, { cache: "no-store" });
  if (!res.ok) throw new Error("Data quality unavailable");
  return res.json();
}

function _parseSSELine(line: string, onChunk: (text: string) => void, onDone: (meta: { confidence: number; latency_ms: number }) => void) {
  if (!line.startsWith("data: ")) return;
  try {
    const data = JSON.parse(line.slice(6));
    if (data.done) onDone({ confidence: data.confidence ?? 0, latency_ms: data.latency_ms ?? 0 });
    else if (data.text) onChunk(data.text);
  } catch {}
}

export async function streamChat(
  message: string,
  onChunk: (text: string) => void,
  onDone: (meta: { confidence: number; latency_ms: number }) => void
) {
  let res: Response;
  try {
    res = await fetch(`${API}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
  } catch {
    const demo = buildDemoChatResponse(message);
    onChunk(demo.text);
    onDone({ confidence: demo.confidence, latency_ms: demo.latency_ms });
    return;
  }

  if (!res.ok) {
    const demo = buildDemoChatResponse(message);
    onChunk(demo.text);
    onDone({ confidence: demo.confidence, latency_ms: demo.latency_ms });
    return;
  }

  if (!res.body) {
    onDone({ confidence: 0, latency_ms: 0 });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let doneFired = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        _parseSSELine(line, onChunk, (meta) => { doneFired = true; onDone(meta); });
      }
    }
    // Flush any remaining buffer (stream ended without trailing \n\n)
    if (buf.trim()) {
      _parseSSELine(buf.trim(), onChunk, (meta) => { doneFired = true; onDone(meta); });
    }
  } catch {
    // stream read error
  } finally {
    if (!doneFired) onDone({ confidence: 0, latency_ms: 0 });
  }
}
