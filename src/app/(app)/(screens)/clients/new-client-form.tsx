"use client";

import { ActionForm, SubmitButton } from "@/components/action-form";
import { Input } from "@/components/ui";
import { Field } from "@/components/field";
import { createClientAccount } from "@/app/actions/studio";

export function NewClientForm() {
  return (
    <ActionForm action={createClientAccount} className="flex flex-col gap-3">
      <Field label="Client name">
        <Input name="name" required placeholder="Acme Coffee" />
      </Field>
      <SubmitButton pendingText="Creating…">Create client</SubmitButton>
    </ActionForm>
  );
}
