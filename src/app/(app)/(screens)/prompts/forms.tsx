"use client";

import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field } from "@/components/field";
import { Input, Select, Textarea } from "@/components/ui";
import { addMotionPrompt } from "@/app/actions/prompts";

export function AddPromptForm({ tags }: { tags: string[] }) {
  return (
    <ActionForm action={addMotionPrompt} resetOnSuccess className="flex flex-col gap-4">
      <Field label="Link" hint="The Prompt Motion page it comes from: the creator is read from it.">
        <Input name="link" placeholder="https://prompt-motion.com/…" />
      </Field>
      <Field label="Title">
        <Input name="title" required placeholder="Claude motion designer showreel" />
      </Field>
      <Field label="Prompt" hint="On the Prompt Motion page, press Copy and paste it here as it is.">
        <Textarea name="prompt" required rows={7} className="font-mono text-[13px]" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <Select name="kind" defaultValue="prompt">
            <option value="prompt">Prompt</option>
            <option value="skill">Skill</option>
          </Select>
        </Field>
        <Field label="Creator">
          <Input name="creator" placeholder="@handle" />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[13px] font-medium text-ink-2">Tags</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {tags.map((t) => (
            <label key={t} className="flex items-center gap-2 text-[13px] text-ink-2">
              <input type="checkbox" name="tags" value={t} className="h-4 w-4 accent-[var(--accent)]" />
              {t}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="What it's good for (optional)" hint="The scriptwriter reads this too.">
        <Input name="notes" placeholder="Website reveals for service businesses" />
      </Field>
      <div>
        <SubmitButton pendingText="Saving…">Save the prompt</SubmitButton>
      </div>
    </ActionForm>
  );
}
