"use client";

import { ActionForm, SubmitButton } from "@/components/action-form";
import { Input } from "@/components/ui";
import { Field } from "@/components/field";
import { changeMyPassword, updateMyName } from "@/app/actions/account";

export function NameForm({ fullName }: { fullName: string }) {
  return (
    <ActionForm action={updateMyName} className="flex flex-col gap-4">
      <Field label="Full name">
        <Input name="fullName" defaultValue={fullName} autoComplete="name" />
      </Field>
      <SubmitButton variant="secondary">Save name</SubmitButton>
    </ActionForm>
  );
}

export function ChangePasswordForm() {
  return (
    <ActionForm action={changeMyPassword} resetOnSuccess className="flex flex-col gap-4">
      <Field label="Current password">
        <Input name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password" hint="At least 8 characters.">
        <Input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
      </Field>
      <Field label="Repeat new password">
        <Input name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
      </Field>
      <SubmitButton pendingText="Changing…">Change password</SubmitButton>
    </ActionForm>
  );
}
