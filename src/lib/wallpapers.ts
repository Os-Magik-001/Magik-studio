// The desktop pictures (public/wallpapers/<id>.webp, thumbnails in thumbs/). `base` shows while
// the picture loads, `glow` paints a soft light over it until then. "matrix" is live, drawn in
// the browser; "dynamic" follows the time of day.

export type WallpaperTone = "gold" | "warm" | "cool" | "neutral";

export type Wallpaper = { id: string; name: string; tone: WallpaperTone; base: string; glow: string; live?: boolean; image?: boolean };

export const WALLPAPERS: Wallpaper[] = [
  { id: "magik", name: "Magik Gold", tone: "gold", base: "#050403", glow: "#f6d43a", image: true },
  { id: "obsidian", name: "Obsidian", tone: "gold", base: "#070605", glow: "#f4c24a", image: true },
  { id: "silk", name: "Gold Silk", tone: "gold", base: "#040101", glow: "#f0b232", image: true },
  { id: "eclipse", name: "Eclipse", tone: "gold", base: "#030201", glow: "#f0a830", image: true },
  { id: "dunes", name: "Dunes", tone: "gold", base: "#180d0f", glow: "#e9a948", image: true },
  { id: "midnight", name: "Midnight", tone: "cool", base: "#04040c", glow: "#5e5ce6", image: true },
  { id: "ocean", name: "Night Sea", tone: "cool", base: "#051121", glow: "#8fb0f0", image: true },
  { id: "aurora", name: "Aurora", tone: "cool", base: "#020408", glow: "#2ee8a0", image: true },
  { id: "nebula", name: "Nebula", tone: "cool", base: "#040513", glow: "#8a52f0", image: true },
  { id: "ember", name: "Ember", tone: "warm", base: "#0a0303", glow: "#ff453a", image: true },
  { id: "crimson", name: "Crimson", tone: "warm", base: "#190308", glow: "#e8382c", image: true },
  { id: "glass", name: "Rose Glass", tone: "warm", base: "#160623", glow: "#ea5a92", image: true },
  { id: "graphite", name: "Graphite", tone: "neutral", base: "#0d0e10", glow: "#c8ccd4", image: true },
  { id: "dynamic", name: "Dynamic", tone: "gold", base: "#050403", glow: "#f6d43a" },
  { id: "matrix", name: "Matrix (live)", tone: "gold", base: "#000000", glow: "#f6d43a", live: true },
];

export const DEFAULT_WALLPAPER = "magik";

export const wallpaperById = (id: string | undefined | null) => WALLPAPERS.find((w) => w.id === id) ?? WALLPAPERS[0];

// "Dynamic": the picture for the hour: dunes in the morning, gold silk by day, crimson hills in
// the evening, midnight at night.
export function dynamicWallpaper(hour: number): Wallpaper {
  if (hour >= 6 && hour < 10) return wallpaperById("dunes");
  if (hour >= 10 && hour < 17) return wallpaperById("silk");
  if (hour >= 17 && hour < 21) return wallpaperById("crimson");
  return wallpaperById("midnight");
}

// The picture a wallpaper choice shows right now.
export function resolveWallpaper(id: string | undefined | null, hour = new Date().getHours()): Wallpaper {
  const w = wallpaperById(id);
  return w.id === "dynamic" ? dynamicWallpaper(hour) : w;
}

export const wallpaperUrl = (w: Wallpaper) => (w.image ? `/wallpapers/${w.id}.webp` : null);
export const wallpaperThumb = (w: Wallpaper) => (w.image ? `/wallpapers/thumbs/${w.id}.webp` : null);
