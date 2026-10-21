"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { windowFor } from "@/lib/apps";
import type { Database } from "@/lib/database.types";

type Role = Database["public"]["Enums"]["user_role"];

// Runs inside every desktop window (a same-origin iframe). It tells the desktop where the
// window is and what it's called, raises the window when it's clicked, opens links that
// belong to another app in that app's window, and takes orders back from the desktop.

function post(type: string, data: Record<string, unknown> = {}) {
  if (window.parent !== window) window.parent.postMessage({ ...data, type: `magik:${type}` }, location.origin);
}

declare global {
  interface Window {
    // Set while the window is minimized or hidden, so background polling can pause.
    __magikHidden?: boolean;
  }
}

export function EmbedBridge() {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();

  // Opened on its own instead of in a window: open the desktop with this page in a window.
  useEffect(() => {
    if (window.top === window.self) {
      location.replace(`/?open=${encodeURIComponent(location.pathname + location.search)}`);
    }
  }, []);

  useEffect(() => {
    post("nav", { href: location.pathname + location.search + location.hash, title: document.title });
  }, [pathname, search]);

  useEffect(() => {
    const frame = window.frameElement as HTMLIFrameElement | null;
    const myKey = frame?.dataset.key;
    const role = frame?.dataset.role as Role | undefined;

    const onPointerDown = () => post("focus");

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        post("spotlight");
      }
    };

    // Capture phase, before Next's <Link> sees the click.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download") || !myKey || !role) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      const target = windowFor(url.pathname, role);
      if (!target || target.key === myKey) return;
      e.preventDefault();
      e.stopPropagation();
      post("open", { href: url.pathname + url.search + url.hash });
    };

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== window.parent) return;
      const m = e.data as { type?: string; href?: unknown; hidden?: unknown };
      if (m?.type === "magik:navigate" && typeof m.href === "string" && m.href.startsWith("/")) router.push(m.href);
      else if (m?.type === "magik:refresh") router.refresh();
      else if (m?.type === "magik:hidden") window.__magikHidden = !!m.hidden;
    };

    // Keep the window's title in step with the page's.
    let lastTitle = document.title;
    const titles = new MutationObserver(() => {
      if (document.title !== lastTitle) {
        lastTitle = document.title;
        post("title", { title: lastTitle });
      }
    });
    titles.observe(document.head, { subtree: true, childList: true, characterData: true });

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("message", onMessage);
    post("ready", { href: location.pathname + location.search + location.hash, title: document.title });
    return () => {
      titles.disconnect();
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("message", onMessage);
    };
  }, [router]);

  return null;
}
