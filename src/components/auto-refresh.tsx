"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-renders the page from the server while background work (a Claude edit) runs. Pauses
// while the tab is in the background or the page's desktop window is minimized.
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible" && !window.__magikHidden) router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
