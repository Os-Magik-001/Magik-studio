"use client";

import { useSyncExternalStore, type ReactNode } from "react";

// What each page looks like, by address. The router renders one page at a time; every page
// hands its content to this store (<WindowPage>), and each window shows the content of its own
// address, so many windows stay open and alive side by side. Browser-only: on the server the
// store stays empty.

const contents = new Map<string, ReactNode>();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export function setContent(path: string, node: ReactNode) {
  if (contents.has(path) && contents.get(path) === node) return;
  contents.set(path, node);
  emit();
}

// Forget the pages no window shows any more.
export function keepContent(paths: Set<string>) {
  let changed = false;
  for (const path of contents.keys()) {
    if (!paths.has(path)) {
      contents.delete(path);
      changed = true;
    }
  }
  if (changed) emit();
}

export const hasContent = (path: string) => contents.has(path);

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// The content for an address, or undefined while it hasn't arrived.
export function useContent(path: string | null): ReactNode | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (path ? contents.get(path) : undefined),
    () => undefined,
  );
}

// Whether an address has content yet (null in the server render).
export function useHasContent(path: string | null): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (path ? contents.has(path) : false),
    () => false,
  );
}
