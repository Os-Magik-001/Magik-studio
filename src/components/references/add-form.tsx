"use client";

import { Link2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field } from "@/components/field";
import { Input, Textarea } from "@/components/ui";
import { REFERENCE_FOCUS } from "@/lib/reference-links";
import { addReference } from "@/app/actions/references";

// A reel or a video the agents should learn from: for this video, or for all the client's.
export function AddReferenceForm({ videoId, clientId, clientName }: { videoId?: string; clientId: string; clientName: string }) {
  const chip =
    "flex cursor-pointer items-center rounded-full border border-line px-3 py-1 text-xs text-ink-2 transition-colors hover:border-line-strong has-[:checked]:border-accent/60 has-[:checked]:bg-accent-soft has-[:checked]:text-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent";
  return (
    <ActionForm action={addReference} resetOnSuccess className="flex flex-col gap-4">
      {videoId && <input type="hidden" name="videoId" value={videoId} />}
      <input type="hidden" name="clientId" value={clientId} />
      <Field label="Link" hint="An Instagram reel, a TikTok, a YouTube or Vimeo video, a Google Drive file, or a video file's address.">
        <Input name="link" required inputMode="url" placeholder="https://www.instagram.com/reel/…" />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[13px] font-medium text-ink-2">What to take from it</legend>
        <div className="flex flex-wrap gap-2">
          {REFERENCE_FOCUS.map((f) => (
            <label key={f.value} className={chip}>
              <input type="checkbox" name="focus" value={f.value} className="sr-only" />
              {f.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">Pick none and the agents take whatever fits.</p>
      </fieldset>
      <Field label="Note for the agents (optional)">
        <Textarea name="note" rows={2} placeholder="The way the phone tumbles in at the start, and the cuts on every beat" />
      </Field>
      {videoId && (
        <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink-2">
          <legend className="sr-only">Use it for</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="scope" value="video" defaultChecked className="h-4 w-4 accent-[var(--accent)]" />
            This video
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="scope" value="client" className="h-4 w-4 accent-[var(--accent)]" />
            All of {clientName}&apos;s videos
          </label>
        </fieldset>
      )}
      <div>
        <SubmitButton variant="secondary" pendingText="Adding…">
          <Link2 size={14} aria-hidden /> Add the reference
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
