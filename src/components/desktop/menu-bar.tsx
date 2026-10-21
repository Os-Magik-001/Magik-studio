"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { Bell, Check, Search } from "lucide-react";
import { Avatar, cx } from "@/components/ui";
import { useNow } from "@/components/use-now";

export type MenuItem =
  | { separator: true }
  | { label: string; onSelect: () => void; shortcut?: string; disabled?: boolean; checked?: boolean };

export type MenuDef = { id: string; label: ReactNode; ariaLabel?: string; items: MenuItem[]; bold?: boolean };

// macOS menu bar: menus open on click, and while one is open, moving across titles switches.
export function MenuBar({
  menus,
  right,
}: {
  menus: MenuDef[];
  right: { unread: number; onSpotlight: () => void; onNotifications: () => void; account: MenuDef; name: string };
}) {
  const [open, setOpen] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    const onBlur = () => setOpen(null);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onBlur);
    };
  }, [open]);

  const title = (m: MenuDef, className?: string) => (
    <div key={m.id} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open === m.id}
        aria-label={m.ariaLabel}
        onClick={() => setOpen(open === m.id ? null : m.id)}
        onPointerEnter={() => open && open !== m.id && setOpen(m.id)}
        className={cx(
          "flex h-[26px] items-center rounded-md px-2.5 text-[13px] whitespace-nowrap transition-colors",
          m.bold ? "font-bold" : "font-medium",
          open === m.id ? "bg-white/20" : "hover:bg-white/10",
          className,
        )}
      >
        {m.label}
      </button>
      {open === m.id && <MenuList items={m.items} onDone={() => setOpen(null)} align={m.id === "account" ? "right" : "left"} />}
    </div>
  );

  return (
    <header
      ref={root}
      className="on-wallpaper fixed inset-x-0 top-0 z-[9500] flex h-[34px] items-center justify-between bg-black/25 px-2 text-white backdrop-blur-2xl backdrop-saturate-150"
    >
      <div className="flex min-w-0 items-center gap-0.5">{menus.map((m) => title(m))}</div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          aria-label="Search (⌘K)"
          title="Search  ⌘K"
          onClick={right.onSpotlight}
          className="flex h-[26px] w-8 items-center justify-center rounded-md hover:bg-white/10"
        >
          <Search size={15} strokeWidth={2.2} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={right.unread ? `Notifications, ${right.unread} unread` : "Notifications"}
          onClick={right.onNotifications}
          className="relative flex h-[26px] w-8 items-center justify-center rounded-md hover:bg-white/10"
        >
          <Bell size={15} strokeWidth={2.2} aria-hidden />
          {right.unread > 0 && (
            <span className="absolute top-[3px] right-[5px] h-[7px] w-[7px] rounded-full bg-accent shadow-[0_0_0_1.5px_rgba(0,0,0,0.5)]" />
          )}
        </button>
        <Clock />
        {title(
          {
            ...right.account,
            label: (
              <span className="flex items-center gap-1.5">
                <Avatar name={right.name} size={20} />
                <span className="hidden sm:inline">{right.name}</span>
              </span>
            ),
          },
          "pl-1.5",
        )}
      </div>
    </header>
  );
}

function MenuList({ items, onDone, align }: { items: MenuItem[]; onDone: () => void; align: "left" | "right" }) {
  return (
    <div
      role="menu"
      className={cx(
        "glass-pop animate-pop-in absolute top-[30px] min-w-[230px] rounded-[12px] p-[5px] text-[13px] text-ink",
        align === "right" ? "right-0" : "left-0",
      )}
    >
      {items.map((item, i) =>
        "separator" in item ? (
          <div key={i} role="separator" className="mx-2.5 my-[5px] h-px bg-white/12" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onDone();
              item.onSelect();
            }}
            className="flex h-[26px] w-full items-center gap-2 rounded-[7px] px-2.5 text-left hover:bg-accent hover:text-black disabled:text-muted disabled:hover:bg-transparent"
          >
            <span className="w-3.5 shrink-0">{item.checked && <Check size={13} strokeWidth={2.6} aria-hidden />}</span>
            <span className="flex-1 truncate">{item.label}</span>
            {item.shortcut && <span className="text-[12px] opacity-60">{item.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}

function Clock() {
  const now = useNow(15_000);
  if (!now) return <span className="w-[150px]" />;
  const date = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return (
    <span className="px-2 text-[13px] font-medium whitespace-nowrap tabular-nums" suppressHydrationWarning>
      <span className="hidden md:inline">{date}&nbsp;&nbsp;</span>
      {time}
    </span>
  );
}

export function MagikMark() {
  return (
    <Image src="/brand/magik-monogram.svg" alt="" width={22} height={15} unoptimized priority className="h-[14px] w-auto" />
  );
}
