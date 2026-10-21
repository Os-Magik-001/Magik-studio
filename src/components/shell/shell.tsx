"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HOME, appForPath, type AppDef } from "@/lib/apps";
import { useStoredValue } from "@/components/use-now";
import { ShellContext, type Role, type ShellViewer } from "@/components/shell/context";
import { TopBar } from "@/components/shell/top-bar";
import { Dock } from "@/components/shell/dock";
import { Spotlight, type QuickAction } from "@/components/shell/spotlight";
import { unreadCount } from "@/app/actions/desktop";

const QUICK_ACTIONS: Partial<Record<Role, QuickAction[]>> = {
  admin: [
    { label: "New client", hint: "Start an onboarding: details, pack, invoice, contract, link", href: "/onboarding/new" },
    { label: "Add a team member", hint: "Team", href: "/team" },
  ],
  seller: [{ label: "New client", hint: "Start an onboarding: details, pack, invoice, contract, link", href: "/onboarding/new" }],
  client: [{ label: "Videos waiting for me", hint: "Your videos", href: "/review" }],
};

// Magik OS around every app: the menu bar, the Dock and Spotlight. Lives in the (app) layout,
// so it stays put while apps change underneath it.
export function Shell({ viewer, apps, unread: serverUnread, children }: { viewer: ShellViewer; apps: AppDef[]; unread: number; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = appForPath(pathname, viewer.role);
  const [spotlight, setSpotlight] = useState(false);

  // The server's count wins whenever the page is refreshed; polling keeps it fresh in between.
  const [unread, setUnread] = useState(serverUnread);
  const [fromServer, setFromServer] = useState(serverUnread);
  if (serverUnread !== fromServer) {
    setFromServer(serverUnread);
    setUnread(serverUnread);
  }

  const full = useStoredValue("magik.full", "0", "magik:full") === "1";
  const setFull = (on: boolean) => {
    try {
      localStorage.setItem("magik.full", on ? "1" : "0");
    } catch {}
    window.dispatchEvent(new Event("magik:full"));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSpotlight((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") unreadCount().then(setUnread).catch(() => {});
    }, 45_000);
    return () => clearInterval(id);
  }, []);

  return (
    <ShellContext value={{ viewer, apps, unread, full, setFull, openSpotlight: () => setSpotlight(true) }}>
      <TopBar current={current} />
      {children}
      <Dock active={current?.id ?? null} />
      {spotlight && (
        <Spotlight
          apps={[HOME, ...apps]}
          actions={QUICK_ACTIONS[viewer.role] ?? []}
          onOpenApp={(app) => router.push(app.href)}
          onOpenHref={(href) => router.push(href)}
          onClose={() => setSpotlight(false)}
        />
      )}
    </ShellContext>
  );
}
