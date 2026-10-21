"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Input, Textarea, cx } from "@/components/ui";
import { Field } from "@/components/field";
import { addLibraryItem, updateLibraryItem } from "@/app/actions/library";

export function AddLibraryItemForm() {
  const [cover, setCover] = useState<string | null>(null);
  return (
    <ActionForm action={addLibraryItem} resetOnSuccess onSuccess={() => setCover(null)} className="flex flex-col gap-4">
      <Field label="Link" hint="Instagram, TikTok, YouTube or Vimeo.">
        <Input name="link" required placeholder="https://www.instagram.com/reel/…" />
      </Field>
      <Field label="Title" hint="What clients see: the style, not the account.">
        <Input name="title" required placeholder="Fast cuts, bold captions" />
      </Field>
      <Field label="Tags" hint="Comma separated.">
        <Input name="tags" placeholder="dynamic, talking head, restaurant" />
      </Field>
      <Field label="What it shows (optional)">
        <Textarea name="note" rows={2} placeholder="Hook in the first second, captions on every word, a reveal at the end." />
      </Field>
      <label className={cx("flex cursor-pointer items-center gap-3 rounded-[14px] border border-dashed px-4 py-3 text-[13px]", cover ? "border-accent/60 text-ink" : "border-white/20 text-muted hover:bg-white/[0.04]")}>
        <span className="flex-1 truncate">{cover ?? "Cover image (optional): YouTube and TikTok get theirs automatically"}</span>
        <input type="file" name="cover" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => setCover(e.target.files?.[0]?.name ?? null)} />
      </label>
      <div className="flex justify-end">
        <SubmitButton pendingText="Adding…">Add to the library</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function EditLibraryItemForm({ item }: { item: { id: string; title: string; note: string | null; tags: string[] } }) {
  return (
    <ActionForm action={updateLibraryItem} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={item.id} />
      <Input name="title" defaultValue={item.title} aria-label="Title" />
      <Input name="tags" defaultValue={item.tags.join(", ")} aria-label="Tags" placeholder="Tags" />
      <Textarea name="note" rows={2} defaultValue={item.note ?? ""} aria-label="What it shows" />
      <div className="flex justify-end">
        <SubmitButton size="sm" pendingText="Saving…">
          Save
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
