"use client";
import { useState, useRef, useEffect } from "react";
import { streamChat } from "@/lib/api";
import { regimeColor } from "@/lib/constants";
const CHAT_KEY = "finmem_chat";
function loadHistory(): Message[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(CHAT_KEY) ?? "[]"); } catch { return []; }
}
function saveHistory(msgs: Message[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHAT_KEY, JSON.stringify(msgs.slice(-200)));
}
function clearHistory() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CHAT_KEY);
}
import {
  Send,
  MessageSquare,
  Zap,
  Sparkles,
  ArrowRight,
  Trash2,
  BookOpen,
  AlertTriangle,
  History,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  confidence?: number;
  latency_ms?: number;
  isError?: boolean;
}

const COMMANDS = [
  { label: "Today's market", query: "What is today's market state and the closest historical analogs?", desc: "Current snapshot and top historical analogs" },
  { label: "Compare to 2006", query: "How does today compare to the 2006 yield curve inversion period?", desc: "Side-by-side with a specific historical period" },
  { label: "All crisis episodes", query: "Show me all CRISIS regime episodes in the database", desc: "Browse every crisis episode in the database" },
  { label: "Memory summary", query: "Give me a summary of the episode memory database", desc: "Stats on the episode database" },
  { label: "Explain current regime", query: "What does the current market regime mean and what typically follows?", desc: "Context and historical outcomes for the current regime" },
];

const SUGGESTIONS = [
  "What happened after yield curve inversions deeper than -0.30%?",
  "Find episodes where VIX exceeded 30 and the Fed was cutting rates",
  "What is the closest analog to the 2020 COVID crash?",
  "How did markets behave 6 months after CPI peaked above 8%?",
  "What happened when the Fed paused rate hikes historically?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = loadHistory();
    if (stored.length > 0) setMessages(stored);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    const withUser: Message[] = [...messages, { role: "user", content: msg }];
    setMessages(withUser);
    setLoading(true);
    let full = "";
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    try {
      await streamChat(
        msg,
        (chunk) => {
          full += chunk;
          setMessages((prev) => {
            const c = [...prev];
            c[c.length - 1] = { role: "assistant", content: full };
            return c;
          });
        },
        (meta) => {
          setMessages((prev) => {
            const c = [...prev];
            const finalMsg: Message = {
              role: "assistant",
              content: full || "No response received.",
              confidence: meta.confidence,
              latency_ms: meta.latency_ms,
            };
            c[c.length - 1] = finalMsg;
            saveHistory(c);
            return c;
          });
        },
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to connect to the API. Please try again.";
      setMessages((prev) => {
        const c = [...prev];
        c[c.length - 1] = { role: "assistant", content: errMsg, isError: true };
        return c;
      });
    } finally {
      setLoading(false);
    }
  }

  function handleClearHistory() {
    setMessages([]);
    clearHistory();
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col bg-[#F4FAF7]">
      {/* Header */}
      <header className="border-b border-[#D7E8E0] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] text-white shadow-[0_10px_22px_-12px_rgba(15,167,122,0.55)]">
              <MessageSquare size={16} />
            </span>
            <div>
              <h1 className="font-[var(--font-heading)] text-lg font-bold text-[#0F2B23]">Chat</h1>
              <p className="text-xs text-[#5A736A]">
                Grounded answers from historical episode retrieval
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loading && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[#BCE8DA] bg-[#E9F9F3] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0A8A67]">
                <Zap size={11} className="animate-pulse" />
                Reasoning…
              </span>
            )}
            {!isEmpty && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[#D7E8E0] bg-[#F8FCFA] px-2.5 py-1 text-[11px] text-[#5A736A]">
                <History size={11} className="text-[#0A8A67]" />
                Saved locally
              </span>
            )}
            {!isEmpty && !loading && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#D7E8E0] bg-white px-3 text-xs font-semibold text-[#5A736A] transition hover:border-[#F4C7CC] hover:text-[#B91C1C]"
              >
                <Trash2 size={12} /> Clear
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-12">
            <div className="text-center">
              <span className="inline-flex items-center gap-2 rounded-lg border border-[#BCE8DA] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0A8A67] shadow-sm">
                <Sparkles size={12} /> Ask FinMem
              </span>
              <h2 className="mt-5 font-[var(--font-heading)] text-3xl font-bold text-[#0F2B23]">
                What happened the last time markets looked like this?
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#4D665D]">
                Every answer is grounded in the most similar historical episodes, with similarity scores and confidence shown for each response.
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <BookOpen size={13} className="text-[#0A8A67]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A8A67]">
                  Suggested queries
                </span>
              </div>
              <div className="grid gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="group flex items-center gap-3 rounded-xl border border-[#D7E8E0] bg-white px-4 py-3 text-left text-sm text-[#1F3F35] shadow-[0_12px_30px_-26px_rgba(12,58,44,0.3)] transition hover:-translate-y-0.5 hover:border-[#BCE8DA] hover:shadow-[0_18px_40px_-28px_rgba(15,167,122,0.4)]"
                  >
                    <span className="text-sm">{s}</span>
                    <ArrowRight
                      size={13}
                      className="ml-auto shrink-0 text-[#7A938A] transition group-hover:text-[#0A8A67]"
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <BookOpen size={13} className="text-[#1AADB0]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#1AADB0]">
                  Example queries
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {COMMANDS.map(({ label, query, desc }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => send(query)}
                    className="flex items-start gap-3 rounded-xl border border-[#D7E8E0] bg-white px-4 py-3 text-left transition hover:border-[#BCE8DA] hover:bg-[#F2FAF6]"
                  >
                    <span className="text-sm font-semibold text-[#0A8A67]">{label}</span>
                    <span className="ml-auto text-xs leading-5 text-[#4D665D]">{desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-8">
            {messages.map((m, i) => (
              <article
                key={i}
                className={`flex flex-col gap-2 ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                <span
                  className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
                    m.role === "user" ? "text-[#7A938A]" : "text-[#0A8A67]"
                  }`}
                >
                  {m.role === "user" ? "You" : "FinMem"}
                </span>
                {m.role === "assistant" && loading && i === messages.length - 1 && !m.content ? (
                  <ThinkingBubble />
                ) : (
                  <div
                    className={`rounded-2xl border text-sm leading-7 ${
                      m.role === "user"
                        ? "max-w-[85%] border-transparent bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] px-4 py-3 text-white shadow-[0_18px_36px_-22px_rgba(15,167,122,0.55)]"
                        : m.isError
                        ? "max-w-[90%] border-red-200 bg-red-50 text-red-700 shadow-none"
                        : "max-w-[90%] border-[#D7E8E0] bg-white text-[#102E25] shadow-[0_14px_36px_-30px_rgba(12,58,44,0.4)]"
                    }`}
                  >
                    {m.role === "user" ? (
                      <p className="whitespace-pre-wrap px-4 py-3">{m.content}</p>
                    ) : m.isError ? (
                      <div className="flex items-start gap-2 px-4 py-3">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />
                        <p className="text-sm">{m.content}</p>
                      </div>
                    ) : (
                      <MessageContent content={m.content} streaming={loading && i === messages.length - 1} />
                    )}
                  </div>
                )}
                {m.confidence != null && (
                  <div className="flex items-center gap-3 rounded-lg border border-[#D7E8E0] bg-white px-3 py-1.5 text-[11px] text-[#5A736A]">
                    <span className="font-semibold uppercase tracking-[0.1em] text-[#0A8A67]">
                      Confidence
                    </span>
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#EEF5F1]">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#0FA77A,#1AADB0)]"
                        style={{ width: `${m.confidence * 100}%` }}
                      />
                    </div>
                    <span className="font-semibold text-[#0F2B23]">{(m.confidence * 100).toFixed(0)}%</span>
                    <span className="text-[#7A938A]">·</span>
                    <span>{m.latency_ms?.toFixed(0)}ms</span>
                  </div>
                )}
              </article>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-[#D7E8E0] bg-white/85 backdrop-blur">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 rounded-xl border border-[#CDE2DA] bg-white px-3 py-2 shadow-[0_18px_45px_-32px_rgba(12,58,44,0.25)] focus-within:border-[#0FA77A] focus-within:ring-2 focus-within:ring-[#0FA77A]/15"
          >
            <Sparkles size={14} className="ml-1 text-[#0A8A67]" />
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. What happened after yield curve inversions in 2006?"
              disabled={loading}
              className="flex-1 bg-transparent text-sm text-[#102E25] outline-none placeholder:text-[#7A938A] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] text-white shadow-[0_12px_28px_-15px_rgba(15,167,122,0.6)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={14} />
            </button>
          </form>
          <p className="mt-2 text-center text-[11px] text-[#7A938A]">
            Answers include cited historical episodes and a confidence score
          </p>
        </div>
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="max-w-[90%] rounded-2xl border border-[#D7E8E0] bg-white px-5 py-4 shadow-[0_14px_36px_-30px_rgba(12,58,44,0.4)]">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A8A67]">Searching episodes</span>
        <span className="flex gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0FA77A] animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-[#0FA77A] animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-[#0FA77A] animate-bounce" style={{ animationDelay: "300ms" }} />
        </span>
      </div>
    </div>
  );
}

function inlineFormat(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  const combined = /\*\*(.+?)\*\*|\[(STABLE|BULL|CRISIS|SELLOFF|TIGHTENING\+SLOWDOWN|TIGHTENING|EASING\+RECOVERY)\]/g;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = combined.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      parts.push(<strong key={key++} className="font-semibold text-[#0F2B23]">{m[1]}</strong>);
    } else if (m[2]) {
      const accent = regimeColor(m[2]);
      parts.push(
        <span
          key={key++}
          className="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ background: `${accent}18`, color: accent, borderColor: `${accent}33` }}
        >
          {m[2]}
        </span>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function MessageContent({ content, streaming }: { content: string; streaming: boolean }) {
  if (!content) return null;

  const warningMatch = content.match(/^\[([^\]]+)\]/);
  const warning = warningMatch ? warningMatch[1] : null;
  const body = warning ? content.slice(warningMatch![0].length).trimStart() : content;

  const blocks = body.split(/\n{2,}/);

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {warning && (
        <div className="flex items-start gap-2 rounded-lg border border-[#F0D8A8] bg-[#FFF8EA] px-3 py-2 text-xs text-[#7B5C2C]">
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-[#A56C17]" />
          <span>{warning}</span>
        </div>
      )}

      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter(Boolean);
        if (!lines.length) return null;

        const isBulletBlock = lines.some((l) => l.startsWith("•") || l.startsWith("- "));
        const isSourceLine = lines[0].startsWith("→ Source:");

        if (isSourceLine) {
          return (
            <p key={bi} className="border-t border-[#EEF5F2] pt-2 text-[11px] text-[#7A938A]">
              {inlineFormat(lines.join(" "))}
            </p>
          );
        }

        if (isBulletBlock) {
          return (
            <ul key={bi} className="flex flex-col gap-2">
              {lines.map((line, li) => {
                const text = line.replace(/^[•\-]\s*/, "");
                return (
                  <li key={li} className="flex gap-2 rounded-lg border border-[#EEF5F2] bg-[#F8FCFA] px-3 py-2 text-xs leading-6">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0FA77A]" />
                    <span>{inlineFormat(text)}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        return (
          <p key={bi} className="text-sm leading-7 text-[#102E25]">
            {inlineFormat(lines.join(" "))}
            {streaming && bi === blocks.length - 1 && (
              <span className="ml-1 inline-block h-3.5 w-1 animate-pulse rounded-sm bg-[#0FA77A] align-middle" />
            )}
          </p>
        );
      })}
    </div>
  );
}
