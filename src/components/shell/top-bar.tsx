"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Bell, CheckCheck, CircleHelp, LayoutGrid, LogOut, Search, Settings } from "lucide-react";
import { appById } from "@/lib/apps";
import { Avatar, cx } from "@/components/ui";
import { useNow } from "@/components/use-now";
import { useDesktop } from "@/components/desktop/context";
import type { Win } from "@/components/desktop/windows";
import { markRead, notificationFeed, type FeedItem } from "@/app/actions/desktop";
import { Ago } from "@/components/home/time";

// The menu bar: the Magik mark and the focused app on the left; search, Mission Control, help,
// notifications, the clock and the person's menu on the right.
export function TopBar({ current }: { current: Win | null }) {
  const d = useDesktop();
  const app = current?.appId ? appById(current.appId) : null;
  return (
    <header className="topbar fixed inset-x-0 top-0 z-[9000] flex h-[46px] items-center gap-2 px-3 text-white select-none sm:gap-3 sm:px-5">
      <button type="button" onClick={d.showDesktop} className="flex shrink-0 items-center gap-2.5 rounded-lg px-1 py-1" aria-label="Magik OS: show the desktop">
        <Image src="/brand/magik-monogram.svg" alt="" width={30} height={21} unoptimized priority className="h-[19px] w-auto" />
        <span className="hidden font-display text-[13px] font-semibold tracking-[0.38em] sm:inline">
          MAGIK <span className="text-accent">OS</span>
        </span>
      </button>
      <span className="hidden min-w-0 items-center gap-3 md:flex">
        <span aria-hidden className="h-4 w-px bg-white/20" />
        <span className="truncate text-[13px] font-semibold text-white/90">{app?.name ?? (current ? current.title : "Desktop")}</span>
      </span>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
        <button
          type="button"
          onClick={d.openSpotlight}
          className="search-pill hidden h-[30px] w-[220px] items-center gap-2 rounded-full px-3 text-[13px] text-white/60 transition-colors hover:text-white/85 md:flex lg:w-[260px]"
        >
          <Search size={14} aria-hidden />
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded-md bg-white/10 px-1.5 py-px font-sans text-[11px] text-white/60">⌘K</kbd>
        </button>
        <BarButton label="Search" onClick={d.openSpotlight} className="md:hidden">
          <Search size={17} aria-hidden />
        </BarButton>
        <BarButton label="Mission Control: every open window" onClick={() => d.setMission(!d.mission)} className="hidden sm:flex" active={d.mission}>
          <LayoutGrid size={16} aria-hidden />
        </BarButton>
        <BarButton label="Help" onClick={() => d.open("/help")}>
          <CircleHelp size={17} aria-hidden />
        </BarButton>
        <NotificationCenter />
        <Clock />
        <PersonMenu name={d.viewer.name} detail={`${d.viewer.email} · ${d.viewer.roleLabel}`} />
      </div>
    </header>
  );
}

function BarButton({ label, onClick, className, active, children }: { label: string; onClick: () => void; className?: string; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cx("flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10", active && "bg-white/15", className)}
    >
      {children}
    </button>
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

// Closes a menu when the pointer goes down outside it, or on Escape.
function useDismiss(open: boolean, close: () => void) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return root;
}

// The notification center: drops down from the bell, newest first.
function NotificationCenter() {
  const d = useDesktop();
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const [pending, startTransition] = useTransition();
  const root = useDismiss(open, () => setOpen(false));

  const load = () =>
    startTransition(async () => {
      const r = await notificationFeed();
      setFeed(r.items);
      d.setUnread(r.unread);
    });

  const choose = (item: FeedItem) => {
    setOpen(false);
    if (item.unread) {
      setFeed((f) => f?.map((x) => (x.id === item.id ? { ...x, unread: false } : x)) ?? f);
      markRead(item.id).then(d.setUnread).catch(() => {});
    }
    if (item.href) d.open(item.href);
  };

  const today = new Date().toDateString();
  const groups: { label: string; items: FeedItem[] }[] = [];
  for (const item of feed ?? []) {
    const label = new Date(item.at).toDateString() === today ? "Today" : "Earlier";
    const g = groups.find((x) => x.label === label);
    if (g) g.items.push(item);
    else groups.push({ label, items: [item] });
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={d.unread ? `Notifications, ${d.unread} unread` : "Notifications"}
        title="Notifications"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        className={cx("relative flex h-8 w-8 items-center justify-center rounded-full transition-colors", open ? "bg-white/15" : "hover:bg-white/10")}
      >
        <Bell size={17} aria-hidden />
        {d.unread > 0 && (
          <span className="absolute top-0.5 right-0 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[10.5px] font-semibold">
            {d.unread > 99 ? "99+" : d.unread}
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications" className="glass-pop animate-pop-in absolute top-[42px] right-[-60px] flex max-h-[min(640px,calc(100dvh-80px))] w-[min(400px,calc(100vw-24px))] flex-col overflow-hidden rounded-[20px] text-ink sm:right-0">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <h2 className="flex-1 text-[15px] font-semibold">Notifications</h2>
            {d.unread > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFeed((f) => f?.map((x) => ({ ...x, unread: false })) ?? f);
                  markRead().then(d.setUnread).catch(() => {});
                }}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-medium text-accent hover:bg-white/10"
              >
                <CheckCheck size={14} aria-hidden /> Mark all read
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {feed === null ? (
              <div className="flex flex-col gap-2 p-2" aria-busy={pending}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-12 rounded-[12px]" />
                ))}
              </div>
            ) : feed.length === 0 ? (
              <p className="px-3 py-8 text-center text-[13.5px] text-muted">You&apos;re all caught up.</p>
            ) : (
              groups.map((g) => (
                <section key={g.label} className="mb-1">
                  <p className="px-2.5 pt-1.5 pb-1 text-[11.5px] font-semibold tracking-wide text-muted uppercase">{g.label}</p>
                  <ul>
                    {g.items.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => choose(n)}
                          className="flex w-full gap-2.5 rounded-[12px] px-2.5 py-2 text-left hover:bg-white/[0.07]"
                        >
                          <span className={cx("mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full", n.unread ? "bg-accent" : "bg-transparent")} />
                          <span className="min-w-0 flex-1">
                            <span className={cx("block text-[13.5px] leading-snug", n.unread ? "font-semibold text-ink" : "text-ink-2")}>{n.title}</span>
                            {n.body && <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-muted">{n.body}</span>}
                          </span>
                          <span className="shrink-0 pt-0.5 text-[11.5px] text-muted">
                            <Ago at={n.at} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
          <div className="border-t border-white/10 p-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                d.open("/notifications");
              }}
              className="w-full rounded-[12px] py-2 text-center text-[13px] font-medium text-ink-2 hover:bg-white/[0.07]"
            >
              See all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PersonMenu({ name, detail }: { name: string; detail: string }) {
  const d = useDesktop();
  const [open, setOpen] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const root = useDismiss(open, () => setOpen(false));

  const go = (href: string) => {
    setOpen(false);
    d.open(href);
  };

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
          <button type="button" role="menuitem" onClick={() => go("/account")} className="flex h-8 w-full items-center gap-2.5 rounded-[9px] px-2.5 text-left hover:bg-white/10">
            <Settings size={15} aria-hidden /> Settings
          </button>
          <button type="button" role="menuitem" onClick={() => go("/help")} className="flex h-8 w-full items-center gap-2.5 rounded-[9px] px-2.5 text-left hover:bg-white/10">
            <CircleHelp size={15} aria-hidden /> Help
          </button>
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
