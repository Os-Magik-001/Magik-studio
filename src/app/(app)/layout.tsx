import { Suspense } from "react";
import { Sidebar, SidebarSkeleton } from "@/components/sidebar";

// Every page here is per-user and checked against the session at request time.
export const instant = false;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Suspense fallback={<SidebarSkeleton />}>
        <Sidebar />
      </Suspense>
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
