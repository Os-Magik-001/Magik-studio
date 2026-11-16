"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Input } from "@/components/ui";
import { Field } from "@/components/field";
import { NewPasswordField } from "@/components/password-tools";
import { createAgency, saveAgencyDomains, saveAgencyEngine } from "@/app/actions/agency";

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

const SETS: { id: string; label: string; note: string }[] = [
  { id: "freepd", label: "FreePD", note: "public domain" },
  { id: "incompetech", label: "Incompetech", note: "the post must credit the track" },
  { id: "studio", label: "Studio picks", note: "Magik's own selection" },
  { id: "mixkit", label: "Mixkit", note: "music and effects; check its licence before sharing" },
];

// What the edit engine does for this agency.
export function EngineForm({ agencyId, maxRunningEdits, soundSets }: { agencyId: string; maxRunningEdits: number; soundSets: string[] }) {
  return (
    <ActionForm action={saveAgencyEngine} className="flex flex-col gap-3">
      <input type="hidden" name="agencyId" value={agencyId} />
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Edits at once" hint="The engine takes turns between agencies; this is the most it runs for this one at a time.">
          <Input name="maxRunningEdits" type="number" min={1} max={8} step={1} defaultValue={maxRunningEdits} className="w-28" />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-[13px] font-medium text-ink-2">Built-in music and effects it may use</legend>
        {SETS.map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" name="soundSets" value={s.id} defaultChecked={soundSets.includes(s.id)} className="h-4 w-4 accent-[var(--accent)]" />
            {s.label} <span className="text-muted">({s.note})</span>
          </label>
        ))}
      </fieldset>
      <div>
        <SubmitButton variant="secondary">Save</SubmitButton>
      </div>
    </ActionForm>
  );
}
