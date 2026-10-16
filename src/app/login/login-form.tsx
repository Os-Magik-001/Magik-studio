"use client";

import { ArrowRight } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Input } from "@/components/ui";
import { Field } from "@/components/field";
import { signIn } from "./actions";

export function LoginForm({ next }: { next: string }) {
  return (
    <ActionForm action={signIn} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required autoFocus placeholder="you@studio.com" className="h-11" />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" required className="h-11" />
      </Field>
      <SubmitButton pendingText="Signing in…" className="mt-2 h-11 w-full text-[15px]">
        Sign in <ArrowRight size={16} aria-hidden />
      </SubmitButton>
    </ActionForm>
  );
}
