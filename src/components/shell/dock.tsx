"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import { useRouter } from "next/navigation";
import { HOME, appById, type AppDef } from "@/lib/apps";
import { cx } from "@/components/ui";
import { AppIcon } from "@/components/shell/app-icon";
import { useDesktop } from "@/components/desktop/context";
import type { Win } from "@/components/desktop/windows";

// The Dock: Home, then the role's apps, big, with their names; a dot under each app with open
// windows, the focused one lit in gold. Minimized windows wait on the right. A right-click on
// an app lists its windows.
export function Dock({ ref }: { ref?: Ref<HTMLElement> }) {
  const d = useDesktop();
  const router = useRouter();
  const items = [HOME, ...d.apps.filter((a) => a.dock !== false)];
  const focusedApp = d.wins.find((w) => w.id === d.focused)?.appId ?? (d.focused === null ? "home" : null);
  const minimized = d.wins.filter((w) => w.minimized).slice(-6);
  const [menu, setMenu] = useState<{ app: AppDef; x: number } | null>(null);

  const openApp = (app: AppDef) => {
    if (app.id === "home") return d.showDesktop();
    const wins = d.wins.filter((w) => w.appId === app.id).sort((a, b) => b.z - a.z);
    // The app in front, with several windows: show them all (App Exposé).
    if (focusedApp === app.id && wins.filter((w) => !w.minimized).length > 1) return d.setMission(true, app.id);
    const main = wins.find((w) => !w.doc);
    if (main) d.focus(main.id);
    else d.open(app.href);
  };

  return (
    <nav ref={ref} aria-label="Dock" className="dock-wrap pointer-events-none fixed inset-x-0 bottom-2.5 z-[8900] flex justify-center px-2 select-none sm:bottom-3">
      <ul className="dock pointer-events-auto flex max-w-full items-end overflow-x-auto overflow-y-visible rounded-[28px] px-2 pt-2.5 pb-1.5 sm:rounded-[32px] sm:px-3 sm:pt-3">
        {items.map((app) => {
          const running = app.id !== "home" && d.wins.some((w) => w.appId === app.id);
          const on = app.id === focusedApp;
          return (
            <li key={app.id} className="shrink-0">
              <button
                type="button"
                ref={(el) => d.registerDockIcon(app.id, el)}
                onClick={() => openApp(app)}
                onPointerEnter={() => app.id !== "home" && router.prefetch(app.href)}
                onContextMenu={(e) => {
                  if (app.id === "home") return;
                  e.preventDefault();
                  const r = e.currentTarget.getBoundingClientRect();
                  setMenu({ app, x: r.left + r.width / 2 });
                }}
                aria-label={app.id === "home" ? "Home: show the desktop" : running ? `${app.name}, open` : app.name}
                aria-current={on ? "page" : undefined}
                className="dock-item group relative flex w-[64px] flex-col items-center gap-1 rounded-[18px] pb-1 focus-visible:outline-offset-0 sm:w-[82px] sm:gap-1.5"
              >
                <span className="dock-icon relative block h-[46px] w-[46px] sm:h-[62px] sm:w-[62px]">
                  <AppIcon icon={app.icon} size="fill" />
                </span>
                <span className={cx("dock-label max-w-full truncate px-0.5 text-[10.5px] font-medium sm:text-[11.5px]", on ? "text-accent" : "text-white/80")}>{app.name}</span>
                <span
                  aria-hidden
                  className={cx(
                    "absolute -bottom-1 h-[4px] w-[4px] rounded-full transition-opacity",
                    on ? "bg-accent opacity-100 shadow-[0_0_8px_2px_rgba(246,212,58,0.55)]" : running ? "bg-white/70 opacity-100" : "opacity-0",
                  )}
                />
              </button>
            </li>
          );
        })}
        {minimized.length > 0 && (
          <>
            <li aria-hidden className="mx-1.5 mb-6 h-[46px] w-px shrink-0 self-end bg-white/15 sm:mx-2 sm:h-[62px]" />
            {minimized.map((w) => (
              <MinimizedTile key={w.uid} win={w} onOpen={() => d.focus(w.id)} />
            ))}
          </>
        )}
      </ul>
      {menu && <AppMenu app={menu.app} x={menu.x} onClose={() => setMenu(null)} />}
    </nav>
  );
}

// A minimized window, waiting in the Dock: its app's icon over a sliver of glass, its title.
function MinimizedTile({ win, onOpen }: { win: Win; onOpen: () => void }) {
  const app = win.appId ? appById(win.appId) : null;
  return (
    <li className="shrink-0">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${win.title}, minimized`}
        title={win.title}
        className="dock-item group relative flex w-[64px] flex-col items-center gap-1 rounded-[18px] pb-1 sm:w-[82px] sm:gap-1.5"
      >
        <span className="dock-icon relative flex h-[46px] w-[46px] items-center justify-center rounded-[12px] bg-white/[0.07] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] sm:h-[62px] sm:w-[62px]">
          {app ? <AppIcon icon={app.icon} size={34} /> : null}
        </span>
        <span className="dock-label max-w-full truncate px-0.5 text-[10.5px] font-medium text-white/60 sm:text-[11.5px]">{win.title}</span>
      </button>
    </li>
  );
}

// Right-click on an app: its windows, a new one, close them all.
function AppMenu({ app, x, onClose }: { app: AppDef; x: number; onClose: () => void }) {
  const d = useDesktop();
  const root = useRef<HTMLDivElement>(null);
  const wins = d.wins.filter((w) => w.appId === app.id);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const item = "flex h-8 w-full items-center gap-2 rounded-[9px] px-2.5 text-left hover:bg-white/10";
  return (
    <div
      ref={root}
      role="menu"
      className="glass-pop animate-pop-in pointer-events-auto fixed bottom-[118px] w-[240px] -translate-x-1/2 rounded-[14px] p-1.5 text-[13px] text-ink"
      style={{ left: Math.max(130, Math.min(x, window.innerWidth - 130)) }}
    >
      <p className="px-2.5 pt-1 pb-1.5 text-[11.5px] font-semibold tracking-wide text-muted uppercase">{app.name}</p>
      {wins.map((w) => (
        <button
          key={w.uid}
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            d.focus(w.id);
          }}
          className={item}
        >
          <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", w.id === d.focused ? "bg-accent" : w.minimized ? "bg-white/25" : "bg-white/70")} />
          <span className="truncate">{w.title}</span>
        </button>
      ))}
      {wins.length > 0 && <div className="mx-2 my-1 h-px bg-white/10" />}
      {wins.filter((w) => !w.minimized).length > 1 && (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            d.setMission(true, app.id);
          }}
          className={item}
        >
          Show all windows
        </button>
      )}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          d.open(app.href, { newWindow: wins.some((w) => !w.doc) });
        }}
        className={item}
      >
        New window
      </button>
      {wins.length > 0 && (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            d.close(wins.map((w) => w.id));
          }}
          className={item}
        >
          Close {wins.length > 1 ? `all ${wins.length} windows` : "the window"}
        </button>
      )}
    </div>
  );
}
