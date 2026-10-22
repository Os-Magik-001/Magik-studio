import Link from "next/link";
import { SetupFrame } from "@/components/setup/setup-frame";

// An address that isn't part of Magik OS.
export default function NotFound() {
  return (
    <SetupFrame>
      <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
        <h1 className="font-display text-[30px] font-bold tracking-tight text-ink">This page doesn&apos;t exist.</h1>
        <p className="mt-3 max-w-md text-[14.5px] text-ink-2">The link may be old, or mistyped.</p>
        <Link href="/" className="glass-tint mt-7 inline-flex h-10 items-center rounded-full px-6 text-[14px] font-semibold">
          Back to Magik OS
        </Link>
      </div>
    </SetupFrame>
  );
}
