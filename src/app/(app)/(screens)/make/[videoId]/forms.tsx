"use client";

import { Sparkles } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Textarea } from "@/components/ui";
import { Field } from "@/components/field";
import { TypographyPicker } from "@/components/typography/typography-picker";
import type { Typography } from "@/lib/typography";
import { makeVideo } from "@/app/actions/make";

type Type = { initial: Typography; brandKit: Typography | null; title: string; clientName: string };

// The first edit: what to make, an optional script, the fonts and colors. After a version:
// what to change (the fonts and colors stay one click away).
export function MakeForm({ videoId, changes, script, notes = "", type, blocked }: { videoId: string; changes: boolean; script: string; notes?: string; type: Type; blocked?: string }) {
  return (
    <ActionForm action={makeVideo} className="flex flex-col gap-4">
      <input type="hidden" name="videoId" value={videoId} />
      {changes ? (
        <>
          <Field label="What should change?">
            <Textarea name="notes" rows={3} required placeholder="Shorter intro, end on the logo, French captions" />
          </Field>
          <details className="group rounded-[14px] border border-white/[0.08] p-3 [&[open]]:p-0 [&[open]]:border-0">
            <summary className="cursor-pointer text-[13px] font-medium text-ink-2 group-open:mb-3 group-open:px-1 hover:text-ink">Fonts &amp; colors</summary>
            <TypographyPicker {...type} />
          </details>
        </>
      ) : (
        <>
          <Field label="What should it be?" hint="Length, the hook, the mood, the captions' language: anything the engine must know.">
            <Textarea name="notes" rows={4} defaultValue={notes} placeholder="A 30-second reel: open on the reveal, cut on the beat, English captions" />
          </Field>
          <details className="group rounded-[14px] border border-white/[0.08] p-3" open={!!script}>
            <summary className="cursor-pointer text-[13px] font-medium text-ink-2 hover:text-ink">Script or lines (optional)</summary>
            <Textarea name="script" rows={6} defaultValue={script} placeholder="Paste the script or the lines in order: the engine cuts to it." className="mt-3 text-[13px]" />
          </details>
          <TypographyPicker {...type} />
        </>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Sending…" disabled={!!blocked}>
          <Sparkles size={14} aria-hidden /> {changes ? "Make the changes" : "Make the video"}
        </SubmitButton>
        {blocked && <span className="text-xs text-muted">{blocked}</span>}
      </div>
    </ActionForm>
  );
}
