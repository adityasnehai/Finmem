"use client";

export default function Footer() {
  return (
    <footer className="bg-[#0a0e14] text-white/60 py-12 border-t border-white/10">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500" />
              <h3 className="text-white font-bold text-lg">FinMem</h3>
            </div>
            <p className="text-sm">Query market history with grounded analog retrieval, cited episodes, and confidence-aware reasoning.</p>
          </div>
          {[
            { title: "Product", links: ["Features", "How it works", "FAQ"] },
            { title: "Research", links: ["Episode search", "Analog retrieval", "Market analysis"] },
            { title: "Company", links: ["About", "Blog", "Contact"] },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="text-white font-semibold mb-4">{col.title}</h4>
              <ul className="space-y-2 text-sm">
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-white/60 hover:text-white transition">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 pt-8 text-center text-sm">
          <p>© {new Date().getFullYear()} FinMem. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
