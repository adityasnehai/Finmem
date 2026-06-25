import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinMem — Financial Episodic Memory",
  description:
    "RAG-powered reasoning over 32 years of market history. Retrieves the most similar historical episodes and grounds answers in real data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-[#f4faf7] text-[#102e25] antialiased">
        {children}
      </body>
    </html>
  );
}
