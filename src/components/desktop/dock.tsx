"use client";

import { useRef } from "react";
import type { AppDef } from "@/lib/apps";
import { cx } from "@/components/ui";
import { AppIcon } from "@/components/desktop/app-icon";
import type { Win } from "@/components/desktop/use-windows";

const BASE = 52;
const MAX = 1.42;
const REACH = 130;

// The dock: the role's apps on the left, open documents on the right. Icons swell under the
// pointer, a dot marks running apps, and an icon bounces while its window loads.
export function Dock({
  apps,
  wins,
  badges,
  onOpenApp,
  onShowWindow,
}: {
  apps: AppDef[];
  wins: Win[];
  badges: Record<string, number>;
  onOpenApp: (app: AppDef) => void;
  onShowWindow: (key: string) => void;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const docs = wins.filter((w) => !w.appId).sort((a, b) => a.openedAt - b.openedAt);

  const magnify = (clientX: number | null) => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      bar.current?.querySelectorAll<HTMLElement>("[data-dock-item]").forEach((el) => {
        let scale = 1;
        if (clientX !== null) {
          const r = el.getBoundingClientRect();
          const d = Math.abs(clientX - (r.left + r.width / 2));
          const t = Math.max(0, 1 - d / REACH);
          scale = 1 + (MAX - 1) * t * t * (3 - 2 * t);
        }
        el.style.setProperty("--s", scale.toFixed(3));
      });
    });
  };

  const item = (key: string, label: string, icon: React.ReactNode, running: boolean, loading: boolean, onClick: () => void, badge?: number) => (
    <li key={key} className="group relative flex flex-col items-center">
      <button
        type="button"
        data-dock-item
        data-dock-key={key}
        aria-label={badge ? `${label}, ${badge} new` : label}
        onClick={onClick}
        className="relative flex items-end justify-center transition-[width,height] duration-150 ease-out focus-visible:outline-offset-4 [--s:1]"
        style={{ width: `calc(${BASE}px * var(--s))`, height: `calc(${BASE}px * var(--s))` }}
      >
        <span className={cx("block h-full w-full", loading && "animate-bounce-dock [animation-iteration-count:infinite]")}>
          {icon}
        </span>
        {!!badge && (
          <span className="absolute -top-1 -right-1 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[11px] font-semibold text-white shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
      <span
        aria-hidden
        className={cx("mt-[3px] h-[4px] w-[4px] rounded-full bg-white/85 transition-opacity", running ? "opacity-100" : "opacity-0")}
      />
      <span
        role="tooltip"
        className="glass-pop pointer-events-none absolute bottom-[calc(100%+14px)] left-1/2 z-10 -translate-x-1/2 rounded-lg px-2.5 py-1 text-[12.5px] whitespace-nowrap text-ink opacity-0 transition-opacity group-hover:opacity-100"
      >
        {label}
      </span>
    </li>
  );

  return (
    <nav aria-label="Dock" className="pointer-events-none fixed inset-x-0 bottom-2 z-[9000] flex justify-center">
      <div
        ref={bar}
        onPointerMove={(e) => e.pointerType === "mouse" && magnify(e.clientX)}
        onPointerLeave={() => magnify(null)}
        className="glass-bar pointer-events-auto flex items-end rounded-[26px] px-2 pt-2 pb-1"
      >
        <ul className="flex items-end gap-[7px]">
          {apps.map((app) => {
            const win = wins.find((w) => w.key === app.id);
            return item(
              app.id,
              app.name,
              <AppIcon icon={app.icon} tint={app.tint} glyph={app.glyph} size="fill" />,
              !!win,
              !!win && !win.ready && !win.minimized,
              () => onOpenApp(app),
              badges[app.id],
            );
          })}
        </ul>
        {docs.length > 0 && (
          <>
            <span aria-hidden className="mx-2.5 mb-3 h-11 w-px self-end bg-white/20" />
            <ul className="flex items-end gap-[7px]">
              {docs.map((w) =>
                item(
                  w.key,
                  w.title.replace(/\s*·\s*Magik OS$/, "") || w.name,
                  <AppIcon icon={w.icon} tint={w.tint} glyph={w.glyph} size="fill" />,
                  true,
                  !w.ready && !w.minimized,
                  () => onShowWindow(w.key),
                ),
              )}
            </ul>
          </>
        )}
      </div>
    </nav>
  );
}
