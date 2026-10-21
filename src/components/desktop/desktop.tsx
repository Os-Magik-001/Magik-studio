"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { AppDef } from "@/lib/apps";
import { windowFor, safeOpenPath } from "@/lib/apps";
import type { DesktopData } from "@/lib/desktop";
import type { Database } from "@/lib/database.types";
import { Button, cx } from "@/components/ui";
import { AppIcon } from "@/components/desktop/app-icon";
import { Dock } from "@/components/desktop/dock";
import { MenuBar, MagikMark, type MenuDef } from "@/components/desktop/menu-bar";
import { Spotlight, type QuickAction } from "@/components/desktop/spotlight";
import { WALLPAPERS, Wallpaper, setWallpaper, type WallpaperId } from "@/components/desktop/wallpaper";
import { Widgets } from "@/components/desktop/widgets";
import { WindowFrame } from "@/components/desktop/window-frame";
import {
  DOCK_H,
  MENUBAR_H,
  fitRect,
  recallGeometry,
  rememberGeometry,
  useWindows,
  type Area,
  type Rect,
} from "@/components/desktop/use-windows";
import { unreadCount } from "@/app/actions/desktop";

type Role = Database["public"]["Enums"]["user_role"];

export type DesktopViewer = { id: string; name: string; email: string; role: Role; roleLabel: string };

const QUICK_ACTIONS: Partial<Record<Role, QuickAction[]>> = {
  admin: [
    { label: "New client", hint: "Start an onboarding: details, pack, invoice, contract, link", href: "/onboarding/new" },
    { label: "Add a team member", hint: "Team", href: "/team" },
  ],
  seller: [{ label: "New client", hint: "Start an onboarding: details, pack, invoice, contract, link", href: "/onboarding/new" }],
  client: [{ label: "Videos waiting for me", hint: "Your videos", href: "/review" }],
};

const readArea = (): Area => ({
  w: window.innerWidth,
  h: window.innerHeight,
  top: MENUBAR_H,
  bottom: window.innerHeight - DOCK_H,
});

export function Desktop({
  viewer,
  apps,
  data,
  initialOpen,
  welcome,
}: {
  viewer: DesktopViewer;
  apps: AppDef[];
  data: DesktopData;
  initialOpen: string | null;
  welcome: boolean;
}) {
  const { state, dispatch } = useWindows(viewer.id);
  const wins = state.wins;
  const winsRef = useRef(wins);
  const frames = useRef(new Map<string, HTMLIFrameElement | null>());
  const [area, setArea] = useState<Area | null>(null);
  const areaRef = useRef<Area | null>(null);
  // Handlers read the latest windows and screen through refs.
  useLayoutEffect(() => {
    winsRef.current = wins;
    areaRef.current = area;
  });
  const [phone, setPhone] = useState(false);
  const [spotlight, setSpotlight] = useState(false);
  const [about, setAbout] = useState(false);
  const [showWelcome, setShowWelcome] = useState(welcome);
  const [snap, setSnap] = useState<Rect | null>(null);
  const [interacting, setInteracting] = useState(false);
  const [unread, setUnread] = useState(data.unread);
  const signOutForm = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const onResize = () => {
      setArea(readArea());
      setPhone(window.innerWidth < 768);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const visible = wins.filter((w) => !w.minimized);
  const focused = visible.reduce<(typeof wins)[number] | null>((top, w) => (!top || w.z > top.z ? w : top), null);

  // ------------------------------------------------------------------ opening things

  const openHref = useCallback(
    (href: string, navigate = true) => {
      const a = areaRef.current ?? readArea();
      const target = windowFor(href, viewer.role);
      if (!target) return;
      const existing = winsRef.current.find((w) => w.key === target.key);
      dispatch({ type: "open", target, href, area: a, geometry: existing ? null : recallGeometry(target.key), navigate });
      if (existing && navigate && existing.loaded && existing.href !== href) {
        frames.current.get(existing.key)?.contentWindow?.postMessage({ type: "magik:navigate", href }, location.origin);
      }
    },
    [dispatch, viewer.role],
  );

  const openApp = useCallback(
    (app: AppDef) => {
      const existing = winsRef.current.find((w) => w.key === app.id);
      if (existing) {
        // As on a Mac: an app already open comes forward (out of the Dock if it was minimized).
        dispatch({ type: "focus", key: existing.key });
      } else {
        openHref(app.href);
      }
    },
    [dispatch, openHref],
  );

  // A link from outside (a bookmark, an email) opens its window once the desktop is up.
  useEffect(() => {
    if (!area) return;
    const path = safeOpenPath(initialOpen);
    if (path) openHref(path);
    if (initialOpen || welcome) history.replaceState(null, "", "/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area === null]);

  // ------------------------------------------------------------------ talking to the windows

  useEffect(() => {
    const keyOf = (source: MessageEventSource | null) => {
      for (const [key, el] of frames.current) if (el?.contentWindow === source) return key;
      return null;
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      const m = e.data as { type?: string; href?: string; title?: string; id?: string };
      if (typeof m?.type !== "string" || !m.type.startsWith("magik:")) return;
      const key = keyOf(e.source);
      switch (m.type) {
        case "magik:ready":
          if (key) {
            dispatch({ type: "ready", key });
            if (m.href) dispatch({ type: "nav", key, href: m.href, title: m.title });
          }
          break;
        case "magik:nav":
          if (key && m.href) dispatch({ type: "nav", key, href: m.href, title: m.title });
          if (key === "notifications") unreadCount().then(setUnread).catch(() => {});
          break;
        case "magik:title":
          if (key && m.title) dispatch({ type: "title", key, title: m.title });
          break;
        case "magik:focus":
          if (key) dispatch({ type: "focus", key });
          break;
        case "magik:open":
          if (m.href) openHref(m.href);
          break;
        case "magik:spotlight":
          setSpotlight(true);
          break;
        case "magik:unread":
          unreadCount().then(setUnread).catch(() => {});
          break;
        case "magik:wallpaper":
          if (WALLPAPERS.some((w) => w.id === m.id)) setWallpaper(m.id as WallpaperId);
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [dispatch, openHref]);

  // ⌘K anywhere on the desktop (windows forward it from inside).
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

  // The unread badge, kept fresh while the desktop is in view.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") unreadCount().then(setUnread).catch(() => {});
    }, 45_000);
    return () => clearInterval(id);
  }, []);

  // Keep windows on screen when the browser window changes size.
  useEffect(() => {
    if (!area) return;
    for (const w of winsRef.current) {
      const r = fitRect(w, area);
      if (r.x !== w.x || r.y !== w.y || r.w !== w.w || r.h !== w.h) dispatch({ type: "fit", key: w.key, rect: r });
    }
  }, [area, dispatch]);

  const dockRect = (key: string) => () =>
    document.querySelector<HTMLElement>(`[data-dock-key="${CSS.escape(key)}"]`)?.getBoundingClientRect() ?? null;

  const close = (key: string) => {
    const w = winsRef.current.find((x) => x.key === key);
    if (w && area) rememberGeometry(key, { x: w.x, y: w.y, w: w.w, h: w.h });
    frames.current.delete(key);
    dispatch({ type: "close", key });
  };

  const reload = (key: string) => {
    dispatch({ type: "loading", key });
    try {
      frames.current.get(key)?.contentWindow?.location.reload();
    } catch {
      dispatch({ type: "reload", key });
    }
  };

  const back = (key: string) => {
    const w = winsRef.current.find((x) => x.key === key);
    const to = w && w.trail.length > 1 ? w.trail[w.trail.length - 2] : null;
    if (to) frames.current.get(key)?.contentWindow?.postMessage({ type: "magik:navigate", href: to }, location.origin);
  };

  const signOut = () => {
    try {
      sessionStorage.clear();
    } catch {}
    signOutForm.current?.requestSubmit();
  };

  // ------------------------------------------------------------------ the menu bar

  const settingsApp = apps.find((a) => a.id === "settings");
  const menus: MenuDef[] = useMemo(() => {
    const f = focused;
    return [
      {
        id: "magik",
        label: <MagikMark />,
        ariaLabel: "Magik menu",
        items: [
          { label: "About Magik OS", onSelect: () => setAbout(true) },
          { separator: true },
          ...(settingsApp ? [{ label: "Settings…", onSelect: () => openApp(settingsApp) }] : []),
          { label: "Search…", shortcut: "⌘K", onSelect: () => setSpotlight(true) },
          { separator: true },
          { label: "Show Desktop", onSelect: () => dispatch({ type: "minimizeAll" }), disabled: !visible.length },
          { label: "Close All Windows", onSelect: () => winsRef.current.forEach((w) => close(w.key)), disabled: !wins.length },
          { separator: true },
          { label: `Sign Out ${viewer.name}…`, onSelect: signOut },
        ],
      },
      {
        id: "app",
        bold: true,
        label: f ? f.name : "Desktop",
        items: f
          ? [
              { label: `Reload ${f.name}`, onSelect: () => reload(f.key) },
              { label: "Back", onSelect: () => back(f.key), disabled: f.trail.length < 2 },
              { separator: true },
              { label: `Close ${f.name}`, onSelect: () => close(f.key) },
            ]
          : [{ label: "Open an app from the Dock", onSelect: () => {}, disabled: true }],
      },
      {
        id: "go",
        label: "Go",
        items: apps.map((a) => ({ label: a.name, onSelect: () => openApp(a), checked: !!wins.find((w) => w.key === a.id) })),
      },
      {
        id: "window",
        label: "Window",
        items: [
          { label: "Minimize", onSelect: () => f && dispatch({ type: "minimize", key: f.key }), disabled: !f },
          { label: f?.zoom === "max" ? "Restore" : "Zoom", onSelect: () => f && dispatch({ type: "zoom", key: f.key, zoom: f.zoom === "max" ? null : "max" }), disabled: !f },
          { label: "Tile Window to Left of Screen", onSelect: () => f && dispatch({ type: "zoom", key: f.key, zoom: "left" }), disabled: !f || phone },
          { label: "Tile Window to Right of Screen", onSelect: () => f && dispatch({ type: "zoom", key: f.key, zoom: "right" }), disabled: !f || phone },
          { separator: true },
          ...[...wins]
            .sort((a, b) => a.openedAt - b.openedAt)
            .map((w) => ({
              label: w.title.replace(/\s*·\s*Magik OS$/, "") || w.name,
              onSelect: () => dispatch({ type: "focus", key: w.key }),
              checked: f?.key === w.key,
            })),
          ...(wins.length ? [{ separator: true } as const] : []),
          {
            label: "Bring All to Front",
            onSelect: () => [...winsRef.current].sort((a, b) => a.z - b.z).forEach((w) => dispatch({ type: "focus", key: w.key })),
            disabled: !wins.length,
          },
        ],
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, wins, apps, phone, viewer.name]);

  const account: MenuDef = {
    id: "account",
    label: viewer.name,
    items: [
      { label: `${viewer.name} · ${viewer.roleLabel}`, onSelect: () => {}, disabled: true },
      ...(settingsApp ? [{ label: "Settings…", onSelect: () => openApp(settingsApp) }] : []),
      { separator: true },
      { label: "Sign Out…", onSelect: signOut },
    ],
  };

  const badges = { notifications: unread };

  return (
    <div className={cx("fixed inset-0 overflow-hidden select-none", interacting && "is-interacting")}>
      <Wallpaper />
      <form ref={signOutForm} action="/auth/signout" method="post" className="hidden" />

      {!phone && (
        <MenuBar
          menus={menus}
          right={{
            unread,
            name: viewer.name,
            account,
            onSpotlight: () => setSpotlight(true),
            onNotifications: () => openHref("/notifications", false),
          }}
        />
      )}

      {/* Desktop: widgets on the right, a hint while nothing is open. */}
      {area && !phone && (
        <div className="pointer-events-none absolute inset-x-0 top-[34px] bottom-[86px] z-0 flex justify-end p-5">
          {area.w >= 1100 && <Widgets name={viewer.name} data={{ ...data, unread }} onOpen={(href) => openHref(href, true)} />}
        </div>
      )}
      {area && !phone && !visible.length && (
        <p className="on-wallpaper animate-fade-in pointer-events-none absolute inset-x-0 bottom-[112px] text-center text-[13px] text-white/70">
          Open an app from the Dock, or press <kbd className="rounded-md bg-white/15 px-1.5 py-0.5 font-sans text-[12px]">⌘K</kbd> to search.
        </p>
      )}

      {phone && <PhoneHome apps={apps} badges={badges} onOpen={openApp} name={viewer.name} />}

      {/* Windows */}
      {area &&
        wins.map((w) => (
          <WindowFrame
            key={w.key}
            win={w}
            role={viewer.role}
            area={area}
            phone={phone}
            focused={focused?.key === w.key}
            onFocus={() => dispatch({ type: "focus", key: w.key })}
            onClose={() => close(w.key)}
            onMinimize={() => dispatch({ type: "minimize", key: w.key })}
            onZoom={(zoom) => dispatch({ type: "zoom", key: w.key, zoom })}
            onPlace={(rect) => {
              dispatch({ type: "place", key: w.key, rect });
              rememberGeometry(w.key, rect);
            }}
            onBack={() => back(w.key)}
            onReload={() => reload(w.key)}
            onLoaded={() => dispatch({ type: "ready", key: w.key })}
            onSnapPreview={setSnap}
            onInteract={setInteracting}
            dockRect={dockRect(w.key.startsWith("doc:") ? w.key : (w.appId ?? w.key))}
            registerFrame={(key, el) => {
              if (el) frames.current.set(key, el);
            }}
          />
        ))}

      {/* Where a dragged window will tile. */}
      {snap && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-[8999] rounded-[22px] border border-white/40 bg-white/15 backdrop-blur-sm transition-all duration-150"
          style={{ left: snap.x, top: snap.y, width: snap.w, height: snap.h }}
        />
      )}

      {!phone && (
        <Dock
          apps={apps}
          wins={wins}
          badges={badges}
          onOpenApp={openApp}
          onShowWindow={(key) => dispatch({ type: "focus", key })}
        />
      )}

      {spotlight && (
        <Spotlight
          apps={apps}
          actions={QUICK_ACTIONS[viewer.role] ?? []}
          onOpenApp={openApp}
          onOpenHref={(href) => openHref(href)}
          onClose={() => setSpotlight(false)}
        />
      )}

      {about && <AboutPanel onClose={() => setAbout(false)} />}
      {showWelcome && <WelcomePanel name={viewer.name} apps={apps} onClose={() => setShowWelcome(false)} />}
    </div>
  );
}

// ------------------------------------------------------------------ phones: a home screen

function PhoneHome({
  apps,
  badges,
  onOpen,
  name,
}: {
  apps: AppDef[];
  badges: Record<string, number>;
  onOpen: (app: AppDef) => void;
  name: string;
}) {
  return (
    <div className="absolute inset-0 overflow-y-auto px-5 pt-[max(env(safe-area-inset-top),20px)] pb-10">
      <div className="mb-8 flex items-center justify-between pt-3">
        <Image src="/brand/magik-horizontal.svg" alt="Magik Management" width={130} height={28} unoptimized priority className="h-auto w-[130px]" />
        <span className="on-wallpaper text-[13px] text-white/80">{name}</span>
      </div>
      <ul className="grid grid-cols-4 gap-x-4 gap-y-6">
        {apps.map((app) => (
          <li key={app.id}>
            <button type="button" onClick={() => onOpen(app)} className="relative flex w-full flex-col items-center gap-1.5">
              <AppIcon icon={app.icon} tint={app.tint} glyph={app.glyph} size={60} />
              {!!badges[app.id] && (
                <span className="absolute -top-1 right-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[11px] font-semibold text-white">
                  {badges[app.id]}
                </span>
              )}
              <span className="on-wallpaper w-full truncate text-center text-[11.5px] text-white">{app.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <form action="/auth/signout" method="post" className="mt-12 text-center">
        <button className="on-wallpaper text-[13px] text-white/70 underline-offset-4 hover:underline">Sign out</button>
      </form>
    </div>
  );
}

// ------------------------------------------------------------------ panels

function Panel({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[9700] flex items-center justify-center bg-black/25 px-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={label} className="glass-pop animate-pop-in w-full max-w-[420px] rounded-[26px] p-7 text-center">
        {children}
      </div>
    </div>
  );
}

function AboutPanel({ onClose }: { onClose: () => void }) {
  return (
    <Panel onClose={onClose} label="About Magik OS">
      <Image src="/brand/magik-vertical.svg" alt="Magik Management" width={150} height={110} unoptimized className="mx-auto h-auto w-[150px]" />
      <h2 className="mt-6 font-display text-[22px] font-bold text-ink">Magik OS</h2>
      <p className="mt-1 text-[13px] text-muted">Version 2 · October 2026</p>
      <p className="mt-4 text-[13.5px] leading-relaxed text-ink-2">
        The studio&apos;s workspace: onboard clients, plan, shoot, edit, review and deliver. Every feature is an app; open
        them from the Dock or with ⌘K.
      </p>
      <Button className="mt-6" onClick={onClose}>
        Close
      </Button>
    </Panel>
  );
}

function WelcomePanel({ name, apps, onClose }: { name: string; apps: AppDef[]; onClose: () => void }) {
  return (
    <Panel onClose={onClose} label="Welcome">
      <p className="kicker">Welcome to Magik</p>
      <h2 className="mt-2 font-display text-[26px] leading-tight font-bold text-ink">You&apos;re all set, {name.split(/\s+/)[0]}.</h2>
      <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">This is your Magik desktop. Everything we make together lives in these apps:</p>
      <ul className="mt-5 flex flex-col gap-2.5 text-left">
        {apps.map((a) => (
          <li key={a.id} className="flex items-center gap-3">
            <AppIcon icon={a.icon} tint={a.tint} glyph={a.glyph} size={34} className="rounded-[9px]" />
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold text-ink">{a.name}</span>
              <span className="block truncate text-[12px] text-muted">{a.hint}</span>
            </span>
          </li>
        ))}
      </ul>
      <Button variant="primary" className="mt-7 w-full" onClick={onClose}>
        Start
      </Button>
    </Panel>
  );
}
