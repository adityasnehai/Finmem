"use client";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sora } from "next/font/google";
import { Eye, EyeOff, ArrowLeft, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { apiLogin, apiRegister, setAuth, isAuthenticated } from "@/lib/auth";

const headingFont = Sora({ subsets: ["latin"], weight: ["500", "600", "700"] });

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "signin"
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) router.replace("/dashboard");
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) return;
    if (mode === "signup" && !name.trim()) {
      setError("Please enter your name.");
      return;
    }
    setLoading(true);
    try {
      const result =
        mode === "signup"
          ? await apiRegister(name.trim(), email.trim(), password)
          : await apiLogin(email.trim(), password);
      setAuth(result.token, result.user);
      setSuccess(true);
      setTimeout(() => router.replace("/dashboard"), 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4FAF7] px-4 py-16">
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(circle at 10% 10%, rgba(15,167,122,0.12) 0%, transparent 45%), radial-gradient(circle at 90% 20%, rgba(26,173,176,0.10) 0%, transparent 40%)",
        }}
      />

      <div className="relative w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-[#5A736A] transition hover:text-[#0F2B23]"
        >
          <ArrowLeft size={14} />
          Back to home
        </Link>

        <div className="rounded-2xl border border-[#D7E8E0] bg-white p-8 shadow-[0_30px_60px_-30px_rgba(12,58,44,0.35)]">
          <div className="mb-7 text-center">
            <Link href="/" className={`${headingFont.className} text-2xl font-bold text-[#0F2B23]`}>
              FinMem
            </Link>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-[#7A938A]">
              Research Workspace
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-6 flex rounded-lg border border-[#D7E8E0] bg-[#F8FCFA] p-1">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); }}
                className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
                  mode === m
                    ? "bg-white text-[#0F2B23] shadow-sm"
                    : "text-[#5A736A] hover:text-[#0F2B23]"
                }`}
              >
                {m === "signin" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {success ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 size={32} className="text-[#0A8A67]" />
              <p className={`${headingFont.className} font-semibold text-[#0F2B23]`}>
                {mode === "signup" ? "Account created!" : "Signed in!"}
              </p>
              <p className="text-sm text-[#5A736A]">Redirecting to your workspace…</p>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              {mode === "signup" && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#0F2B23]">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    required
                    autoComplete="name"
                    className="h-11 w-full rounded-lg border border-[#CDE2DA] bg-[#F8FCFA] px-3 text-sm text-[#0F2B23] placeholder:text-[#7A938A] focus:border-[#0FA77A] focus:outline-none focus:ring-2 focus:ring-[#0FA77A]/15"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#0F2B23]">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  required
                  autoComplete="email"
                  className="h-11 w-full rounded-lg border border-[#CDE2DA] bg-[#F8FCFA] px-3 text-sm text-[#0F2B23] placeholder:text-[#7A938A] focus:border-[#0FA77A] focus:outline-none focus:ring-2 focus:ring-[#0FA77A]/15"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#0F2B23]">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    className="h-11 w-full rounded-lg border border-[#CDE2DA] bg-[#F8FCFA] px-3 pr-10 text-sm text-[#0F2B23] placeholder:text-[#7A938A] focus:border-[#0FA77A] focus:outline-none focus:ring-2 focus:ring-[#0FA77A]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A938A] hover:text-[#0F2B23]"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-[#F4C7CC] bg-[#FFF1F2] px-3 py-2.5 text-xs text-[#B91C1C]">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`${headingFont.className} mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] text-sm font-semibold text-white shadow-[0_14px_28px_-14px_rgba(15,167,122,0.8)] transition hover:brightness-95 disabled:opacity-60`}
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : mode === "signin" ? (
                  "Sign In"
                ) : (
                  "Create Account"
                )}
              </button>
            </form>
          )}

          <div className="mt-5 border-t border-[#EEF5F2] pt-5 text-center text-xs text-[#5A736A]">
            Or{" "}
            <Link
              href="/dashboard"
              className="font-semibold text-[#0A8A67] underline-offset-2 hover:underline"
            >
              explore as a guest
            </Link>{" "}
            — no account needed
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[#7A938A]">
          Historical analogs are for research context only, not financial advice.
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#F4FAF7]"><div className="h-7 w-7 rounded-full border-2 border-[#0FA77A]/25 border-t-[#0FA77A] animate-spin" /></div>}>
      <AuthForm />
    </Suspense>
  );
}
