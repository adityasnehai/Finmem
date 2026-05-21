"use client";

import { motion } from "framer-motion";
import { Database, BarChart3, Zap, Brain } from "lucide-react";

const steps = [
  {
    icon: Database,
    title: "Segment",
    desc: "Market data segmented into 4 regimes (BULL, RECOVERY, BEAR, SLOWDOWN) using Markov Switching Model.",
  },
  {
    icon: BarChart3,
    title: "Embed",
    desc: "Each episode embedded with FinBERT to capture market semantics and regime characteristics.",
  },
  {
    icon: Zap,
    title: "Retrieve",
    desc: "Current market state matched against 60+ historical episodes using similarity search in LanceDB.",
  },
  {
    icon: Brain,
    title: "Reason",
    desc: "LLM generates analysis with explicit historical support, outcomes, and causal factors.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 md:py-32">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="text-center mb-16">
          <motion.div
            initial={{ y: "-100%", opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-emerald-400 font-medium mb-4">HOW IT WORKS</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              One system with multiple research capabilities
            </h2>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              From market segmentation to LLM-grounded analysis, all in one integrated research flow.
            </p>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={i}
                initial={{ y: "100%", opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="relative"
              >
                <div className="flex flex-col gap-6 p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md h-full">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full blur opacity-50" />
                      <div className="relative bg-[#0f1419] p-3 rounded-full">
                        <Icon size={24} className="text-emerald-400" />
                      </div>
                    </div>
                    <span className="text-3xl font-bold text-white/20">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      {step.title}
                    </h3>
                    <p className="text-white/60">{step.desc}</p>
                  </div>
                </div>

                {i < steps.length - 1 && (
                  <div className="absolute -right-3 top-1/2 hidden lg:block">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      className="text-white/20"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" strokeWidth="2" />
                    </svg>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
