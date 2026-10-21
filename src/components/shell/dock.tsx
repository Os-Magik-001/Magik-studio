"use client";

import Link from "next/link";
import { HOME } from "@/lib/apps";
import { cx } from "@/components/ui";
import { AppIcon } from "@/components/shell/app-icon";
import { useShell } from "@/components/shell/context";

// The Dock: Home, then the role's apps, big, with their names. One click opens the app's
// screen; the app on screen is lit in gold.
export function Dock({ active }: { active: string | null }) {
  const { apps, unread } = useShell();
  const items = [HOME, ...apps];
  return (
    <nav aria-label="Dock" className="dock-wrap pointer-events-none fixed inset-x-0 bottom-2.5 z-40 flex justify-center px-2 sm:bottom-3">
      <ul className="dock pointer-events-auto flex max-w-full items-end overflow-x-auto overflow-y-visible rounded-[28px] px-2 pt-2.5 pb-1.5 sm:rounded-[32px] sm:px-3 sm:pt-3">
        {items.map((app) => {
          const on = app.id === active;
          const badge = app.id === "notifications" ? unread : 0;
          return (
            <li key={app.id} className="shrink-0">
              <Link
                href={app.href}
                prefetch
                aria-current={on ? "page" : undefined}
                aria-label={badge ? `${app.name}, ${badge} new` : app.name}
                className="dock-item group relative flex w-[64px] flex-col items-center gap-1 rounded-[18px] pb-1 focus-visible:outline-offset-0 sm:w-[82px] sm:gap-1.5"
              >
                <span className="dock-icon relative block h-[46px] w-[46px] sm:h-[62px] sm:w-[62px]">
                  <AppIcon icon={app.icon} tint={app.tint} glyph={app.glyph} size="fill" />
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[11px] font-semibold text-white shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </span>
                <span className={cx("max-w-full truncate px-0.5 text-[10.5px] font-medium sm:text-[11.5px]", on ? "text-accent" : "text-white/80")}>
                  {app.name}
                </span>
                <span
                  aria-hidden
                  className={cx("absolute -bottom-1 h-[4px] w-[4px] rounded-full bg-accent shadow-[0_0_8px_2px_rgba(246,212,58,0.55)] transition-opacity", on ? "opacity-100" : "opacity-0")}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
