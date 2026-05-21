const TOKEN_KEY = "finmem_token";
const USER_KEY  = "finmem_user";
const API_BASE  = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface User {
  id: string;
  name: string;
  email: string;
}

export function setAuth(token: string, user: User): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as User; } catch { return null; }
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export async function apiRegister(name: string, email: string, password: string): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? "Registration failed.");
  return { token: data.access_token, user: data.user };
}

export async function apiLogin(email: string, password: string): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? "Login failed.");
  return { token: data.access_token, user: data.user };
}

/* ── Per-user chat history (localStorage) ── */

export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  confidence?: number;
  latency_ms?: number;
  ts: number;
}

function chatKey(userId: string): string {
  return `finmem_chat_${userId}`;
}

export function loadChatHistory(userId: string): StoredMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(chatKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as StoredMessage[];
  } catch {
    return [];
  }
}

export function saveChatHistory(userId: string, messages: StoredMessage[]): void {
  if (typeof window === "undefined") return;
  const trimmed = messages.slice(-200);
  localStorage.setItem(chatKey(userId), JSON.stringify(trimmed));
}

export function clearChatHistory(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(chatKey(userId));
}
