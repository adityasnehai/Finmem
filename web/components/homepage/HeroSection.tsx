"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function HeroSection() {
  const leftAnimation = {
    initial: { x: "-100%", opacity: 0 },
    animate: { x: 0, opacity: 1 },
    transition: { duration: 0.6 },
  };

  const rightAnimation = {
    initial: { x: "100%", opacity: 0 },
    animate: { x: 0, opacity: 1 },
    transition: { duration: 0.6 },
  };

  return (
    <section className="relative overflow-hidden pt-40 pb-20 md:pb-32">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(16,185,129,0.1),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(6,182,212,0.1),transparent_50%)]" />

      <div className="container mx-auto max-w-7xl px-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div {...leftAnimation} className="flex flex-col gap-8">
            <div className="flex flex-col gap-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 w-fit">
                <span className="text-sm font-semibold text-emerald-400">✨ Retrieval-first market research</span>
              </div>

              <h1 className="text-5xl md:text-6xl font-bold leading-tight">
                Query market history with <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">grounded analog retrieval</span>
              </h1>

              <p className="text-xl text-white/60">
                FinMem retrieves the closest historical market episodes to today's regime, shows why they match, and answers with explicit historical support instead of generic commentary.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold hover:opacity-90 transition"
              >
                Try Free <ArrowRight size={16} />
              </Link>
              <button className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-white/20 text-white font-semibold hover:bg-white/5 transition">
                Watch Demo
              </button>
            </div>
          </motion.div>

          <motion.div {...rightAnimation} className="relative">
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f1419] to-transparent" />
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-6">
              <div className="aspect-video bg-gradient-to-br from-white/10 to-white/5 rounded-lg flex items-center justify-center text-white/40">
                <span className="text-lg font-medium">Interactive Demo Area</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
