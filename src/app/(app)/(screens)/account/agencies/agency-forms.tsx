"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Input } from "@/components/ui";
import { Field } from "@/components/field";
import { NewPasswordField } from "@/components/password-tools";
import { createAgency, saveAgencyDomains } from "@/app/actions/agency";

const toSlug = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export function NewAgencyForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [typed, setTyped] = useState(false);
  return (
    <ActionForm action={createAgency} resetOnSuccess className="grid gap-4 @min-[40rem]:grid-cols-2">
      <Field label="Agency name">
        <Input
          name="name"
          required
          maxLength={60}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!typed) setSlug(toSlug(e.target.value));
          }}
          placeholder="North Studio"
          autoComplete="off"
        />
      </Field>
      <Field label="Short name" hint="Lower-case letters, digits and dashes. It can't be changed later.">
        <Input
          name="slug"
          required
          maxLength={40}
          value={slug}
          onChange={(e) => {
            setTyped(true);
            setSlug(e.target.value.toLowerCase());
          }}
          placeholder="north-studio"
          autoComplete="off"
        />
      </Field>
      <Field label="Address" hint="Where its people sign in. Several: separate them with spaces." className="@min-[40rem]:col-span-2">
        <Input name="domains" required placeholder="north.yourdomain.com" autoComplete="off" />
      </Field>
      <Field label="First studio manager">
        <Input name="fullName" placeholder="Their full name" autoComplete="off" />
      </Field>
      <Field label="Their email">
        <Input name="email" type="email" required placeholder="manager@northstudio.com" autoComplete="off" />
      </Field>
      <div className="@min-[40rem]:col-span-2">
        <NewPasswordField />
      </div>
      <div className="@min-[40rem]:col-span-2">
        <SubmitButton pendingText="Creating…">Create the agency</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DomainsForm({ agencyId, domains, first }: { agencyId: string; domains: string[]; first: boolean }) {
  return (
    <ActionForm action={saveAgencyDomains} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="agencyId" value={agencyId} />
      <Field label="Addresses" hint={first ? "The first agency also answers at every address no other agency claims." : "An account of this agency only opens at one of these."} className="min-w-[240px] flex-1">
        <Input name="domains" defaultValue={domains.join(" ")} placeholder="studio.example.com" autoComplete="off" />
      </Field>
      <SubmitButton variant="secondary">Save</SubmitButton>
    </ActionForm>
  );
}
