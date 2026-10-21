"use client";

import { ArrowLeft, Ban, Check, LoaderCircle } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { Field } from "@/components/field";
import { Button, Input, cx } from "@/components/ui";
import {
  LOGO_FONTS,
  LOGO_PALETTES,
  LOGO_SYMBOLS,
  LOGO_TEMPLATES,
  cleanSpec,
  initialsOf,
  suggestLogos,
  type LogoFontId,
  type LogoSpec,
  type LogoSymbolId,
} from "@/lib/logo-templates";
import { drawLogo, logoFontsFor, logoSymbolArt, renderLogoPng } from "./draw-logo";
import {
  loadLogoFonts,
  logoFontFamily,
  logoFontStyle,
  logoFontsClassName,
  logoFontsVersion,
  subscribeLogoFonts,
} from "./logo-fonts";

// The logo creator of the setup assistant: a client without a brand picks one of six starting
// points, makes it theirs, and saves it as a transparent PNG.

export type LogoGround = "light" | "dark" | "clear";

const GROUND_CLASS: Record<LogoGround, string> = {
  light: "bg-white",
  dark: "bg-[#0c0c0e]",
  clear: "bg-white",
};

const CHECKER: CSSProperties = {
  backgroundImage: "conic-gradient(#e6e6eb 25%, transparent 0 50%, #e6e6eb 0 75%, transparent 0)",
  backgroundSize: "16px 16px",
};

const INITIALS_TEMPLATES = new Set<LogoSpec["template"]>(["monogram-circle", "monogram-tile", "emblem"]);

const templateName = (id: LogoSpec["template"]) => LOGO_TEMPLATES.find((t) => t.id === id)?.name ?? id;
const fontName = (id: LogoFontId) => LOGO_FONTS.find((f) => f.id === id)?.name ?? id;

// Every character the spec draws, so the right font subsets load.
function drawnText(spec: Pick<LogoSpec, "name" | "tagline" | "initials">) {
  return `${spec.name}${spec.name.toLocaleUpperCase()}${spec.tagline.toLocaleUpperCase()}${spec.initials}`;
}

function useFontsVersion() {
  return useSyncExternalStore(subscribeLogoFonts, logoFontsVersion, () => 0);
}

// ---------------------------------------------------------------- preview

/** A live canvas drawing of a LogoSpec, filling its box (give it a size or an aspect ratio). */
export function LogoPreview({
  spec,
  ground = "light",
  padding,
  className,
  label,
}: {
  spec: LogoSpec;
  ground?: LogoGround | null;
  padding?: number;
  className?: string;
  // The image's accessible name; "" hides it (when the surrounding control names it).
  label?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const version = useFontsVersion();
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const font = spec.font;
  const text = drawnText(spec);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setBox((b) => (b && b.w === r.width && b.h === r.height ? b : { w: r.width, h: r.height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    void loadLogoFonts(logoFontsFor({ font }), text);
  }, [font, text]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !box || !box.w || !box.h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.round(box.w * dpr);
    const h = Math.round(box.h * dpr);
    if (el.width !== w) el.width = w;
    if (el.height !== h) el.height = h;
    const ctx = el.getContext("2d");
    if (ctx) drawLogo(ctx, spec, { width: w, height: h }, logoFontFamily, { padding });
  }, [spec, box, version, padding]);

  return (
    <div
      className={cx("relative overflow-hidden", ground && GROUND_CLASS[ground], className)}
      style={ground === "clear" ? CHECKER : undefined}
    >
      <canvas
        ref={ref}
        className="absolute inset-0 h-full w-full"
        {...(label === "" ? { "aria-hidden": true } : { role: "img", "aria-label": label ?? `${spec.name} logo` })}
      />
    </div>
  );
}

function SymbolIcon({ id, className }: { id: LogoSymbolId; className?: string }) {
  const art = logoSymbolArt(id);
  if (!art) return null;
  return (
    <svg viewBox={art.viewBox} className={className} aria-hidden fill="currentColor">
      {art.parts.map((p, i) =>
        p.stroke ? (
          <path
            key={i}
            d={p.d}
            fill="none"
            stroke="currentColor"
            strokeWidth={p.stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path key={i} d={p.d} fillRule={p.rule ?? "nonzero"} />
        ),
      )}
    </svg>
  );
}

// ---------------------------------------------------------------- small controls

// A segmented control (radio group) for the preview ground.
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-white/10 bg-white/[0.06] p-0.5">
      {options.map(([v, text]) => (
        <label key={v} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={v}
            checked={value === v}
            onChange={() => onChange(v)}
            className="peer sr-only"
          />
          <span className="block rounded-full px-3 py-1 text-[12.5px] font-medium text-muted transition-colors peer-checked:bg-white/[0.16] peer-checked:text-ink peer-checked:shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] peer-focus-visible:outline-2 peer-focus-visible:outline-accent/80 hover:text-ink">
            {text}
          </span>
        </label>
      ))}
    </div>
  );
}

function Group({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section className="rounded-[16px] border border-white/[0.08] bg-white/[0.035] p-4" aria-labelledby={id}>
      <h3 id={id} className="mb-3 text-[11.5px] font-semibold tracking-[0.08em] text-muted uppercase">
        {title}
      </h3>
      <div className="flex flex-col gap-3.5">{children}</div>
    </section>
  );
}

// One option of a radio group: the input is visually hidden, its sibling shows the state.
function Choice({
  name,
  checked,
  onChange,
  label,
  className,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cx("relative block cursor-pointer", className)} title={label}>
      <input type="radio" name={name} checked={checked} onChange={onChange} aria-label={label} className="peer sr-only" />
      {children}
    </label>
  );
}

const choiceBox =
  "border border-white/10 bg-white/[0.04] transition-[background-color,border-color,box-shadow] duration-150 hover:border-white/25 hover:bg-white/[0.08] peer-checked:border-accent/80 peer-checked:bg-accent-soft peer-checked:shadow-[0_0_0_1px_rgba(246,212,58,0.5)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent/80";

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-[24px] w-[42px] shrink-0 rounded-full bg-white/[0.16] shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)] transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent/80 after:absolute after:top-[2px] after:left-[2px] after:size-5 after:rounded-full after:bg-white after:shadow-[0_1px_3px_rgba(0,0,0,0.4)] after:transition-transform peer-checked:after:translate-x-[18px]"
      />
    </label>
  );
}

const HEX = /^#?[0-9a-f]{6}$/i;

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const id = useId();
  const [text, setText] = useState(value);
  const [shown, setShown] = useState(value);
  // A new colour from outside (a palette chip): show it in the hex field.
  if (shown !== value) {
    setShown(value);
    setText(value);
  }
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      <div className="flex h-9 items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.055] pr-2 pl-1.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)] focus-within:border-accent/70 focus-within:shadow-[0_0_0_3px_rgba(246,212,58,0.22)]">
        <input
          id={id}
          type="color"
          value={value.toLowerCase()}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="size-6 shrink-0 cursor-pointer rounded-[6px] border-0 bg-transparent p-0 [&::-moz-color-swatch]:rounded-[6px] [&::-webkit-color-swatch]:rounded-[6px] [&::-webkit-color-swatch]:border-white/20 [&::-webkit-color-swatch-wrapper]:p-0"
        />
        <input
          type="text"
          aria-label={`${label}, hex code`}
          value={text}
          spellCheck={false}
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value.trim();
            setText(v);
            if (HEX.test(v)) onChange(`#${v.replace("#", "")}`.toUpperCase());
          }}
          onBlur={() => setText(value)}
          className="w-full min-w-0 bg-transparent font-mono text-[12.5px] text-ink uppercase outline-none"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the creator

export function LogoCreator({
  brandName,
  suggestions,
  onSave,
  onBack,
  initial,
}: {
  brandName: string;
  suggestions: LogoSpec[];
  onSave: (png: Blob, spec: LogoSpec) => Promise<{ error?: string }>;
  onBack?: () => void;
  initial?: LogoSpec | null;
}) {
  const ideas = useMemo(() => {
    const list = suggestions.length ? suggestions : suggestLogos(brandName);
    return list.map((s) => cleanSpec(s, brandName));
  }, [suggestions, brandName]);

  const [step, setStep] = useState<"pick" | "edit">(initial ? "edit" : "pick");
  const [draft, setDraft] = useState<LogoSpec>(() => cleanSpec(initial ?? ideas[0], brandName));
  const [edited, setEdited] = useState(!!initial); // has the person been in the editor
  const [textEdited, setTextEdited] = useState(false);
  const [initialsTouched, setInitialsTouched] = useState(false);
  const [gridGround, setGridGround] = useState<"light" | "dark">("light");
  const [ground, setGround] = useState<LogoGround>("light");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const spec = useMemo(() => cleanSpec(draft, brandName), [draft, brandName]);
  const specKey = JSON.stringify(spec);

  // The font picker shows every face, and the thumbnails draw with them: load them all.
  useEffect(() => {
    void loadLogoFonts(
      LOGO_FONTS.map((f) => f.id),
      `${brandName}${brandName.toLocaleUpperCase()}`,
    );
  }, [brandName]);

  // After the person types their own words, the ideas show them too.
  const shownIdeas = useMemo(
    () =>
      textEdited
        ? ideas.map((s) => cleanSpec({ ...s, name: draft.name, tagline: draft.tagline, initials: draft.initials }, brandName))
        : ideas,
    [ideas, textEdited, draft.name, draft.tagline, draft.initials, brandName],
  );

  const thumbs = useMemo(() => LOGO_TEMPLATES.map((t) => ({ ...spec, template: t.id })), [spec]);

  function pick(idea: LogoSpec) {
    setDraft(idea);
    setStep("edit");
    setEdited(true);
    setError(null);
  }

  function update(patch: Partial<LogoSpec>) {
    setDraft((d) => ({ ...d, ...patch }));
    setError(null);
  }

  function updateColors(patch: Partial<LogoSpec["colors"]>) {
    setDraft((d) => ({ ...d, colors: { ...d.colors, ...patch } }));
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const final = cleanSpec(draft, brandName);
      await loadLogoFonts(logoFontsFor(final), drawnText(final));
      const png = await renderLogoPng(final, logoFontFamily);
      const res = await onSave(png, final);
      if (res?.error) setError(res.error);
      else setSaved(JSON.stringify(final));
    } catch {
      setError("The logo couldn't be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const ids = useId();

  if (step === "pick") {
    return (
      <div className={cx(logoFontsClassName, "flex flex-col gap-5")}>
        <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack} className="mb-2 -ml-2.5">
                <ArrowLeft className="size-4" aria-hidden />
                Back
              </Button>
            )}
            <h2 className="text-[22px] leading-tight font-semibold tracking-[-0.02em] text-ink">Pick a starting point</h2>
            <p className="mt-1 text-[13.5px] text-muted">
              Six ideas for {spec.name || "your brand"}. Choose one, then make it yours.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {edited && (
              <Button variant="secondary" size="sm" onClick={() => setStep("edit")}>
                Back to my logo
              </Button>
            )}
            <Segmented
              label="Preview background"
              value={gridGround}
              options={[
                ["light", "Light"],
                ["dark", "Dark"],
              ]}
              onChange={setGridGround}
            />
          </div>
        </header>

        <ul className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 lg:grid-cols-3">
          {shownIdeas.map((idea, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => pick(idea)}
                className="group flex w-full flex-col rounded-[18px] border border-white/10 bg-white/[0.04] p-2 text-left transition-[background-color,border-color,transform] duration-150 hover:border-white/25 hover:bg-white/[0.08] active:scale-[0.99]"
              >
                <LogoPreview
                  spec={idea}
                  ground={gridGround}
                  padding={0.15}
                  label=""
                  className="aspect-[4/3] w-full rounded-[12px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                />
                <span className="flex items-baseline justify-between gap-2 px-1.5 pt-2.5 pb-1">
                  <span className="text-[13.5px] font-medium text-ink">{templateName(idea.template)}</span>
                  <span className="truncate text-[12px] text-muted">{fontName(idea.font)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const showInitials = INITIALS_TEMPLATES.has(spec.template);
  const isSaved = saved === specKey;

  return (
    <div className={cx(logoFontsClassName, "flex flex-col gap-5")}>
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" onClick={() => setStep("pick")} className="mb-2 -ml-2.5">
            <ArrowLeft className="size-4" aria-hidden />
            All ideas
          </Button>
          <h2 className="text-[22px] leading-tight font-semibold tracking-[-0.02em] text-ink">Make it yours</h2>
          <p className="mt-1 text-[13.5px] text-muted">Change the words, the layout, the font and the colors.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,1fr)] lg:items-start lg:gap-5">
        {/* Preview and the save action: one sticky column on wide screens; on narrow ones the
            controls sit between them. */}
        <div className="contents lg:sticky lg:top-4 lg:flex lg:flex-col lg:gap-4">
          <section aria-label="Preview" className="order-1 overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.04]">
            <LogoPreview
              spec={spec}
              ground={ground}
              padding={0.16}
              label={`Preview of the ${spec.name} logo`}
              className="aspect-[4/3] w-full"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] px-3 py-2.5">
              <span className="text-[12.5px] text-muted">Background</span>
              <Segmented
                label="Preview background"
                value={ground}
                options={[
                  ["light", "Light"],
                  ["dark", "Dark"],
                  ["clear", "Transparent"],
                ]}
                onChange={setGround}
              />
            </div>
          </section>

          <div className="order-3 flex flex-col gap-2">
            {error && (
              <p role="alert" className="rounded-[12px] bg-danger-soft px-3 py-2 text-[13px] text-danger">
                {error}
              </p>
            )}
            <Button variant="primary" onClick={save} disabled={saving} className="h-11 w-full text-[14.5px]">
              {saving ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : isSaved ? (
                <>
                  <Check className="size-4" aria-hidden />
                  Saved
                </>
              ) : (
                "Use this logo"
              )}
            </Button>
            <p className="text-center text-[12px] text-muted" aria-live="polite">
              {isSaved
                ? "Your logo is saved."
                : spec.colors.background
                  ? "Saved as a high-resolution PNG on your background color."
                  : "Saved as a high-resolution PNG with a transparent background."}
            </p>
          </div>
        </div>

        <div className="order-2 flex min-w-0 flex-col gap-3 lg:order-none">
          <Group title="Words" id={`${ids}-words`}>
            <Field label="Brand name">
              <Input
                value={draft.name}
                maxLength={40}
                autoComplete="off"
                onChange={(e) => {
                  const name = e.target.value;
                  setTextEdited(true);
                  setDraft((d) => ({ ...d, name, initials: initialsTouched ? d.initials : initialsOf(name.trim() || brandName) }));
                }}
              />
            </Field>
            <Field label="Tagline" hint="Optional: a few words under the name.">
              <Input
                value={draft.tagline}
                maxLength={48}
                autoComplete="off"
                placeholder="Studio · Montréal"
                onChange={(e) => {
                  setTextEdited(true);
                  update({ tagline: e.target.value });
                }}
              />
            </Field>
            {showInitials && (
              <Field label="Initials" hint="1 to 3 letters.">
                <Input
                  value={draft.initials}
                  maxLength={3}
                  autoComplete="off"
                  className="uppercase"
                  onChange={(e) => {
                    setTextEdited(true);
                    setInitialsTouched(true);
                    update({ initials: e.target.value.toUpperCase() });
                  }}
                />
              </Field>
            )}
          </Group>

          <Group title="Layout" id={`${ids}-layout`}>
            <div role="radiogroup" aria-labelledby={`${ids}-layout`} className="grid grid-cols-3 gap-2">
              {LOGO_TEMPLATES.map((t, i) => (
                <Choice
                  key={t.id}
                  name={`${ids}-template`}
                  checked={spec.template === t.id}
                  onChange={() => update({ template: t.id })}
                >
                  <span className={cx(choiceBox, "flex flex-col gap-1 rounded-[12px] p-1")} title={t.hint}>
                    <LogoPreview spec={thumbs[i]} ground="light" padding={0.12} label="" className="aspect-[3/2] w-full rounded-[8px]" />
                    <span className="pb-0.5 text-center text-[12px] font-medium text-ink-2">{t.name}</span>
                  </span>
                </Choice>
              ))}
            </div>
          </Group>

          <Group title="Font" id={`${ids}-font`}>
            <div role="radiogroup" aria-labelledby={`${ids}-font`} className="@container grid grid-cols-2 gap-2">
              {LOGO_FONTS.map((f) => (
                <Choice key={f.id} name={`${ids}-fontpick`} checked={spec.font === f.id} onChange={() => update({ font: f.id })}>
                  <span className={cx(choiceBox, "flex h-[58px] flex-col justify-center rounded-[12px] px-2.5 @xs:px-3")}>
                    <span
                      className="truncate text-[length:clamp(12.5px,4.9cqw,17px)] leading-tight text-ink"
                      style={logoFontStyle(f.id)}
                    >
                      {f.name}
                    </span>
                    <span className="truncate text-[11.5px] text-muted">{f.feel.split(",").slice(0, 2).join(",")}</span>
                  </span>
                </Choice>
              ))}
            </div>
          </Group>

          <Group title="Symbol" id={`${ids}-symbol`}>
            <div role="radiogroup" aria-labelledby={`${ids}-symbol`} className="grid grid-cols-7 gap-1.5">
              {LOGO_SYMBOLS.map((s) => {
                const label = s.id === "none" ? (showInitials ? "Initials" : "No symbol") : s.name;
                return (
                  <Choice
                    key={s.id}
                    name={`${ids}-symbolpick`}
                    checked={spec.symbol === s.id}
                    onChange={() => update({ symbol: s.id })}
                    label={label}
                  >
                    <span className={cx(choiceBox, "grid aspect-square place-items-center rounded-[10px] text-ink")}>
                      {s.id !== "none" ? (
                        <SymbolIcon id={s.id} className="size-[55%]" />
                      ) : showInitials ? (
                        <span className="text-[12px] font-semibold tracking-tight">{spec.initials}</span>
                      ) : (
                        <Ban className="size-[45%] text-muted" aria-hidden />
                      )}
                    </span>
                  </Choice>
                );
              })}
            </div>
            {showInitials && spec.symbol !== "none" && (
              <p className="text-[12px] text-muted">The symbol takes the place of the initials.</p>
            )}
          </Group>

          <Group title="Colors" id={`${ids}-colors`}>
            <div role="radiogroup" aria-label="Color pairs" className="flex flex-wrap gap-2">
              {LOGO_PALETTES.map((p) => (
                <Choice
                  key={p.name}
                  name={`${ids}-palette`}
                  checked={spec.colors.primary === p.primary.toUpperCase() && spec.colors.accent === p.accent.toUpperCase()}
                  onChange={() => updateColors({ primary: p.primary.toUpperCase(), accent: p.accent.toUpperCase() })}
                  label={p.name}
                >
                  <span
                    className="block size-8 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)] transition-shadow peer-checked:shadow-[0_0_0_2px_#000,0_0_0_4px_var(--accent)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-accent/80"
                    style={{ background: `linear-gradient(135deg, ${p.primary} 50%, ${p.accent} 50%)` }}
                  />
                </Choice>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ColorField label="Name" value={spec.colors.primary} onChange={(primary) => updateColors({ primary })} />
              <ColorField label="Accent" value={spec.colors.accent} onChange={(accent) => updateColors({ accent })} />
            </div>
            <Switch
              label="Solid background"
              checked={!!spec.colors.background}
              onChange={(on) => updateColors({ background: on ? defaultGround(spec) : null })}
            />
            {spec.colors.background && (
              <ColorField
                label="Background"
                value={spec.colors.background}
                onChange={(background) => updateColors({ background })}
              />
            )}
          </Group>

          <Group title="Letters" id={`${ids}-letters`}>
            <Switch label="All capitals" checked={spec.uppercase} onChange={(uppercase) => update({ uppercase })} />
            <TrackingSlider value={spec.tracking} onChange={(tracking) => update({ tracking })} />
          </Group>
        </div>
      </div>
    </div>
  );
}

// A ground that suits the colors: light behind a dark name, dark behind a light one.
function defaultGround(spec: LogoSpec) {
  const v = parseInt(spec.colors.primary.slice(1), 16);
  const light = 0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255) > 150;
  return light ? "#111111" : "#FFFFFF";
}

function TrackingSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const id = useId();
  const word = value < 0 ? "Tight" : value < 0.06 ? "Normal" : value < 0.18 ? "Wide" : "Extra wide";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
          Letter spacing
        </label>
        <span className="text-[12px] text-muted tabular-nums">{word}</span>
      </div>
      <input
        id={id}
        type="range"
        min={-0.05}
        max={0.4}
        step={0.01}
        value={value}
        aria-valuetext={`${word}, ${Math.round(value * 100)}`}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
    </div>
  );
}
