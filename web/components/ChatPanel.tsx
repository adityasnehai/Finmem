"use client";
import { useState, useRef, useEffect } from "react";
import { streamChat } from "@/lib/api";
import { Send, ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
  confidence?: number;
  latency_ms?: number;
}

const SUGGESTIONS = [
  "What happened after yield curve inversions?",
  "Compare today to 2008",
  "Show CRISIS episodes",
  "What follows VIX spikes above 40?",
];

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setLoading(true);
    let full = "";
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);
    try {
      await streamChat(msg,
        (chunk) => {
          full += chunk;
          setMessages(prev => {
            const c = [...prev];
            c[c.length - 1] = { role: "assistant", content: full };
            return c;
          });
        },
        (meta) => {
          setMessages(prev => {
            const c = [...prev];
            c[c.length - 1] = {
              role: "assistant", content: full || "No response received.",
              confidence: meta.confidence, latency_ms: meta.latency_ms,
            };
            return c;
          });
        }
      );
    } finally { setLoading(false); }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col rounded-[28px] border border-emerald-100/80 bg-white/92 shadow-[0_24px_55px_-34px_rgba(15,23,42,0.16)]" style={{ minHeight: "320px", maxHeight: "460px" }}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold tracking-[0.08em] text-slate-500">Episodic Reasoning</span>
          <span className="text-sm text-slate-400">GPT-4o · grounded</span>
        </div>
        <Link href="/chat" className="flex items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-emerald-700">
          EXPAND <ArrowUpRight size={10} />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3 min-h-0">
        {isEmpty ? (
          <div className="flex flex-col gap-2 mt-2">
            <span className="mb-1 text-xs font-semibold tracking-[0.08em] text-slate-400">Suggested Queries</span>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 transition-all hover:border-emerald-200 hover:bg-emerald-50/70 hover:text-emerald-700">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-7 whitespace-pre-wrap
                ${m.role === "user"
                  ? "border border-emerald-100 bg-emerald-50/80 text-slate-700"
                  : "border border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,251,250,0.96))] text-slate-600"
                }`}>
                {m.content}
                {m.role === "assistant" && loading && i === messages.length - 1 && (
                  <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-emerald-500" />
                )}
              </div>
              {m.confidence != null && (
                <span className="px-1 text-xs text-slate-400">
                  confidence {(m.confidence * 100).toFixed(0)}% · {m.latency_ms?.toFixed(0)}ms
                </span>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-3 shrink-0">
        <span className="select-none text-base text-emerald-600">›</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Ask about market history..."
          disabled={loading}
          className="flex-1 bg-transparent text-[0.95rem] text-slate-700 placeholder:text-slate-400 outline-none" />
        <button onClick={() => send()} disabled={loading || !input.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700 transition-all hover:bg-emerald-100 disabled:opacity-20">
          <Send size={11} />
        </button>
      </div>
    </div>
  );
}
