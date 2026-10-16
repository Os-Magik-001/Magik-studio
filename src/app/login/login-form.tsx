"use client";

import { ActionForm, SubmitButton } from "@/components/action-form";
import { Input } from "@/components/ui";
import { Field } from "@/components/field";
import { signIn } from "./actions";

export function LoginForm({ next }: { next: string }) {
  return (
    <ActionForm action={signIn} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required autoFocus placeholder="you@studio.com" />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton pendingText="Signing in…" className="w-full">
        Sign in
      </SubmitButton>
    </ActionForm>
  );
}
