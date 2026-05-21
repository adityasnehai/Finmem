"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sticky, setSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setSticky(window.scrollY >= 80);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 z-40 w-full transition-all duration-300 ${sticky ? "bg-[#0f1419]/95 backdrop-blur-md shadow-lg pt-5 pb-5" : "pt-7 pb-7"}`}>
      <div className="container mx-auto max-w-7xl px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500" />
          <span className="text-lg font-bold">FinMem</span>
        </div>

        <nav className="hidden lg:flex gap-8">
          {[
            { label: "Features", href: "#features" },
            { label: "How it Works", href: "#how-it-works" },
            { label: "FAQ", href: "#faq" },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm font-medium text-white/60 hover:text-white transition"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex gap-3 items-center">
          <Link
            href="/dashboard"
            className="hidden lg:inline-flex text-sm font-medium text-white/60 hover:text-white transition"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="hidden lg:inline-flex px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-semibold hover:opacity-90 transition"
          >
            Get Started
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-white/10 mt-4">
          <nav className="container mx-auto max-w-7xl px-4 py-4 space-y-3">
            {[
              { label: "Features", href: "#features" },
              { label: "How it Works", href: "#how-it-works" },
              { label: "FAQ", href: "#faq" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="block text-sm font-medium text-white/60 hover:text-white transition"
              >
                {item.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-4">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-white/60 hover:text-white transition text-center"
              >
                Sign In
              </Link>
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-semibold hover:opacity-90 transition text-center"
              >
                Get Started
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
