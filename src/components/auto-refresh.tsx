"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWindowState } from "@/components/desktop/context";

// Re-renders the page from the server while background work (a Claude edit) runs. Pauses
// while the tab is in the background, and while its window isn't the one in front (the router
// refreshes the focused window's page; this one catches up when it's clicked).
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  const win = useWindowState();
  const active = !win || (win.focused && win.visible);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds, active]);
  return null;
}
