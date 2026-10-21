"use client";

import { useEffect, useReducer } from "react";
import type { AppIconName, WindowTarget } from "@/lib/apps";

// The window manager's state: which windows are open, where, in what order. Windows are
// unique by key (one per app, one per document), so opening an app twice focuses it.

export type Zoom = "max" | "left" | "right" | null;

export type Win = {
  key: string;
  appId: string | null;
  name: string;
  icon: AppIconName;
  tint: [string, string];
  glyph?: string;
  // What the iframe first loaded; it changes only when the window is reloaded from scratch.
  src: string;
  // Where the window's page is now, and its pages so far (for the Back button).
  href: string;
  trail: string[];
  title: string;
  // The window's own frame; a zoomed or tiled window keeps it to return to.
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  zoom: Zoom;
  minimized: boolean;
  // Restored windows that start minimized load their page when first shown.
  loaded: boolean;
  ready: boolean;
  openedAt: number;
};

export type Area = { w: number; h: number; top: number; bottom: number };

export const MENUBAR_H = 34;
export const DOCK_H = 86;
const MIN_W = 420;
const MIN_H = 300;
const GAP = 8;

type State = { wins: Win[]; top: number };

type Action =
  // navigate: an existing window goes to href (a link); otherwise it's only brought forward.
  | { type: "open"; target: WindowTarget; href: string; area: Area; geometry?: Rect | null; navigate?: boolean }
  | { type: "focus"; key: string }
  | { type: "close"; key: string }
  | { type: "minimize"; key: string }
  | { type: "minimizeAll" }
  | { type: "zoom"; key: string; zoom: Zoom }
  | { type: "place"; key: string; rect: Rect }
  // The screen changed size: keep the window's own frame on screen, zoomed or not.
  | { type: "fit"; key: string; rect: Rect }
  | { type: "nav"; key: string; href: string; title?: string }
  | { type: "title"; key: string; title: string }
  | { type: "ready"; key: string }
  | { type: "loading"; key: string }
  | { type: "reload"; key: string }
  | { type: "restore"; wins: Win[] };

export type Rect = { x: number; y: number; w: number; h: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Keep a frame usable after the screen changed size: on screen, at least partly.
export function fitRect(r: Rect, area: Area): Rect {
  const w = clamp(r.w, MIN_W, Math.max(MIN_W, area.w - GAP * 2));
  const h = clamp(r.h, MIN_H, Math.max(MIN_H, area.bottom - area.top - GAP));
  const x = clamp(r.x, GAP - w + 160, area.w - 160);
  const y = clamp(r.y, area.top + 4, Math.max(area.top + 4, area.bottom - 60));
  return { x, y, w, h };
}

// Where a zoomed or tiled window sits.
export function zoomRect(zoom: Exclude<Zoom, null>, area: Area): Rect {
  const top = area.top + 6;
  const h = area.bottom - top - 6;
  if (zoom === "max") return { x: GAP, y: top, w: area.w - GAP * 2, h };
  const w = Math.floor((area.w - GAP * 3) / 2);
  return { x: zoom === "left" ? GAP : GAP * 2 + w, y: top, w, h };
}

export const frameOf = (win: Win, area: Area): Rect => (win.zoom ? zoomRect(win.zoom, area) : { x: win.x, y: win.y, w: win.w, h: win.h });

function newFrame(target: WindowTarget, area: Area, count: number, geometry?: Rect | null): Rect {
  if (geometry) return fitRect(geometry, area);
  const [dw, dh] = target.size ?? [1100, 760];
  const w = Math.min(dw, area.w - GAP * 4);
  const h = Math.min(dh, area.bottom - area.top - 28);
  // Cascade new windows down and right from the centre.
  const step = (count % 6) * 28;
  const x = Math.round((area.w - w) / 2) + step - 40;
  const y = area.top + 14 + step;
  return fitRect({ x, y, w, h }, area);
}

function reducer(state: State, action: Action): State {
  const top = state.top + 1;
  const patch = (key: string, p: Partial<Win> | ((w: Win) => Partial<Win>)) => ({
    ...state,
    wins: state.wins.map((w) => (w.key === key ? { ...w, ...(typeof p === "function" ? p(w) : p) } : w)),
  });
  switch (action.type) {
    case "open": {
      const existing = state.wins.find((w) => w.key === action.target.key);
      if (existing) {
        // A window restored minimized hasn't loaded its page yet: load the one asked for.
        const load = !existing.loaded && action.navigate ? { src: action.href, href: action.href, trail: [action.href] } : {};
        return { top, wins: state.wins.map((w) => (w.key === existing.key ? { ...w, ...load, minimized: false, loaded: true, z: top } : w)) };
      }
      const frame = newFrame(action.target, action.area, state.wins.filter((w) => !w.minimized).length, action.geometry);
      const win: Win = {
        key: action.target.key,
        appId: action.target.appId,
        name: action.target.name,
        icon: action.target.icon,
        tint: action.target.tint,
        glyph: action.target.glyph,
        src: action.href,
        href: action.href,
        trail: [action.href],
        title: action.target.name,
        ...frame,
        z: top,
        zoom: null,
        minimized: false,
        loaded: true,
        ready: false,
        openedAt: Date.now(),
      };
      return { top, wins: [...state.wins, win] };
    }
    case "focus": {
      const win = state.wins.find((w) => w.key === action.key);
      if (!win || (win.z === state.top && !win.minimized)) return state;
      return { top, wins: state.wins.map((w) => (w.key === action.key ? { ...w, z: top, minimized: false, loaded: true } : w)) };
    }
    case "close":
      return { ...state, wins: state.wins.filter((w) => w.key !== action.key) };
    case "minimize":
      return patch(action.key, { minimized: true });
    case "minimizeAll":
      return { ...state, wins: state.wins.map((w) => ({ ...w, minimized: true })) };
    case "zoom":
      return { top, wins: state.wins.map((w) => (w.key === action.key ? { ...w, zoom: action.zoom, z: top, minimized: false } : w)) };
    case "place":
      return patch(action.key, { ...action.rect, zoom: null });
    case "fit":
      return patch(action.key, action.rect);
    case "nav":
      return patch(action.key, (w) => {
        if (action.href === w.href) return action.title ? { title: action.title } : {};
        const trail =
          w.trail.length > 1 && w.trail[w.trail.length - 2] === action.href
            ? w.trail.slice(0, -1)
            : [...w.trail, action.href].slice(-30);
        return { href: action.href, trail, ...(action.title ? { title: action.title } : {}) };
      });
    case "title":
      return patch(action.key, { title: action.title });
    case "ready":
      return patch(action.key, { ready: true });
    case "loading":
      return patch(action.key, { ready: false });
    case "reload":
      return patch(action.key, (w) => ({ src: w.href, ready: false, loaded: true }));
    case "restore": {
      const z = action.wins.reduce((m, w) => Math.max(m, w.z), 0);
      return { top: z, wins: action.wins };
    }
  }
}

const STORE = "magik.windows.v1";
const GEOMETRY = "magik.geometry.v1";

// Open windows survive a reload of the desktop (this tab, this person).
export function useWindows(viewerId: string) {
  const [state, dispatch] = useReducer(reducer, { wins: [], top: 0 });
  const store = `${STORE}.${viewerId}`;

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(store) ?? "null") as Win[] | null;
      if (Array.isArray(saved) && saved.length) {
        dispatch({
          type: "restore",
          wins: saved.map((w) => ({ ...w, src: w.href, trail: [w.href], ready: false, loaded: !w.minimized })),
        });
      }
    } catch {}
  }, [store]);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        sessionStorage.setItem(store, JSON.stringify(state.wins));
      } catch {}
    }, 250);
    return () => clearTimeout(id);
  }, [state.wins, store]);

  return { state, dispatch };
}

// Each app reopens where it was last left (this browser).
export function rememberGeometry(key: string, rect: Rect) {
  if (key.startsWith("doc:")) return;
  try {
    const all = JSON.parse(localStorage.getItem(GEOMETRY) ?? "{}") as Record<string, Rect>;
    all[key] = rect;
    localStorage.setItem(GEOMETRY, JSON.stringify(all));
  } catch {}
}

export function recallGeometry(key: string): Rect | null {
  try {
    const all = JSON.parse(localStorage.getItem(GEOMETRY) ?? "{}") as Record<string, Rect>;
    return all[key] ?? null;
  } catch {
    return null;
  }
}

export { MIN_W, MIN_H, clamp };
