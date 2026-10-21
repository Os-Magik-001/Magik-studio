"use client";

import { useEffect, useState } from "react";
import { Matrix } from "@/components/matrix";

export const WALLPAPERS = [
  { id: "magik", name: "Magik Gold" },
  { id: "midnight", name: "Midnight" },
  { id: "ember", name: "Ember" },
  { id: "matrix", name: "Matrix (live)" },
] as const;

export type WallpaperId = (typeof WALLPAPERS)[number]["id"];

const KEY = "magik.wallpaper";

export function setWallpaper(id: WallpaperId) {
  document.documentElement.dataset.wallpaper = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {}
  window.dispatchEvent(new CustomEvent("magik:wallpaper", { detail: id }));
}

// The desktop picture. The root layout's script sets data-wallpaper before the first paint,
// so the right picture shows at once; the CSS picks the image.
export function Wallpaper() {
  const [live, setLive] = useState(false);
  useEffect(() => {
    const sync = () => setLive(document.documentElement.dataset.wallpaper === "matrix");
    sync();
    window.addEventListener("magik:wallpaper", sync);
    return () => window.removeEventListener("magik:wallpaper", sync);
  }, []);
  return (
    <div aria-hidden className="wallpaper pointer-events-none fixed inset-0 -z-10">
      {live && (
        <div className="absolute inset-0 opacity-60">
          <Matrix variant="field" />
        </div>
      )}
    </div>
  );
}
