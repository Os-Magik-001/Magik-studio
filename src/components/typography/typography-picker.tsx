"use client";

import { useId, useState } from "react";
import { ColorField } from "@/components/color-field";
import { cx } from "@/components/ui";
import { COLOR_ROLES, FONT_ROLES, TYPE_FONTS, TYPE_PRESETS, sameTypography, type FontRole, type Typography } from "@/lib/typography";
import { typeFontStyle } from "./type-fonts";

// Fonts and colors for an edit, picked before launching it: start from the client's brand kit
// or a preset, then change any font or color. The preview sets the video's own title the way
// the engine will, over a dark frame. The choice posts as one hidden field (JSON).

// The video's title as a brand guide would set it: the longest word after the first in the
// accent face, the words around it in the title face.
function sampleOf(title: string) {
  const words = title.replace(/[|–—:]+/g, " ").split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 7 || title.length > 44) return { top: "How I built", accent: "my dream", bottom: "business" };
  const at = words.reduce((best, w, i) => (i > 0 && w.length > words[best].length ? i : best), 1);
  return { top: words.slice(0, at).join(" "), accent: words[at], bottom: words.slice(at + 1).join(" ") };
}

// A phone frame of the video: the client's name in a box, the title where the engine puts it
// (upper third), a caption in the lower third.
function Preview({ value, title, clientName }: { value: Typography; title: string; clientName: string }) {
  const s = sampleOf(title);
  const { colors } = value;
  const titleLine = { ...typeFontStyle("title", value.fonts.title), color: colors.title, fontSize: "min(17cqw, 46px)", lineHeight: 1, textTransform: "uppercase" } as const;
  return (
    <div
      aria-hidden
      className="@container relative aspect-[4/3] w-full overflow-hidden rounded-[14px] text-center shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.14)] @2xl:aspect-[9/16]"
      style={{ background: "radial-gradient(120% 75% at 50% 35%, #3b3f46 0%, #25272c 55%, #141518 100%)" }}
    >
      {clientName && (
        <span
          className="absolute top-[7%] left-1/2 max-w-[80%] -translate-x-1/2 truncate rounded-full px-[3.4cqw] py-[1.3cqw] text-[min(5cqw,13px)]"
          style={{ ...typeFontStyle("text", value.fonts.text), background: colors.background, color: colors.text }}
        >
          {clientName}
        </span>
      )}
      <div className="absolute inset-x-[6%] top-[19%] flex flex-col items-center @2xl:top-[22%]">
        {s.top && <span className="max-w-full break-words" style={titleLine}>{s.top}</span>}
        <span className="max-w-full break-words" style={{ ...typeFontStyle("accent", value.fonts.accent), color: colors.accent, fontSize: "min(19cqw, 52px)", lineHeight: 1.08 }}>
          {s.accent}
        </span>
        {s.bottom && <span className="max-w-full break-words" style={titleLine}>{s.bottom}</span>}
        <svg viewBox="0 0 120 12" className="mt-[2.5cqw] w-[46cqw] max-w-[160px]" fill="none">
          <path d="M3 8.5C28 3.5 70 2 117 5.5" stroke={colors.highlight} strokeWidth="4.5" strokeLinecap="round" />
        </svg>
      </div>
      <p className="absolute inset-x-[8%] bottom-[9%] text-[min(7.6cqw,20px)] leading-tight @2xl:bottom-[24%]" style={{ ...typeFontStyle("text", value.fonts.text), color: colors.text, textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}>
        Every caption looks <span style={{ color: colors.highlight }}>like this</span>
      </p>
    </div>
  );
}

const optionBox =
  "flex h-full flex-col items-center justify-center gap-1 rounded-[12px] border border-white/10 bg-white/[0.04] px-1.5 py-2 transition-[background-color,border-color,box-shadow] duration-150 hover:border-white/25 hover:bg-white/[0.08] peer-checked:border-accent/80 peer-checked:bg-accent-soft peer-checked:shadow-[0_0_0_1px_rgba(246,212,58,0.5)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent/80";

function FontRow({ role, label, hint, value, onChange }: { role: FontRole; label: string; hint: string; value: string; onChange: (id: string) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <p id={id} className="text-[13px] font-medium text-ink-2">
        {label} <span className="font-normal text-muted">· {hint}</span>
      </p>
      <div role="radiogroup" aria-labelledby={id} className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
        {TYPE_FONTS[role].map((f) => (
          <label key={f.id} className="relative block cursor-pointer" title={f.name}>
            <input type="radio" name={`${id}-font`} checked={value === f.id} onChange={() => onChange(f.id)} aria-label={f.name} className="peer sr-only" />
            <span className={optionBox}>
              <span className="text-[24px] leading-none text-ink" style={typeFontStyle(role, f.id)}>
                {role === "title" ? "AB" : "Ag"}
              </span>
              <span className="max-w-full truncate text-[11px] text-muted">{f.name}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function TypographyPicker({
  initial,
  brandKit,
  title,
  clientName,
  name = "typography",
}: {
  initial: Typography;
  // The client's brand kit as a starting point, when it has fonts or colors.
  brandKit: Typography | null;
  title: string;
  clientName: string;
  name?: string;
}) {
  const id = useId();
  const [value, setValue] = useState(initial);
  const presets = [...(brandKit ? [{ id: "kit", name: "Brand kit", typography: brandKit }] : []), ...TYPE_PRESETS];

  return (
    <section aria-labelledby={id} className="@container flex flex-col gap-4 rounded-[16px] border border-white/[0.08] bg-white/[0.035] p-4">
      <input type="hidden" name={name} value={JSON.stringify(value)} />
      <div className="flex flex-col gap-0.5">
        <h3 id={id} className="text-[14px] font-semibold text-ink">
          Fonts &amp; colors
        </h3>
        <p className="text-xs text-muted">Every caption, title and card of the edit uses them.</p>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Start from">
        {presets.map((p) => {
          const on = sameTypography(value, p.typography);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => setValue(p.typography)}
              className={cx(
                "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[12.5px] font-medium transition-colors",
                on ? "border-accent/80 bg-accent-soft text-ink" : "border-white/10 bg-white/[0.04] text-ink-2 hover:border-white/25 hover:text-ink",
              )}
            >
              <span className="flex -space-x-1" aria-hidden>
                {[p.typography.colors.title, p.typography.colors.highlight, p.typography.colors.background].map((c, i) => (
                  <span key={i} className="size-3 rounded-full shadow-[0_0_0_1.5px_rgba(20,20,22,0.9)]" style={{ background: c }} />
                ))}
              </span>
              {p.name}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 @2xl:grid-cols-[230px_1fr]">
        <div className="mx-auto w-full max-w-[360px] @2xl:max-w-none">
          <Preview value={value} title={title} clientName={clientName} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {FONT_ROLES.map((r) => (
            <FontRow key={r.id} role={r.id} label={r.label} hint={r.hint} value={value.fonts[r.id]} onChange={(f) => setValue((v) => ({ ...v, fonts: { ...v.fonts, [r.id]: f } }))} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @3xl:grid-cols-5">
        {COLOR_ROLES.map((r) => (
          <ColorField key={r.id} label={r.label} hint={"hint" in r ? r.hint : undefined} value={value.colors[r.id]} onChange={(hex) => setValue((v) => ({ ...v, colors: { ...v.colors, [r.id]: hex } }))} />
        ))}
      </div>
    </section>
  );
}
