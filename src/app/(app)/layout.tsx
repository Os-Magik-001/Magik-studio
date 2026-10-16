import { Suspense } from "react";
import { Backdrop } from "@/components/backdrop";
import { Sidebar, SidebarSkeleton } from "@/components/sidebar";

// Every page here is per-user and checked against the session at request time.
export const instant = false;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate min-h-dvh">
      <Backdrop />
      {/* Soft scroll-edge effect under the floating phone bar. */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-20 h-28 bg-gradient-to-b from-black/85 via-black/50 to-transparent md:hidden" />
      <Suspense fallback={<SidebarSkeleton />}>
        <Sidebar />
      </Suspense>
      <main className="min-w-0 md:pl-[18.25rem]">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10">{children}</div>
      </main>
    </div>
  );
}
