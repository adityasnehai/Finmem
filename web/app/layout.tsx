import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const bodyFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

const headingFont = Sora({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-heading",
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "FinMem — Financial Episodic Memory",
  description:
    "RAG-powered reasoning over 32 years of market history. Retrieves the most similar historical episodes and grounds answers in real data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`h-full ${bodyFont.variable} ${headingFont.variable} ${monoFont.variable}`}
    >
      <body className="h-full bg-[#f4faf7] text-[#102e25] antialiased">
        {children}
      </body>
    </html>
  );
}
