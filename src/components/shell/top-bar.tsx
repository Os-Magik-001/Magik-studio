"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bell, LogOut, Search, Settings } from "lucide-react";
import type { AppDef } from "@/lib/apps";
import { Avatar, cx } from "@/components/ui";
import { useNow } from "@/components/use-now";
import { useShell } from "@/components/shell/context";

// The menu bar: the Magik mark, the app on screen, search in the middle, then notifications,
// the date and time, and the person's menu.
export function TopBar({ current }: { current: AppDef | null }) {
  const { viewer, unread, openSpotlight } = useShell();
  return (
    <header className="topbar fixed inset-x-0 top-0 z-50 flex h-[46px] items-center gap-3 px-3 text-white sm:px-5">
      <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-lg px-1 py-1" aria-label="Magik OS, home">
        <Image src="/brand/magik-monogram.svg" alt="" width={30} height={21} unoptimized priority className="h-[19px] w-auto" />
        <span className="hidden font-display text-[13px] font-semibold tracking-[0.38em] sm:inline">
          MAGIK <span className="text-accent">OS</span>
        </span>
      </Link>
      {current && current.id !== "home" && (
        <span className="hidden min-w-0 items-center gap-3 md:flex">
          <span aria-hidden className="h-4 w-px bg-white/20" />
          <span className="truncate text-[13px] font-semibold text-white/90">{current.name}</span>
        </span>
      )}

      <button
        type="button"
        onClick={openSpotlight}
        className="search-pill absolute left-1/2 hidden h-[30px] w-[min(360px,34vw)] -translate-x-1/2 items-center gap-2.5 rounded-full px-3.5 text-[13px] text-white/60 transition-colors hover:text-white/85 md:flex"
      >
        <Search size={15} aria-hidden />
        <span className="flex-1 text-left">Search anything…</span>
        <kbd className="rounded-md bg-white/10 px-1.5 py-px font-sans text-[11.5px] text-white/60">⌘K</kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={openSpotlight}
          aria-label="Search"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 md:hidden"
        >
          <Search size={17} aria-hidden />
        </button>
        <Link
          href="/notifications"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10"
        >
          <Bell size={17} aria-hidden />
          {unread > 0 && (
            <span className="absolute top-0.5 right-0 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[10.5px] font-semibold">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>
        <Clock />
        <PersonMenu name={viewer.name} detail={`${viewer.email} · ${viewer.roleLabel}`} />
      </div>
    </header>
  );
}

function Clock() {
  const now = useNow(15_000);
  if (!now) return <span className="hidden w-[150px] lg:inline" />;
  return (
    <span className="hidden px-1.5 text-[13px] font-medium whitespace-nowrap text-white/90 tabular-nums lg:inline">
      {now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
      &nbsp;&nbsp;
      {now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
    </span>
  );
}

function PersonMenu({ name, detail }: { name: string; detail: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${name}: account menu`}
        onClick={() => setOpen((o) => !o)}
        className={cx("flex items-center rounded-full p-0.5 transition-colors", open ? "bg-white/15" : "hover:bg-white/10")}
      >
        <Avatar name={name} size={30} />
      </button>
      {open && (
        <div role="menu" className="glass-pop animate-pop-in absolute top-[40px] right-0 w-[250px] rounded-[16px] p-1.5 text-[13px] text-ink">
          <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-2.5">
            <Avatar name={name} size={36} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{name}</p>
              <p className="truncate text-[11.5px] text-muted">{detail}</p>
            </div>
          </div>
          <div className="mx-2 mb-1 h-px bg-white/10" />
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex h-8 items-center gap-2.5 rounded-[9px] px-2.5 hover:bg-white/10"
          >
            <Settings size={15} aria-hidden /> Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              try {
                sessionStorage.clear();
              } catch {}
              form.current?.requestSubmit();
            }}
            className="flex h-8 w-full items-center gap-2.5 rounded-[9px] px-2.5 text-left hover:bg-white/10"
          >
            <LogOut size={15} aria-hidden /> Sign out
          </button>
          <form ref={form} action="/auth/signout" method="post" className="hidden" />
        </div>
      )}
    </div>
  );
}
