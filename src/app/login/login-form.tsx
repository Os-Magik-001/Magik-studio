"use client";

import { ActionForm, SubmitButton } from "@/components/action-form";
import { Input } from "@/components/ui";
import { Field } from "@/components/field";
import { requestSignInLink } from "./actions";

export function LoginForm({ next }: { next: string }) {
  return (
    <ActionForm action={requestSignInLink} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Work email">
        <Input name="email" type="email" autoComplete="email" required autoFocus placeholder="you@studio.com" />
      </Field>
      <SubmitButton pendingText="Sending…" className="w-full">
        Email me a sign-in link
      </SubmitButton>
    </ActionForm>
  );
}
