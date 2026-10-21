"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 items-center gap-2 rounded-full bg-[#1d1d1f] px-4 text-[13px] font-medium text-white hover:bg-black"
    >
      <Printer size={15} aria-hidden /> {label}
    </button>
  );
}
