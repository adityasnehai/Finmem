import { NextRequest } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  const body = await req.json();

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return new Response(
      `data: ${JSON.stringify({ text: "The API server is not reachable. Make sure the backend is running on port 8000.", done: false })}\n\n` +
      `data: ${JSON.stringify({ done: true, confidence: 0, latency_ms: 0 })}\n\n`,
      { status: 200, headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } },
    );
  }

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "Unknown error");
    return new Response(
      `data: ${JSON.stringify({ text: `Backend error (${upstream.status}): ${errText.slice(0, 200)}`, done: false })}\n\n` +
      `data: ${JSON.stringify({ done: true, confidence: 0, latency_ms: 0 })}\n\n`,
      { status: 200, headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } },
    );
  }

  // Pipe the upstream SSE stream directly to the browser
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
