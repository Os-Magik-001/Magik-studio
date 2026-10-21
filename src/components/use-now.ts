"use client";

import { useSyncExternalStore } from "react";

// The current time, ticking every `stepMs`; null while server-rendering and hydrating, so
// clocks show the viewer's own time without a hydration mismatch.
export function useNow(stepMs: number): Date | null {
  const tick = useSyncExternalStore(
    (onChange) => {
      const id = setInterval(onChange, Math.min(stepMs, 1000));
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / stepMs),
    () => null,
  );
  return tick === null ? null : new Date();
}

// A value kept in localStorage, read without a hydration mismatch; `event` is the window event
// fired when this tab changes it.
export function useStoredValue(key: string, fallback: string, event: string): string | null {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      window.addEventListener(event, onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(event, onChange);
      };
    },
    () => {
      try {
        return localStorage.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    },
    () => null,
  );
}
