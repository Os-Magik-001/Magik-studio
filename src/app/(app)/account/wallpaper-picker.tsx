"use client";

import { Check } from "lucide-react";
import { cx } from "@/components/ui";
import { useStoredValue } from "@/components/use-now";
import { WALLPAPERS, type WallpaperId } from "@/components/desktop/wallpaper";

const PREVIEW: Record<WallpaperId, string> = {
  magik: "url(/wallpapers/magik.webp), radial-gradient(120% 90% at 18% 8%, rgba(246,212,58,0.4), transparent 55%), #0a0703",
  midnight: "url(/wallpapers/midnight.webp), radial-gradient(110% 90% at 20% 10%, rgba(94,92,230,0.5), transparent 58%), #05050f",
  ember: "url(/wallpapers/ember.webp), radial-gradient(110% 90% at 15% 20%, rgba(255,69,58,0.55), transparent 58%), #0a0303",
  matrix: "repeating-linear-gradient(90deg, rgba(246,212,58,0.18) 0 2px, transparent 2px 14px), #000",
};

// The desktop picture: saved in this browser, applied to the desktop at once.
export function WallpaperPicker() {
  const current = useStoredValue("magik.wallpaper", "magik", "magik:wallpaper");
  const pick = (id: WallpaperId) => {
    try {
      localStorage.setItem("magik.wallpaper", id);
    } catch {}
    window.dispatchEvent(new Event("magik:wallpaper"));
    window.parent.postMessage({ type: "magik:wallpaper", id }, location.origin);
  };
  return (
    <div role="radiogroup" aria-label="Wallpaper" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {WALLPAPERS.map((w) => (
        <button key={w.id} type="button" role="radio" aria-checked={current === w.id} onClick={() => pick(w.id)} className="group flex flex-col gap-1.5 text-left">
          <span
            className={cx(
              "relative block aspect-[16/10] w-full rounded-[12px] bg-cover bg-center transition-shadow",
              current === w.id ? "shadow-[0_0_0_2.5px_var(--accent)]" : "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] group-hover:shadow-[0_0_0_2px_rgba(255,255,255,0.35)]",
            )}
            style={{ background: PREVIEW[w.id], backgroundSize: "cover" }}
          >
            {current === w.id && (
              <span className="absolute right-1.5 bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-black">
                <Check size={12} strokeWidth={3} aria-hidden />
              </span>
            )}
          </span>
          <span className="text-[12.5px] text-ink-2">{w.name}</span>
        </button>
      ))}
    </div>
  );
}
