"use client";

import { useState, useTransition } from "react";
import type { Brand } from "@/lib/brand";
import { WALLPAPERS } from "@/lib/wallpapers";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button, Input, Select } from "@/components/ui";
import { Field } from "@/components/field";
import { ColorField } from "@/components/color-field";
import { SettingsGroup } from "@/components/settings/settings-shell";
import { resetBranding, saveBranding } from "@/app/actions/agency";

type Kind = "mark" | "horizontal" | "horizontalDark" | "icon";

const FILES: { kind: Kind; label: string; hint: string; light?: boolean }[] = [
  { kind: "mark", label: "Mark", hint: "The small symbol in the menu bar, on the sign-in page and on the Home icon. Works on a dark background." },
  { kind: "horizontal", label: "Logo, for dark backgrounds", hint: "The full logo in a row, shown when a client sets up their account." },
  { kind: "horizontalDark", label: "Logo, for white pages", hint: "The full logo on invoices.", light: true },
  { kind: "icon", label: "Browser tab icon", hint: "A square image, at least 180 pixels wide." },
];

export function BrandingForm({ brand, own, customized }: { brand: Brand; own: Record<Kind, boolean>; customized: boolean }) {
  const [accent, setAccent] = useState(brand.accent.toUpperCase());
  const [first, setFirst] = useState(brand.wordmark[0]);
  const [second, setSecond] = useState(brand.wordmark[1]);
  const [removed, setRemoved] = useState<Partial<Record<Kind, boolean>>>({});
  const [confirming, setConfirming] = useState(false);
  const [resetNote, setResetNote] = useState<string | null>(null);
  const [resetting, startReset] = useTransition();
  const current: Record<Kind, string | null> = { mark: brand.logos.mark, horizontal: brand.logos.horizontal, horizontalDark: brand.logos.horizontalDark, icon: brand.icon };

  return (
    <>
      <ActionForm action={saveBranding} className="flex flex-col gap-5">
        <SettingsGroup title="Names">
          <div className="grid gap-4 p-4 @min-[40rem]:grid-cols-2">
            <Field label="The app's name" hint="In the browser tab and wherever the app names itself.">
              <Input name="product" required maxLength={60} defaultValue={brand.product} />
            </Field>
            <Field label="The studio's name" hint="On scripts, invoices and invitations.">
              <Input name="studio" required maxLength={60} defaultValue={brand.studio} />
            </Field>
            <Field label="Short name" hint={`As in "your website with ${brand.short}".`}>
              <Input name="short" required maxLength={60} defaultValue={brand.short} />
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink-2">Name in the menu bar</span>
              <div className="flex gap-2">
                <Input name="wordmarkFirst" required maxLength={24} value={first} onChange={(e) => setFirst(e.target.value.toUpperCase())} aria-label="First part" />
                <Input name="wordmarkSecond" maxLength={12} value={second} onChange={(e) => setSecond(e.target.value.toUpperCase())} aria-label="Second part, in the accent colour" className="w-28" />
              </div>
              <p className="rounded-[10px] bg-black/50 px-3 py-2 font-display text-[13px] font-semibold tracking-[0.38em] text-white">
                {first} <span style={{ color: accent }}>{second}</span>
              </p>
            </div>
          </div>
        </SettingsGroup>

        <SettingsGroup title="Colour and wallpaper" description="The accent colours buttons, highlights and the selected app. Each person can still pick their own wallpaper in Appearance.">
          <div className="grid gap-4 p-4 @min-[40rem]:grid-cols-2">
            <div>
              <ColorField label="Accent colour" value={accent} onChange={setAccent} />
              <input type="hidden" name="accent" value={accent} />
            </div>
            <Field label="Wallpaper before a person picks one">
              <Select name="wallpaper" defaultValue={brand.wallpaper}>
                {WALLPAPERS.filter((w) => w.image && (!w.brand || w.brand === brand.slug)).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </SettingsGroup>

        <SettingsGroup title="Logos" description="PNG, JPG, WebP or SVG, up to 1 MB each. Without a mark, the studio's initials are shown in the accent colour.">
          {FILES.map((f) => {
            const shown = removed[f.kind] ? null : current[f.kind];
            return (
              <div key={f.kind} className="flex flex-wrap items-center gap-4 px-4 py-3.5">
                <span className={`flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[10px] p-2 ${f.light ? "bg-white" : "bg-black/60 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"}`}>
                  {shown ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={shown} alt="" className="max-h-full max-w-full" />
                  ) : (
                    <span className={`text-[11px] ${f.light ? "text-black/40" : "text-muted"}`}>None</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] text-ink">{f.label}</p>
                  <p className="text-[12.5px] text-muted">{f.hint}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <input
                      type="file"
                      name={f.kind}
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      aria-label={`${f.label}: choose a file`}
                      className="max-w-full text-[12.5px] text-ink-2 file:mr-3 file:h-8 file:cursor-pointer file:rounded-full file:border-0 file:bg-white/[0.1] file:px-3.5 file:text-[12.5px] file:font-medium file:text-ink hover:file:bg-white/[0.16]"
                    />
                    {own[f.kind] && (
                      <label className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
                        <input type="checkbox" name={`${f.kind}Remove`} value="1" checked={!!removed[f.kind]} onChange={(e) => setRemoved((r) => ({ ...r, [f.kind]: e.target.checked }))} className="h-4 w-4 accent-[var(--accent)]" />
                        Remove
                      </label>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </SettingsGroup>

        <div>
          <SubmitButton pendingText="Saving…">Save branding</SubmitButton>
        </div>
      </ActionForm>

      {customized && (
        <SettingsGroup title="Start over" description="Puts back the names, colour and logos the studio started with.">
          <div className="flex flex-wrap items-center gap-3 p-4">
            {confirming ? (
              <>
                <Button
                  variant="danger"
                  disabled={resetting}
                  onClick={() =>
                    startReset(async () => {
                      const result = await resetBranding();
                      setResetNote(result.error ?? result.message ?? null);
                      setConfirming(false);
                    })
                  }
                >
                  {resetting ? "Resetting…" : "Yes, reset the branding"}
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => setConfirming(true)}>
                Reset branding
              </Button>
            )}
            {resetNote && <p className="text-[13px] text-muted">{resetNote}</p>}
          </div>
        </SettingsGroup>
      )}
    </>
  );
}
