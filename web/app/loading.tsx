export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4FAF7]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#D7E8E0] border-t-[#0FA77A]" />
        <p className="text-xs text-[#7A938A]">Loading…</p>
      </div>
    </div>
  );
}
