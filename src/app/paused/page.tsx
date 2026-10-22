import type { Metadata } from "next";
import { PauseCircle } from "lucide-react";
import { SetupFrame } from "@/components/setup/setup-frame";
import { Button } from "@/components/ui";

export const metadata: Metadata = { title: "Account paused" };

// Where a paused account lands: nothing to use until a studio manager resumes it.
export default function PausedPage() {
  return (
    <SetupFrame>
      <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
        <span className="app-icon h-20 w-20" style={{ background: "linear-gradient(180deg,#a1a1aa,#52525b)" }}>
          <PauseCircle size={40} strokeWidth={2} aria-hidden />
        </span>
        <h1 className="mt-8 font-display text-[32px] leading-tight font-bold tracking-tight text-ink">This account is paused.</h1>
        <p className="mt-3 max-w-lg text-[15px] text-ink-2">Your studio manager has paused it for now. Ask them to resume it, then sign in again.</p>
        <form action="/auth/signout" method="post" className="mt-9">
          <Button variant="secondary">Sign out</Button>
        </form>
      </div>
    </SetupFrame>
  );
}
