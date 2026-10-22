"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isDesktopPath, pathKey, windowFor, appById, type AppDef } from "@/lib/apps";
import { unreadCount } from "@/app/actions/desktop";
import { savePreferences } from "@/app/actions/account";
import { hasLook, lookOf, type Preferences } from "@/lib/preferences";
import { applyLook, readLocalLook } from "@/components/shell/look";
import { DesktopContext, type DesktopApi, type OpenOptions, type ShellViewer } from "@/components/desktop/context";
import { hasContent, keepContent } from "@/components/desktop/content";
import { useHydrated } from "@/components/local-date";
import { WindowFrame } from "@/components/desktop/window-frame";
import { missionLayout } from "@/components/desktop/mission";
import {
  fitRect,
  frameOf,
  geometryKey,
  loadSession,
  newFrame,
  recallGeometry,
  reducer,
  rememberGeometry,
  saveSession,
  type Area,
  type Nav,
  type Rect,
  type Win,
  type Zoom,
} from "@/components/desktop/windows";
import { TopBar } from "@/components/shell/top-bar";
import { Dock } from "@/components/shell/dock";
import { Spotlight, type QuickAction } from "@/components/shell/spotlight";

const MENU_H = 46;

const QUICK_ACTIONS: Partial<Record<ShellViewer["role"], QuickAction[]>> = {
  admin: [
    { label: "New client", hint: "Start an onboarding: details, pack, invoice, contract, link", href: "/onboarding/new" },
    { label: "New event", hint: "Calendar", href: "/calendar?new=1" },
    { label: "Add a team member", hint: "Team", href: "/team" },
  ],
  editor: [{ label: "New event", hint: "Calendar", href: "/calendar?new=1" }],
  seller: [
    { label: "New client", hint: "Start an onboarding: details, pack, invoice, contract, link", href: "/onboarding/new" },
    { label: "New event", hint: "Calendar", href: "/calendar?new=1" },
  ],
  videographer: [{ label: "New event", hint: "Calendar", href: "/calendar?new=1" }],
  client: [
    { label: "Videos waiting for me", hint: "Your videos", href: "/review" },
    { label: "Where are my videos?", hint: "Pipeline", href: "/pipeline" },
  ],
};

// A navigation the desktop started: which window it is for.
type Pending = { id: string; path: string; nav: Nav; at: number };

const stripTitle = (t: string) => t.replace(/\s*·\s*Magik OS$/, "").trim();

// Magik OS: the wallpaper and Home underneath, the app windows on top, the menu bar and the
// Dock around them. Every page is rendered by the router into a hidden slot (`children`) and
// handed to its window (components/desktop/window-page.tsx), so several apps stay open at once.
// The router's page is always the focused window's: clicking a window brings its page back,
// so its forms and refreshes act on it.
export function Desktop({
  viewer,
  apps,
  unread: serverUnread,
  preferences,
  home,
  children,
}: {
  viewer: ShellViewer;
  apps: AppDef[];
  unread: number;
  preferences: Preferences;
  home: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const routerPath = pathKey(pathname, search.toString());
  const role = viewer.role;

  const [state, dispatch] = useReducer(reducer, { wins: [], top: 0, focused: null });
  const stateRef = useRef(state);
  const routerPathRef = useRef(routerPath);
  const pending = useRef<Pending | null>(null);
  // False in the server render and while hydrating: windows open in the browser only.
  const mounted = useHydrated();
  const [area, setArea] = useState<Area>({ w: 1440, h: 900, top: MENU_H, bottom: 790 });
  const areaRef = useRef(area);
  const [phone, setPhone] = useState(false);
  const [mission, setMissionState] = useState(false);
  const [missionApp, setMissionApp] = useState<string | null>(null);
  // Mission Control's glide lasts a moment after it closes, so the windows glide back too.
  const [gliding, setGliding] = useState(false);
  const [wasMission, setWasMission] = useState(false);
  if (mission !== wasMission) {
    setWasMission(mission);
    if (!mission) setGliding(true);
  }
  useEffect(() => {
    if (!gliding) return;
    const id = setTimeout(() => setGliding(false), 460);
    return () => clearTimeout(id);
  }, [gliding]);
  const [spotlight, setSpotlight] = useState(false);
  const dockIcons = useRef(new Map<string, HTMLElement>());
  const dockEl = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    stateRef.current = state;
    routerPathRef.current = routerPath;
    areaRef.current = area;
  });

  // ------------------------------------------------------------ unread badge

  // The server's count wins whenever the layout re-renders; polling keeps it fresh in between.
  const [unread, setUnread] = useState(serverUnread);
  const [fromServer, setFromServer] = useState(serverUnread);
  if (serverUnread !== fromServer) {
    setFromServer(serverUnread);
    setUnread(serverUnread);
  }
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") unreadCount().then(setUnread).catch(() => {});
    }, 45_000);
    return () => clearInterval(id);
  }, []);

  // ------------------------------------------------------------ the screen

  const measure = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dockTop = dockEl.current?.getBoundingClientRect().top ?? h - 110;
    const next: Area = { w, h, top: MENU_H, bottom: Math.max(MENU_H + 200, Math.round(dockTop) - 8) };
    const cur = areaRef.current;
    if (next.w !== cur.w || next.h !== cur.h || next.bottom !== cur.bottom) {
      areaRef.current = next;
      setArea(next);
      dispatch({ type: "fit", area: next });
    }
    setPhone(w < 640);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    if (dockEl.current) ro.observe(dockEl.current);
    return () => {
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, [measure]);

  // ------------------------------------------------------------ opening pages in windows

  const frameFor = useCallback(
    (target: { key: string; appId: string | null; doc: boolean; size: [number, number] }) => {
      const open = stateRef.current.wins.filter((w) => !w.minimized).length;
      const remembered = recallGeometry(viewer.id, geometryKey({ id: target.key, appId: target.appId, doc: target.doc }));
      return newFrame(target.size, areaRef.current, open, remembered);
    },
    [viewer.id],
  );

  const titleFor = (appId: string | null) => (appId ? (appById(appId)?.name ?? "Magik OS") : "Magik OS");

  // Puts the router on a window's page, so that window is the one forms and refreshes act on.
  const routeTo = useCallback(
    (id: string, path: string, how: "push" | "replace") => {
      // Already there: nothing will arrive, so nothing to wait for.
      if (routerPathRef.current === path) {
        pending.current = null;
        return;
      }
      pending.current = { id, path, nav: "stay", at: Date.now() };
      if (how === "push") router.push(path, { scroll: false });
      else router.replace(path, { scroll: false });
    },
    [router],
  );

  const toDesktop = useCallback(() => {
    if (routerPathRef.current === "/") {
      pending.current = null;
      return;
    }
    pending.current = { id: "desktop", path: "/", nav: "stay", at: Date.now() };
    router.replace("/", { scroll: false });
  }, [router]);

  const focus = useCallback(
    (id: string) => {
      const win = stateRef.current.wins.find((w) => w.id === id);
      if (!win) return;
      dispatch({ type: "focus", id });
      routeTo(id, win.path, "replace");
    },
    [routeTo],
  );

  const open = useCallback(
    (href: string, options?: OpenOptions) => {
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) {
        window.open(url.href, "_blank", "noopener");
        return;
      }
      if (url.pathname === "/") {
        dispatch({ type: "minimizeAll" });
        toDesktop();
        return;
      }
      if (!isDesktopPath(url.pathname)) {
        window.location.assign(url.href);
        return;
      }
      const path = pathKey(url.pathname, url.search);
      const target = windowFor(path, role);
      if (!target) return;
      let id = target.key;
      const wins = stateRef.current.wins;
      if (options?.newWindow) {
        let n = 2;
        while (wins.some((w) => w.id === `${target.key}~${n}`)) n++;
        id = `${target.key}~${n}`;
      }
      const existing = wins.find((w) => w.id === id);
      if (existing && existing.path === path) {
        focus(id);
        return;
      }
      setMissionState(false);
      // The window shows at once; the page arrives in it when the router has it.
      dispatch({ type: "show", id, appId: target.appId, doc: target.doc, path, title: existing?.title ?? titleFor(target.appId), frame: existing ? frameOf(existing, areaRef.current) : frameFor(target), nav: "push" });
      routeTo(id, path, "push");
    },
    [focus, frameFor, role, routeTo, toDesktop],
  );

  // The router moved (a link, a redirect, Back in the browser): show its page in its window.
  useEffect(() => {
    if (!mounted) return;
    const path = routerPath;
    const p = pending.current;
    const fresh = !!p && (p.path === path || Date.now() - p.at < 5000);
    if (fresh) pending.current = null;
    const st = stateRef.current;
    if (path === "/") {
      dispatch({ type: "desktop" });
      return;
    }
    const target = windowFor(path, role);
    if (!target) return;
    let id = target.key;
    let nav: Nav = "push";
    if (fresh && p && p.id !== "desktop") {
      id = p.id;
      nav = p.path === path ? p.nav : "stay";
      // Redirected to a page of another window: that window shows it; the one that asked
      // becomes it when the other isn't open, or goes away when it never showed anything.
      if (p.path !== path && target.key !== p.id) {
        if (st.wins.some((w) => w.id === target.key)) {
          const asker = st.wins.find((w) => w.id === p.id);
          if (asker && !asker.back.length && !hasContent(asker.path)) dispatch({ type: "close", id: p.id });
          id = target.key;
          nav = "push";
        } else if (st.wins.some((w) => w.id === p.id) && !p.id.includes("~")) {
          dispatch({ type: "rekey", from: p.id, to: target.key, appId: target.appId, doc: target.doc });
          id = target.key;
        }
      }
    } else {
      // A "New …" form that just created something becomes that thing's window.
      const f = st.wins.find((w) => w.id === st.focused);
      if (f && f.id !== id && /\/new(?:$|[/?])/.test(f.path) && !st.wins.some((w) => w.id === id)) {
        dispatch({ type: "rekey", from: f.id, to: id, appId: target.appId, doc: target.doc });
        nav = "stay";
      }
    }
    const existing = stateRef.current.wins.find((w) => w.id === id) ?? st.wins.find((w) => w.id === id);
    if (existing && existing.path === path && st.focused === id && !existing.minimized) return;
    dispatch({
      type: "show",
      id,
      appId: target.appId,
      doc: target.doc,
      path,
      title: existing?.title ?? titleFor(target.appId),
      frame: existing ? frameOf(existing, areaRef.current) : frameFor(target),
      nav,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routerPath, mounted]);

  // The look follows the person: their account's choice wins over this browser's; a browser
  // with a choice the account doesn't have yet gives it to the account.
  useEffect(() => {
    const account = lookOf(preferences);
    const local = readLocalLook();
    if (hasLook(account)) applyLook(account);
    else if (local && hasLook(local)) {
      applyLook(local);
      savePreferences(local).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // First visit: bring back the windows of last time (minimized) before the router's page opens.
  useEffect(() => {
    const saved = loadSession(viewer.id).map((w) => ({ ...w, ...fitRect(w, areaRef.current) }));
    if (saved.length) dispatch({ type: "restore", wins: saved });
  }, [viewer.id]);

  // Remember the open windows, and let go of the pages no window shows.
  useEffect(() => {
    if (!mounted) return;
    const id = setTimeout(() => saveSession(viewer.id, state.wins), 400);
    const keep = new Set<string>([routerPathRef.current]);
    for (const w of state.wins) {
      keep.add(w.path);
      w.back.slice(-3).forEach((p) => keep.add(p));
      w.ahead.slice(0, 2).forEach((p) => keep.add(p));
    }
    keepContent(keep);
    return () => clearTimeout(id);
  }, [state.wins, mounted, viewer.id]);

  // Window titles follow the page's title while it's the router's page.
  useEffect(() => {
    const update = () => {
      const win = stateRef.current.wins.find((w) => w.path === routerPathRef.current);
      if (!win) return;
      const title = stripTitle(document.title);
      // A page without a title of its own (not found…): the app's name.
      dispatch({ type: "title", id: win.id, title: title && title !== "Magik OS" ? title : titleFor(win.appId) });
    };
    const raf = requestAnimationFrame(update);
    const obs = new MutationObserver(update);
    obs.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
    };
  }, [routerPath, state.wins.length]);

  // ------------------------------------------------------------ window commands

  const close = useCallback(
    (ids: string | string[]) => {
      const gone = new Set(Array.isArray(ids) ? ids : [ids]);
      const st = stateRef.current;
      const wasFocused = !!st.focused && gone.has(st.focused);
      for (const id of gone) dispatch({ type: "close", id });
      if (!wasFocused) return;
      const rest = st.wins.filter((w) => !gone.has(w.id) && !w.minimized).sort((a, b) => b.z - a.z);
      if (rest[0]) routeTo(rest[0].id, rest[0].path, "replace");
      else toDesktop();
    },
    [routeTo, toDesktop],
  );

  const minimize = useCallback(
    (id: string) => {
      const st = stateRef.current;
      const wasFocused = st.focused === id;
      dispatch({ type: "minimize", id });
      if (!wasFocused) return;
      const rest = st.wins.filter((w) => w.id !== id && !w.minimized).sort((a, b) => b.z - a.z);
      if (rest[0]) routeTo(rest[0].id, rest[0].path, "replace");
      else toDesktop();
    },
    [routeTo, toDesktop],
  );

  const zoom = useCallback((id: string, z: Zoom) => dispatch({ type: "zoom", id, zoom: z }), []);

  const place = useCallback(
    (id: string, rect: Rect) => {
      dispatch({ type: "place", id, rect });
      const win = stateRef.current.wins.find((w) => w.id === id);
      if (win) rememberGeometry(viewer.id, geometryKey(win), rect);
    },
    [viewer.id],
  );

  const go = useCallback(
    (id: string, dir: "back" | "forward") => {
      const win = stateRef.current.wins.find((w) => w.id === id);
      const to = dir === "back" ? win?.back.at(-1) : win?.ahead[0];
      if (!win || !to) return;
      dispatch({ type: "show", id, appId: win.appId, doc: win.doc, path: to, title: win.title, frame: frameOf(win, areaRef.current), nav: dir });
      routeTo(id, to, "push");
    },
    [routeTo],
  );

  const reload = useCallback(
    (id: string) => {
      const win = stateRef.current.wins.find((w) => w.id === id);
      if (!win) return;
      if (routerPathRef.current === win.path) router.refresh();
      else focus(id);
    },
    [focus, router],
  );

  const showDesktop = useCallback(() => {
    setMissionState(false);
    const st = stateRef.current;
    // Everything already tucked away: Home again brings the last window back.
    if (st.wins.every((w) => w.minimized) && st.wins.length) {
      const last = [...st.wins].sort((a, b) => b.z - a.z)[0];
      focus(last.id);
      return;
    }
    dispatch({ type: "minimizeAll" });
    toDesktop();
  }, [focus, toDesktop]);

  const setMission = useCallback((on: boolean, appId?: string) => {
    const wins = stateRef.current.wins.filter((w) => !w.minimized && (!appId || w.appId === appId));
    setMissionApp(on && appId ? appId : null);
    setMissionState(on && wins.length > 0);
  }, []);

  const setBusy = useCallback((busy: boolean) => {
    if (busy) document.documentElement.dataset.wmBusy = "1";
    else delete document.documentElement.dataset.wmBusy;
  }, []);

  const registerDockIcon = useCallback((appId: string, el: HTMLElement | null) => {
    if (el) dockIcons.current.set(appId, el);
    else dockIcons.current.delete(appId);
  }, []);

  const dockIconRect = useCallback((appId: string | null) => {
    const el = (appId && dockIcons.current.get(appId)) || dockIcons.current.get("home");
    return el?.getBoundingClientRect() ?? null;
  }, []);

  // ------------------------------------------------------------ keyboard

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && k === "k") {
        e.preventDefault();
        setSpotlight((s) => !s);
      } else if (e.key === "F3" || (e.ctrlKey && !e.metaKey && e.key === "ArrowUp")) {
        e.preventDefault();
        setMissionApp(null);
        setMissionState((m) => !m && stateRef.current.wins.some((w) => !w.minimized));
      } else if (e.key === "Escape" && !spotlight) {
        setMissionState(false);
      } else if (e.altKey && !e.metaKey && !e.ctrlKey && (e.code === "KeyW" || e.code === "KeyM")) {
        const id = stateRef.current.focused;
        if (!id) return;
        e.preventDefault();
        if (e.code === "KeyW") close(id);
        else minimize(id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, minimize, spotlight]);

  // ------------------------------------------------------------ links open in windows

  // Capture phase, before <Link> sees the click: an app's link opens in its window (⌘-click: a
  // new window). Links out of the desktop (an invoice, a PDF) and to a place on the same page
  // keep the browser's behaviour.
  const onClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.altKey || e.shiftKey) return;
    const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a || a.hasAttribute("download") || (a.target && a.target !== "_self") || a.dataset.native !== undefined) return;
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin || !isDesktopPath(url.pathname)) return;
    if (url.hash && url.pathname === window.location.pathname && url.search === window.location.search) return;
    e.preventDefault();
    open(url.pathname + url.search, { newWindow: e.metaKey || e.ctrlKey });
  };

  // ------------------------------------------------------------ render

  const visible = state.wins.filter((w) => !w.minimized && (!mission || !missionApp || w.appId === missionApp));
  const missionRects = useMemo(() => (mission ? missionLayout(visible, area) : null), [mission, visible, area]);
  const focusedWin = state.wins.find((w) => w.id === state.focused) ?? null;

  const api: DesktopApi = {
    viewer,
    apps,
    unread,
    setUnread,
    wins: state.wins,
    focused: state.focused,
    area,
    phone,
    mission,
    setMission,
    open,
    focus,
    close,
    minimize,
    zoom,
    place,
    back: (id) => go(id, "back"),
    forward: (id) => go(id, "forward"),
    reload,
    showDesktop,
    openSpotlight: () => setSpotlight(true),
    registerDockIcon,
    dockIconRect,
    setBusy,
  };

  return (
    <DesktopContext value={api}>
      <div className="desktop" data-mission={mission || gliding || undefined} onClickCapture={onClickCapture}>
        <div className="home-layer" onPointerDown={() => dispatch({ type: "desktop" })}>
          {home}
        </div>

        {mounted &&
          state.wins.map((win: Win) => (
            <WindowFrame
              key={win.uid}
              win={win}
              focused={state.focused === win.id}
              hidden={win.minimized || (phone && state.focused !== win.id)}
              mission={missionRects?.get(win.id) ?? null}
              aside={mission && !!missionApp && win.appId !== missionApp}
            />
          ))}

        {mission && (
          <div
            className="mission-veil"
            aria-hidden
            onClick={() => setMissionState(false)}
          />
        )}

        {/* The router's page: rendered here, shown in its window. */}
        <div hidden>{children}</div>

        <TopBar current={focusedWin} />
        <Dock ref={dockEl} />
        {spotlight && (
          <Spotlight
            apps={apps}
            actions={QUICK_ACTIONS[role] ?? []}
            onOpenHref={(href) => open(href)}
            onClose={() => setSpotlight(false)}
          />
        )}
      </div>
    </DesktopContext>
  );
}
