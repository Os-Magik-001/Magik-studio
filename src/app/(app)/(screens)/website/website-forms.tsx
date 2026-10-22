"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button, Textarea } from "@/components/ui";
import { requestWebsite } from "@/app/actions/website";

export function InterestButton() {
  const [sent, setSent] = useState(false);
  if (sent) return <p className="text-[14px] font-medium text-success">Thanks! The studio will reach out about your website.</p>;
  return (
    <ActionForm action={requestWebsite} onSuccess={() => setSent(true)}>
      <input type="hidden" name="kind" value="interest" />
      <SubmitButton pendingText="Sending…" className="h-11 px-6 text-[15px]">
        I&apos;d like a website
      </SubmitButton>
    </ActionForm>
  );
}

export function ChangeRequest() {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Ask for a change
      </Button>
    );
  return (
    <ActionForm action={requestWebsite} resetOnSuccess onSuccess={() => setOpen(false)} className="flex w-full max-w-lg flex-col gap-2">
      <input type="hidden" name="kind" value="change" />
      <Textarea name="message" rows={3} required maxLength={2000} placeholder="What would you like changed on your website?" aria-label="The change you'd like" />
      <div className="flex gap-2">
        <SubmitButton pendingText="Sending…">Send to the studio</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </ActionForm>
  );
}
