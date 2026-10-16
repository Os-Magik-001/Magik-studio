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
    <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:flex-col md:overflow-visible md:pb-0">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
              active ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:bg-surface-2",
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
