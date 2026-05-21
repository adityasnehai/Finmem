"use client";

import { Search, Zap, GitCompare, BarChart3 } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const features = [
  {
    icon: Search,
    title: "Historical Analog Retrieval",
    desc: "Find the closest prior market episodes to the current regime instead of relying on broad narrative matching.",
  },
  {
    icon: Zap,
    title: "Grounded Answers",
    desc: "Every answer cites episodes, similarity scores, and market outcomes for auditable reasoning.",
  },
  {
    icon: GitCompare,
    title: "Regime-Aware Comparisons",
    desc: "Compare current state against tightening, crisis, recovery, and slowdown episodes.",
  },
  {
    icon: BarChart3,
    title: "Research Dashboard",
    desc: "Move from market state to episode search to streaming analysis in one workflow.",
  },
];

export default function FeatureCards() {
  const ref = useRef(null);
  const inView = useInView(ref);

  const bottomAnimation = {
    initial: { y: "100%", opacity: 0 },
    animate: inView ? { y: 0, opacity: 1 } : { y: "100%", opacity: 0 },
    transition: { duration: 0.6, delay: 0.2 },
  };

  return (
    <section id="features" className="py-20 md:py-32">
      <div className="container mx-auto max-w-7xl px-4">
        <motion.div
          ref={ref}
          {...bottomAnimation}
          className="text-center mb-16"
        >
          <p className="text-emerald-400 font-medium mb-4">WHY CHOOSE FINMEM</p>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Everything needed to reason from market history
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Start with live market structure, move into historical analogs, and end with grounded reasoning in a single research flow.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={i}
                initial={{ y: "100%", opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md hover:border-emerald-500/50 hover:bg-emerald-500/5 transition group"
              >
                <div className="p-3 bg-emerald-500/20 rounded-full w-fit group-hover:bg-cyan-500/20 transition">
                  <Icon size={24} className="text-emerald-400 group-hover:text-cyan-400 transition" />
                </div>
                <h3 className="text-lg font-semibold text-white mt-4 mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-white/60">{f.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
