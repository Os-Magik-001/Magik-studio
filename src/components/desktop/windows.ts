"use client";

// The window manager's state: which windows are open, where, in what order, and which page
// each one shows. Windows are unique by key (one per app, one per video or client folder), so
// opening something already open brings its window forward.

export type Zoom = "max" | "left" | "right" | null;

export type Rect = { x: number; y: number; w: number; h: number };

export type Win = {
  // `id` is the window's key (it can change: a "New client" window becomes that client's);
  // `uid` never changes, so the window's content keeps its state.
  id: string;
  uid: string;
  appId: string | null;
  doc: boolean;
  // The page the window shows (or is loading), and the pages before and after it.
  path: string;
  back: string[];
  ahead: string[];
  // The page's title, from the document title while it's the router's page.
  title: string;
  // The window's own frame; a zoomed or tiled window keeps it to return to.
  x: number;
  y: number;
  w: number;
  h: number;
  zoom: Zoom;
  minimized: boolean;
  z: number;
  openedAt: number;
};

// The part of the screen windows live in: under the menu bar, above the Dock.
export type Area = { w: number; h: number; top: number; bottom: number };

export type State = { wins: Win[]; top: number; focused: string | null };

export type Nav = "push" | "back" | "forward" | "stay";

export type Action =
  // A page arrived (or is about to) in a window: create it, or move it to that page.
  | { type: "show"; id: string; appId: string | null; doc: boolean; path: string; title: string; frame: Rect; nav: Nav }
  | { type: "focus"; id: string }
  // A window takes another key (and page), e.g. the "New client" form becomes the client's window.
  | { type: "rekey"; from: string; to: string; appId: string | null; doc: boolean }
  | { type: "desktop" }
  | { type: "close"; id: string }
  | { type: "minimize"; id: string }
  | { type: "minimizeAll" }
  | { type: "zoom"; id: string; zoom: Zoom }
  | { type: "place"; id: string; rect: Rect }
  | { type: "title"; id: string; title: string }
  | { type: "restore"; wins: Win[] }
  | { type: "fit"; area: Area };

export const MIN_W = 460;
export const MIN_H = 320;
const GAP = 10;

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Keep a frame usable after the screen changed size: on screen, at least partly.
export function fitRect(r: Rect, area: Area): Rect {
  const w = clamp(r.w, Math.min(MIN_W, area.w - GAP * 2), Math.max(MIN_W, area.w - GAP * 2));
  const h = clamp(r.h, Math.min(MIN_H, area.bottom - area.top - GAP), Math.max(MIN_H, area.bottom - area.top - GAP));
  const x = clamp(r.x, GAP - w + 140, area.w - 140);
  const y = clamp(r.y, area.top + 4, Math.max(area.top + 4, area.bottom - 60));
  return { x, y, w, h };
}

// Where a zoomed or tiled window sits.
export function zoomRect(zoom: Exclude<Zoom, null>, area: Area): Rect {
  const top = area.top + 6;
  const h = area.bottom - top;
  if (zoom === "max") return { x: GAP, y: top, w: area.w - GAP * 2, h };
  const w = Math.floor((area.w - GAP * 3) / 2);
  return { x: zoom === "left" ? GAP : GAP * 2 + w, y: top, w, h };
}

export const frameOf = (win: Win, area: Area): Rect => (win.zoom ? zoomRect(win.zoom, area) : { x: win.x, y: win.y, w: win.w, h: win.h });

// A new window's frame: where this kind of window was last left, else centred, cascading.
export function newFrame(size: [number, number], area: Area, open: number, remembered: Rect | null): Rect {
  const step = (open % 6) * 30;
  if (remembered) return fitRect({ ...remembered, x: remembered.x + (open ? step : 0), y: remembered.y + (open ? step : 0) }, area);
  // Centred, a little above the middle like macOS, fully on screen; later ones cascade.
  const w = Math.min(size[0], area.w - GAP * 4 - step);
  const h = Math.min(size[1], area.bottom - area.top - 20 - step);
  const x = clamp(Math.round((area.w - w) / 2) + step, GAP * 2, Math.max(GAP * 2, area.w - w - GAP * 2));
  const y = clamp(area.top + Math.max(10, Math.round((area.bottom - area.top - h) / 3)) + step, area.top + 6, Math.max(area.top + 6, area.bottom - h));
  return fitRect({ x, y, w, h }, area);
}

let uids = 0;
const newUid = () => `w${Date.now().toString(36)}${(uids++).toString(36)}`;

// The window that takes focus when the focused one goes away.
function nextFocus(wins: Win[], except: string | null) {
  let best: Win | null = null;
  for (const w of wins) if (w.id !== except && !w.minimized && (!best || w.z > best.z)) best = w;
  return best?.id ?? null;
}

// z-orders climb with every focus; renumber them now and then so they stay small.
function compact(state: State): State {
  if (state.top < 4000) return state;
  const order = [...state.wins].sort((a, b) => a.z - b.z).map((w) => w.id);
  return { ...state, top: order.length, wins: state.wins.map((w) => ({ ...w, z: order.indexOf(w.id) + 1 })) };
}

export function reducer(state: State, action: Action): State {
  return compact(step(state, action));
}

function step(state: State, action: Action): State {
  const top = state.top + 1;
  const patch = (id: string, p: Partial<Win>) => ({ ...state, wins: state.wins.map((w) => (w.id === id ? { ...w, ...p } : w)) });
  switch (action.type) {
    case "show": {
      const existing = state.wins.find((w) => w.id === action.id);
      if (!existing) {
        const win: Win = {
          id: action.id,
          uid: newUid(),
          appId: action.appId,
          doc: action.doc,
          path: action.path,
          back: [],
          ahead: [],
          title: action.title,
          ...action.frame,
          zoom: null,
          minimized: false,
          z: top,
          openedAt: Date.now(),
        };
        return { top, focused: action.id, wins: [...state.wins, win] };
      }
      let { back, ahead } = existing;
      if (existing.path !== action.path) {
        if (action.nav === "back") {
          back = back.slice(0, -1);
          ahead = [existing.path, ...ahead].slice(0, 30);
        } else if (action.nav === "forward") {
          ahead = ahead.slice(1);
          back = [...back, existing.path].slice(-30);
        } else if (action.nav === "push") {
          back = [...back, existing.path].slice(-30);
          ahead = [];
        }
        // Back never leads to the page already shown (a page that changed its own address).
        if (back.at(-1) === action.path) back = back.slice(0, -1);
      }
      return {
        top,
        focused: action.id,
        wins: state.wins.map((w) => (w.id === action.id ? { ...w, path: action.path, back, ahead, minimized: false, z: top } : w)),
      };
    }
    case "focus": {
      const win = state.wins.find((w) => w.id === action.id);
      if (!win) return state;
      if (state.focused === action.id && win.z === state.top && !win.minimized) return state;
      return { top, focused: action.id, wins: state.wins.map((w) => (w.id === action.id ? { ...w, z: top, minimized: false } : w)) };
    }
    case "rekey": {
      if (!state.wins.some((w) => w.id === action.from) || state.wins.some((w) => w.id === action.to)) return state;
      return {
        ...state,
        focused: state.focused === action.from ? action.to : state.focused,
        wins: state.wins.map((w) => (w.id === action.from ? { ...w, id: action.to, appId: action.appId, doc: action.doc, back: [], ahead: [] } : w)),
      };
    }
    case "desktop":
      return state.focused === null ? state : { ...state, focused: null };
    case "close": {
      const wins = state.wins.filter((w) => w.id !== action.id);
      return { ...state, wins, focused: state.focused === action.id ? nextFocus(wins, null) : state.focused };
    }
    case "minimize": {
      const wins = state.wins.map((w) => (w.id === action.id ? { ...w, minimized: true } : w));
      return { ...state, wins, focused: state.focused === action.id ? nextFocus(wins, action.id) : state.focused };
    }
    case "minimizeAll":
      return { ...state, focused: null, wins: state.wins.map((w) => ({ ...w, minimized: true })) };
    case "zoom":
      return { top, focused: action.id, wins: state.wins.map((w) => (w.id === action.id ? { ...w, zoom: action.zoom, z: top, minimized: false } : w)) };
    case "place":
      return patch(action.id, { ...action.rect, zoom: null });
    case "title": {
      const win = state.wins.find((w) => w.id === action.id);
      return !win || win.title === action.title ? state : patch(action.id, { title: action.title });
    }
    case "restore": {
      const known = new Set(state.wins.map((w) => w.id));
      const wins = [...action.wins.filter((w) => !known.has(w.id)), ...state.wins];
      const z = wins.reduce((m, w) => Math.max(m, w.z), state.top);
      return { ...state, top: z, wins };
    }
    case "fit":
      return { ...state, wins: state.wins.map((w) => ({ ...w, ...fitRect(w, action.area) })) };
  }
}

// ---------------------------------------------------------------- remembered between visits

const SESSION = "magik.windows.v2";
const GEOMETRY = "magik.geometry.v2";

// What a window keeps between visits: where it was and what it showed. Windows come back
// minimized in the Dock and load when they're opened again.
type Saved = Pick<Win, "id" | "appId" | "doc" | "path" | "title" | "x" | "y" | "w" | "h" | "zoom" | "z">;

export function saveSession(userId: string, wins: Win[]) {
  try {
    const saved: Saved[] = wins.slice(-16).map(({ id, appId, doc, path, title, x, y, w, h, zoom, z }) => ({ id, appId, doc, path, title, x, y, w, h, zoom, z }));
    localStorage.setItem(`${SESSION}.${userId}`, JSON.stringify(saved));
  } catch {}
}

export function loadSession(userId: string): Win[] {
  try {
    const saved = JSON.parse(localStorage.getItem(`${SESSION}.${userId}`) ?? "[]") as Saved[];
    if (!Array.isArray(saved)) return [];
    return saved
      .filter((s) => s && typeof s.id === "string" && typeof s.path === "string" && s.path.startsWith("/"))
      .map((s) => ({ ...s, uid: newUid(), back: [], ahead: [], minimized: true, openedAt: 0 }));
  } catch {
    return [];
  }
}

// Where each kind of window was last left: apps by their key, documents by their app.
export const geometryKey = (win: Pick<Win, "id" | "appId" | "doc">) => (win.doc ? `doc:${win.appId ?? "page"}` : win.id);

export function rememberGeometry(userId: string, key: string, rect: Rect) {
  try {
    const all = JSON.parse(localStorage.getItem(`${GEOMETRY}.${userId}`) ?? "{}") as Record<string, Rect>;
    all[key] = rect;
    localStorage.setItem(`${GEOMETRY}.${userId}`, JSON.stringify(all));
  } catch {}
}

export function recallGeometry(userId: string, key: string): Rect | null {
  try {
    const all = JSON.parse(localStorage.getItem(`${GEOMETRY}.${userId}`) ?? "{}") as Record<string, Rect>;
    const r = all[key];
    return r && [r.x, r.y, r.w, r.h].every((n) => typeof n === "number" && Number.isFinite(n)) ? r : null;
  } catch {
    return null;
  }
}
