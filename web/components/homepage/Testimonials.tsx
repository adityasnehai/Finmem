"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";

export default function Testimonials() {
  const testimonials = [
    { quote: "FinMem changes the first question from 'what do we think?' to 'what did markets like this do before?'", name: "Avery Cole", role: "Macro PM", company: "Northbridge Capital" },
    { quote: "The value is not just the answer. It is seeing the cited episodes, the similarity logic, and where the analog breaks.", name: "Nina Rao", role: "Head of Research", company: "Banyan Markets" },
    { quote: "FinMem gives us precedent. Those are not the same thing when capital and risk budgets are involved.", name: "Marcus Lee", role: "Risk Director", company: "Helios Advisors" },
  ];

  return (
    <section className="py-20 md:py-32">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="text-center mb-16">
          <motion.div
            initial={{ y: "-100%", opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-emerald-400 font-medium mb-4">TESTIMONIALS</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Trusted by market professionals
            </h2>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ y: "100%", opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md hover:border-emerald-500/30 transition"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} size={16} className="text-emerald-400 fill-emerald-400" />
                ))}
              </div>
              <p className="text-white/80 mb-6 italic">"{t.quote}"</p>
              <div>
                <p className="font-semibold text-white">{t.name}</p>
                <p className="text-sm text-white/60">{t.role} at {t.company}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
