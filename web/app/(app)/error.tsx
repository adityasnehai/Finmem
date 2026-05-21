"use client";
import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FEF2F2]">
        <AlertCircle size={22} className="text-[#E22134]" />
      </div>
      <div>
        <p className="font-semibold text-[#0F2B23]">Failed to load</p>
        <p className="mt-1 text-sm text-[#5A736A]">{error.message || "An unexpected error occurred."}</p>
      </div>
      <button
        onClick={reset}
        className="rounded-lg border border-[#D7E8E0] bg-white px-4 py-2 text-sm font-medium text-[#0F2B23] hover:bg-[#F2FAF6]"
      >
        Try again
      </button>
    </div>
  );
}
