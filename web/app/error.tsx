"use client";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F4FAF7] p-8 text-center">
      <p className="text-lg font-semibold text-[#0F2B23]">Something went wrong</p>
      <p className="text-sm text-[#5A736A]">{error.message || "An unexpected error occurred."}</p>
      <button
        onClick={reset}
        className="rounded-lg bg-[#0FA77A] px-4 py-2 text-sm font-medium text-white hover:bg-[#0A8A67]"
      >
        Try again
      </button>
    </div>
  );
}
