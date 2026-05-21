"use client";

import { ChevronDown, PlusIcon } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

const faqs = [
  { q: "What is FinMem doing?", a: "FinMem segments market history into episodes, embeds those episodes with macro structure plus summaries, retrieves the closest analogs to current conditions, and answers only from those retrieved episodes." },
  { q: "Why is this better than generic models?", a: "Generic models can produce plausible language without clear sourcing. FinMem is retrieval-first, so answers are grounded in specific episodes with visible similarity and macro context." },
  { q: "What happens with novel markets?", a: "FinMem uses a confidence threshold. If top analogs are too weak, it explicitly says there is no confident historical analog rather than forcing an answer." },
  { q: "Can I export research and data?", a: "Yes, FinMem supports exporting episodes, precursor analysis, and regime transitions as reports. All data is downloadable for further analysis." },
  { q: "What is your data freshness?", a: "Market data is updated daily. Episodes are recalculated when regime changes occur, and precursor indicators are refreshed continuously." },
  { q: "Is data available historically?", a: "FinMem covers 35+ years of market history across equities, rates, volatility, and macro indicators. All data is sourced from authoritative financial providers." },
];

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 md:py-32">
      <div className="container mx-auto max-w-3xl px-4">
        <div className="text-center mb-16">
          <motion.div
            initial={{ y: "-100%", opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-emerald-400 font-medium mb-4">FAQ</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Frequently asked questions
            </h2>
            <p className="text-lg text-white/60">
              Find answers to common questions about FinMem
            </p>
          </motion.div>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ y: "100%", opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: i * 0.05 }}
              className="border border-white/10 rounded-lg overflow-hidden bg-white/5 hover:border-emerald-500/30 transition"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full p-6 text-left font-semibold text-white hover:bg-white/10 flex justify-between items-center transition"
              >
                {faq.q}
                <PlusIcon
                  size={20}
                  className={`transition-transform duration-200 ${open === i ? "rotate-45" : ""}`}
                />
              </button>
              {open === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="p-6 bg-white/5 text-white/70 border-t border-white/10"
                >
                  {faq.a}
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
