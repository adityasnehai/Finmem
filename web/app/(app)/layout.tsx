"use client";
import { useEffect, useState } from "react";
import SidebarLayout from "@/components/SidebarLayout";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f4faf7]">
        <div className="h-7 w-7 rounded-full border-2 border-[#0FA77A]/25 border-t-[#0FA77A] animate-spin" />
      </div>
    );
  }

  return <SidebarLayout>{children}</SidebarLayout>;
}
