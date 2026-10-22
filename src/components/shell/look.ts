"use client";

import { resolveWallpaper, wallpaperUrl } from "@/lib/wallpapers";
import { DOCK_SIZES, type DockSize, type Look } from "@/lib/preferences";

export type { Look } from "@/lib/preferences";

// The desktop's look (Settings > Appearance): the wallpaper, how dark it is, the Dock's size and
// labels, glass or solid windows. Applied to <html> as data attributes and CSS variables, kept in
// this browser (so the next page paints it at once, see the script in app/layout.tsx) and in the
// person's settings (so it follows them to another computer).

export const LOOK_KEY = "magik.look";
export const LOOK_EVENT = "magik:look";

const hexToRgba = (hex: string, a: number) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export function applyLook(look: Look) {
  const html = document.documentElement;
  const w = resolveWallpaper(look.wallpaper);
  const url = wallpaperUrl(w);
  const resolved = { id: w.id, url: url ? `url(${url})` : "none", base: w.base, glow: hexToRgba(w.glow, w.live ? 0.14 : 0.3) };
  html.dataset.wallpaper = w.id;
  html.style.setProperty("--wall-url", resolved.url);
  html.style.setProperty("--wall-base", resolved.base);
  html.style.setProperty("--wall-glow", resolved.glow);
  html.style.setProperty("--wall-dim", String((look.dim ?? 0) / 100));
  html.dataset.dock = look.dock ?? "large";
  html.dataset.labels = look.labels === false ? "off" : "on";
  html.dataset.solid = look.solid ? "1" : "0";
  try {
    localStorage.setItem(LOOK_KEY, JSON.stringify({ ...look, r: resolved }));
  } catch {}
  window.dispatchEvent(new Event(LOOK_EVENT));
}

export function readLocalLook(): Look | null {
  try {
    const raw = JSON.parse(localStorage.getItem(LOOK_KEY) ?? "null") as (Look & { r?: unknown }) | null;
    if (raw && typeof raw === "object") {
      const { r: _resolved, ...look } = raw;
      void _resolved;
      return look;
    }
    // Before Appearance had more than a wallpaper.
    const legacy = localStorage.getItem("magik.wallpaper");
    return legacy ? { wallpaper: legacy } : null;
  } catch {
    return null;
  }
}

export const dockSize = (v: string | undefined): DockSize => ((DOCK_SIZES as readonly string[]).includes(v ?? "") ? (v as DockSize) : "large");
