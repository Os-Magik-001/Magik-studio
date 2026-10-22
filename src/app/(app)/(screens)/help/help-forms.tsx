"use client";

import { ActionForm, SubmitButton } from "@/components/action-form";
import { Select, Textarea } from "@/components/ui";
import { Field } from "@/components/field";
import { useDesktop } from "@/components/desktop/context";
import { answerHelp, askHelp } from "@/app/actions/help";

export function AskForm() {
  const d = useDesktop();
  // The window that was in front before Help: where the question comes from.
  const from = d.wins.filter((w) => w.appId !== "help").sort((a, b) => b.z - a.z)[0];
  return (
    <ActionForm action={askHelp} resetOnSuccess className="flex flex-col gap-3">
      <input type="hidden" name="page" value={from ? `${from.title} (${from.path})` : ""} />
      <Field label="About">
        <Select name="topic" defaultValue="question">
          <option value="question">A question</option>
          <option value="problem">Something doesn&apos;t work</option>
          <option value="idea">An idea</option>
          <option value="billing">Billing</option>
        </Select>
      </Field>
      <Field label="Your message">
        <Textarea name="body" rows={4} required maxLength={4000} placeholder="Tell us what you need, as you'd say it" />
      </Field>
      <SubmitButton pendingText="Sending…" className="self-start">
        Send to the studio
      </SubmitButton>
    </ActionForm>
  );
}

export function AnswerForm({ id }: { id: string }) {
  return (
    <ActionForm action={answerHelp} resetOnSuccess className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <Textarea name="reply" rows={2} maxLength={2000} placeholder="Your answer (sent as a notification)" aria-label="Your answer" />
      <div className="flex gap-2">
        <SubmitButton size="sm" pendingText="Sending…">
          Answer
        </SubmitButton>
        <SubmitButton size="sm" variant="ghost" name="close" value="1" pendingText="…">
          Close without answering
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
