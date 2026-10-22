"use client";

import { useRef, useState } from "react";
import { Check, Clock } from "lucide-react";
import { WALLPAPERS, resolveWallpaper, wallpaperThumb, wallpaperUrl, type Wallpaper } from "@/lib/wallpapers";
import type { DockSize } from "@/lib/preferences";
import { cx } from "@/components/ui";
import { Choice, Switch } from "@/components/switch";
import { SettingsGroup, SettingsRow } from "@/components/settings/settings-shell";
import { applyLook, type Look } from "@/components/shell/look";
import { savePreferences } from "@/app/actions/account";

function preview(w: Wallpaper) {
  if (w.live) return "repeating-linear-gradient(90deg, rgba(246,212,58,0.2) 0 2px, transparent 2px 14px), #000";
  if (w.id === "dynamic") {
    const now = resolveWallpaper("dynamic");
    const url = wallpaperThumb(now);
    return url ? `url(${url}) center/cover, url(${wallpaperUrl(now)}) center/cover, ${now.base}` : now.base;
  }
  const thumb = wallpaperThumb(w);
  return thumb ? `url(${thumb}) center/cover, url(${wallpaperUrl(w)}) center/cover, ${w.base}` : w.base;
}

// Settings > Appearance: every change shows on the desktop at once and is saved to the account.
export function AppearanceSettings({ initial }: { initial: Look }) {
  const [look, setLook] = useState<Look>(initial);
  const saving = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Look>({});

  const update = (patch: Look) => {
    const next = { ...look, ...patch };
    setLook(next);
    applyLook(next);
    pending.current = { ...pending.current, ...patch };
    if (saving.current) clearTimeout(saving.current);
    saving.current = setTimeout(() => {
      const p = pending.current;
      pending.current = {};
      savePreferences(p).catch(() => {});
    }, 500);
  };

  const current = look.wallpaper ?? "magik";
  return (
    <>
      <SettingsGroup title="Wallpaper" description="Dynamic changes with the time of day. Matrix is live.">
        <div role="radiogroup" aria-label="Wallpaper" className="grid grid-cols-2 gap-3 p-4 @min-[40rem]:grid-cols-3 @min-[64rem]:grid-cols-4">
          {WALLPAPERS.map((w) => {
            const on = current === w.id;
            return (
              <button key={w.id} type="button" role="radio" aria-checked={on} onClick={() => update({ wallpaper: w.id })} className="group flex flex-col gap-1.5 text-left">
                <span
                  className={cx(
                    "relative block aspect-[16/10] w-full overflow-hidden rounded-[12px] transition-shadow",
                    on ? "shadow-[0_0_0_2.5px_var(--accent)]" : "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] group-hover:shadow-[0_0_0_2px_rgba(255,255,255,0.35)]",
                  )}
                  style={{ background: preview(w) }}
                >
                  {w.id === "dynamic" && (
                    <span className="absolute top-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white">
                      <Clock size={12} aria-hidden />
                    </span>
                  )}
                  {on && (
                    <span className="absolute right-1.5 bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-black">
                      <Check size={12} strokeWidth={3} aria-hidden />
                    </span>
                  )}
                </span>
                <span className="text-[12.5px] text-ink-2">{w.name}</span>
              </button>
            );
          })}
        </div>
        <SettingsRow label="Dim the wallpaper" hint="Darker behind the windows and Home's panels.">
          <span className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={60}
              step={5}
              value={look.dim ?? 0}
              onChange={(e) => update({ dim: Number(e.target.value) })}
              aria-label="Dim the wallpaper"
              className="w-40 accent-[var(--accent)]"
            />
            <span className="w-9 text-right text-[12.5px] text-muted tabular-nums">{look.dim ?? 0}%</span>
          </span>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Dock">
        <SettingsRow label="Size">
          <Choice<DockSize>
            label="Dock size"
            value={look.dock ?? "large"}
            onChange={(dock) => update({ dock })}
            options={[
              { value: "large", label: "Large" },
              { value: "medium", label: "Medium" },
              { value: "small", label: "Small" },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Show app names" hint="The names under the Dock's icons.">
          <Switch label="Show app names" checked={look.labels !== false} onChange={(labels) => update({ labels })} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Windows">
        <SettingsRow label="Glass windows" hint="See the wallpaper through the windows. Off: solid windows, a little faster on older computers.">
          <Switch label="Glass windows" checked={!look.solid} onChange={(glass) => update({ solid: !glass })} />
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}
