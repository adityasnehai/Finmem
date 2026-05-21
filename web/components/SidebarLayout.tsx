"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Database,
  MessageSquare,
  BarChart3,
  Activity,
  CircleDot,
  LogOut,
  Zap,
  Gauge,
  Shield,
  Menu,
  X,
} from "lucide-react";
import { getUser, clearAuth } from "@/lib/auth";

const NAV_PRIMARY = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/today", icon: Gauge, label: "Today" },
];

const NAV_RESEARCH = [
  { href: "/memory", icon: Database, label: "Memory" },
  { href: "/chat", icon: MessageSquare, label: "Chat" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/insights", icon: Zap, label: "Insights" },
];

const NAV_SYSTEM = [{ href: "/data", icon: Shield, label: "Data" }];

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const user = getUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "?";

  function logout() {
    clearAuth();
    router.replace("/");
  }

  function renderNavItem({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
    const active = path.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        className={`group flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition ${
          active
            ? "border-[#BCE8DA] bg-[#E9F9F3] text-[#0F2B23] shadow-[0_10px_28px_-22px_rgba(15,167,122,0.5)]"
            : "border-transparent text-[#51685F] hover:border-[#D7E8E0] hover:bg-white hover:text-[#0F2B23]"
        }`}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
            active
              ? "bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] text-white shadow-[0_10px_22px_-12px_rgba(15,167,122,0.55)]"
              : "bg-[#F2FAF6] text-[#5A736A] group-hover:text-[#0A8A67]"
          }`}
        >
          <Icon size={15} />
        </span>
        <span className="font-medium">{label}</span>
        {active && (
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#0FA77A]" aria-hidden />
        )}
      </Link>
    );
  }

  function renderSection(title: string, items: { href: string; icon: React.ElementType; label: string }[]) {
    return (
      <div>
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A938A]">{title}</p>
        <div className="flex flex-col gap-1">{items.map(renderNavItem)}</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4FAF7] text-[#102E25]">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[256px] shrink-0 border-r border-[#D7E8E0] bg-white transition-transform duration-200 md:relative md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 0% 0%, rgba(15,167,122,0.07), transparent 32%), radial-gradient(circle at 100% 18%, rgba(26,173,176,0.08), transparent 30%), radial-gradient(circle at 50% 100%, rgba(245,155,35,0.05), transparent 36%)",
          }}
          aria-hidden
        />
        <div className="relative flex h-full flex-col">
          {/* Brand */}
          <div className="border-b border-[#D7E8E0] px-5 py-5">
            <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div>
                <p className="font-[var(--font-heading)] text-base font-bold tracking-[-0.02em] text-[#0F2B23]">
                  FinMem
                </p>
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#7A938A]">
                  Research Workspace
                </p>
              </div>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5A736A] hover:bg-[#F2FAF6] md:hidden"
              aria-label="Close sidebar"
            >
              <X size={16} />
            </button>
            </div>
          </div>

          {/* User card — only shown when authenticated */}
          {user && (
            <div className="px-4 pt-4">
              <div className="flex items-center gap-3 rounded-xl border border-[#D7E8E0] bg-[#F8FCFA] p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] text-[11px] font-bold text-white shadow-[0_10px_22px_-15px_rgba(15,167,122,0.65)]">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#0F2B23]">{user.name || user.email}</p>
                  <p className="truncate text-xs text-[#5A736A]">{user.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-4 py-5">
            <div className="flex flex-col gap-5">
              {renderSection("Overview", NAV_PRIMARY)}
              {renderSection("Research", NAV_RESEARCH)}
              {renderSection("System", NAV_SYSTEM)}
            </div>
          </nav>

          {/* Status footer */}
          <div className="border-t border-[#D7E8E0] px-4 py-4">
            <div className="rounded-xl border border-[#D7E8E0] bg-[#F8FCFA] p-3">
              <div className="flex items-center gap-2">
                <CircleDot size={11} className="text-[#0A8A67]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5A736A]">
                  {user ? "Authenticated" : "Guest session"}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-[#5A736A]">
                <Activity size={11} className="text-[#1AADB0]" />
                <span>yfinance · FRED · LanceDB</span>
              </div>

              {user ? (
                <button
                  onClick={logout}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#D7E8E0] bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5A736A] transition hover:border-[#F4C7CC] hover:bg-[#FFF1F2] hover:text-[#B91C1C]"
                >
                  <LogOut size={12} /> Sign Out
                </button>
              ) : (
                <Link
                  href="/"
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[linear-gradient(135deg,#0FA77A,#1AADB0)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_12px_24px_-15px_rgba(15,167,122,0.55)] transition hover:brightness-95"
                >
                  Explore Homepage
                </Link>
              )}
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto bg-[#F4FAF7]">
        {/* Mobile hamburger */}
        <div className="sticky top-0 z-20 flex h-12 items-center border-b border-[#D7E8E0] bg-[#F4FAF7]/90 px-4 backdrop-blur md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5A736A] hover:bg-white"
            aria-label="Open sidebar"
          >
            <Menu size={18} />
          </button>
          <span className="ml-3 font-[var(--font-heading)] text-sm font-bold text-[#0F2B23]">FinMem</span>
        </div>
        {children}
      </main>
    </div>
  );
}
