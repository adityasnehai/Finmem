export const API = process.env.NEXT_PUBLIC_API_URL ?? "";

const TIMEOUT_MS = 15_000;

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(id);
  }
}

export async function fetchState() {
  const res = await apiFetch(`${API}/api/state`);
  if (!res.ok) throw new Error("API unavailable");
  return res.json();
}

export async function fetchMemory() {
  const res = await apiFetch(`${API}/api/memory`);
  if (!res.ok) throw new Error("API unavailable");
  return res.json();
}

export async function fetchEpisodes(params: Record<string, string | number>) {
  const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await apiFetch(`${API}/api/episodes/search?${q}`);
  if (!res.ok) throw new Error("API unavailable");
  return res.json();
}

export async function fetchAllEpisodes(regime?: string) {
  const params = new URLSearchParams();
  if (regime) params.append("regime", regime);
  const res = await apiFetch(`${API}/api/episodes?${params}`);
  if (!res.ok) throw new Error("API unavailable");
  return res.json();
}

export async function fetchEpisodeDetail(episodeId: string) {
  const res = await apiFetch(`${API}/api/episodes/${episodeId}`);
  if (!res.ok) throw new Error("Episode not found");
  return res.json();
}

export async function fetchCompareEpisodes(id1: number, id2: number) {
  const res = await apiFetch(`${API}/api/episodes/${id1}/compare/${id2}`);
  if (!res.ok) throw new Error("Comparison failed");
  return res.json();
}

export async function fetchOutcomesDistribution(regime?: string) {
  const params = new URLSearchParams();
  if (regime) params.append("regime", regime);
  const res = await apiFetch(`${API}/api/outcomes/distribution?${params}`);
  if (!res.ok) throw new Error("Distribution data unavailable");
  return res.json();
}

export async function fetchEpisodePrecursors(episodeId: string) {
  const res = await apiFetch(`${API}/api/episodes/${episodeId}/precursors`);
  if (!res.ok) throw new Error("Precursor data unavailable");
  return res.json();
}

export async function fetchRegimeTransitions() {
  const res = await apiFetch(`${API}/api/regime-transitions`);
  if (!res.ok) throw new Error("Transition data unavailable");
  return res.json();
}

export async function fetchPrecursorFrequencies(regime?: string) {
  const params = new URLSearchParams();
  if (regime) params.append("regime", regime);
  const res = await apiFetch(`${API}/api/precursor-frequencies?${params}`);
  if (!res.ok) throw new Error("Precursor frequencies unavailable");
  return res.json();
}

export async function fetchAblation() {
  try {
    const res = await apiFetch(`${API}/api/ablation`);
    if (!res.ok) return { available: false };
    return res.json();
  } catch { return { available: false }; }
}

export async function fetchCalibration() {
  try {
    const res = await apiFetch(`${API}/api/eval/calibration`);
    if (!res.ok) return { available: false };
    return res.json();
  } catch { return { available: false }; }
}

export async function fetchCompression() {
  try {
    const res = await apiFetch(`${API}/api/eval/compression`);
    if (!res.ok) return { available: false };
    return res.json();
  } catch { return { available: false }; }
}

export async function fetchEpisodesExport(regime?: string) {
  const params = new URLSearchParams();
  if (regime) params.append("regime", regime);
  const res = await apiFetch(`${API}/api/episodes/export?${params}`);
  if (!res.ok) throw new Error("Export unavailable");
  return res.json();
}

export async function fetchDataQuality() {
  const res = await apiFetch(`${API}/api/data-quality`);
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
  // Use the Next.js proxy route so the browser never needs to talk directly
  // to the Python backend (avoids WSL2 port-forwarding issues).
  let res: Response;
  try {
    res = await fetch(`/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
  } catch (err) {
    onChunk(`Connection failed: ${err instanceof Error ? err.message : "unknown error"}. Is the Next.js server running?`);
    onDone({ confidence: 0, latency_ms: 0 });
    return;
  }

  if (!res.ok) {
    onChunk(`Server error (${res.status}). Try refreshing the page.`);
    onDone({ confidence: 0, latency_ms: 0 });
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
