"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Bell, CalendarDays, Clapperboard, FolderOpen, KanbanSquare, Users } from "lucide-react";
import { cx } from "@/components/ui";

const ICONS = {
  pipeline: KanbanSquare,
  clients: FolderOpen,
  shoots: CalendarDays,
  team: Users,
  videos: Clapperboard,
  bell: Bell,
};

export type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  badge?: number;
};

export function NavLinks({ items, children }: { items: NavItem[]; children?: ReactNode }) {
  const pathname = usePathname();
  return (
    <nav className="relative flex gap-1 overflow-x-auto px-3 pb-2 md:flex-col md:overflow-visible md:px-4 md:pb-0">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "relative flex h-10 shrink-0 items-center gap-3 rounded-md px-3 text-sm transition-colors",
              active
                ? "bg-accent-soft font-semibold text-accent before:absolute before:top-2 before:bottom-2 before:left-0 before:w-0.5 before:rounded-full before:bg-accent"
                : "text-ink-2 hover:bg-white/5 hover:text-ink",
            )}
          >
            <Icon size={16} strokeWidth={1.75} aria-hidden />
            <span>{item.label}</span>
            {!!item.badge && (
              <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-ink">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
      {children}
    </nav>
  );
}
