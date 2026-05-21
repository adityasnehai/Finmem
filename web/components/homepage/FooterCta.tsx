"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function FooterCta() {
  return (
    <section className="py-20 md:py-32 border-t border-white/10">
      <div className="container mx-auto max-w-3xl px-4 text-center">
        <motion.div
          initial={{ y: "-100%", opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col gap-8"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Ready to reason from market history?
          </h2>
          <p className="text-xl text-white/60">
            Start exploring historical market episodes with grounded analog retrieval.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold hover:opacity-90 transition w-fit mx-auto"
          >
            Try Free <ArrowRight size={16} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
