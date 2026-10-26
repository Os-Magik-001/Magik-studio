"use client";

import { ActionForm, SubmitButton } from "@/components/action-form";
import { Input, Select } from "@/components/ui";
import { Field } from "@/components/field";
import { ASPECTS, FORMAT_LABEL } from "@/lib/workflow";
import { startMadeVideo } from "@/app/actions/make";

const SHAPE: Record<(typeof ASPECTS)[number], string> = { "9:16": "Vertical 9:16", "1:1": "Square 1:1", "16:9": "Wide 16:9" };

export function NewVideoForm({ clients }: { clients: { id: string; name: string }[] }) {
  return (
    <ActionForm action={startMadeVideo} className="flex flex-col gap-4">
      <Field label="Name">
        <Input name="title" required maxLength={160} placeholder="Mercedes B: the dealership" />
      </Field>
      <Field label="For" hint="A client's brand kit styles it. Clients never see these videos.">
        <Select name="clientId" defaultValue="">
          <option value="">The studio (no client)</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Format">
          <Select name="format" defaultValue="social_short">
            {Object.entries(FORMAT_LABEL).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Shape">
          <Select name="aspect" defaultValue="9:16">
            {ASPECTS.map((a) => (
              <option key={a} value={a}>
                {SHAPE[a]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <SubmitButton pendingText="Starting…" className="self-start">
        Start
      </SubmitButton>
    </ActionForm>
  );
}
