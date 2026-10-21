import { Suspense } from "react";
import { EmbedBridge } from "@/components/desktop/embed-bridge";

// Every page here is per-user and checked against the session at request time.
export const instant = false;

// The pages here are apps: each one runs inside a window on the desktop (src/app/page.tsx),
// which draws the window, the menu bar and the dock. This layout is only the window's content.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <EmbedBridge />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl px-5 pt-6 pb-12 sm:px-8">{children}</main>
    </>
  );
}
