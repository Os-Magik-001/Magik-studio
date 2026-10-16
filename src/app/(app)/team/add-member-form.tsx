"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Input, Select } from "@/components/ui";
import { Field } from "@/components/field";
import { ROLE_LABEL } from "@/lib/workflow";
import { addTeamMember } from "@/app/actions/studio";

export function AddMemberForm({ clients }: { clients: { id: string; name: string }[] }) {
  const [role, setRole] = useState("editor");
  return (
    <ActionForm action={addTeamMember} resetOnSuccess className="flex flex-col gap-4">
      <Field label="Name">
        <Input name="fullName" placeholder="Sam Rivera" />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" required placeholder="sam@studio.com" />
      </Field>
      <Field label="Role">
        <Select name="role" value={role} onChange={(e) => setRole(e.target.value)}>
          {Object.entries(ROLE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      {role === "client" && (
        <Field label="Client" hint="Client reviewers only see this client's videos.">
          <Select name="clientId" required defaultValue="">
            <option value="" disabled>
              Pick a client
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <SubmitButton pendingText="Adding…">Add to Magik OS</SubmitButton>
    </ActionForm>
  );
}
