"use client";

import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field } from "@/components/field";
import { Input, Select } from "@/components/ui";
import { addSoundLibrary } from "@/app/actions/sounds";

export function AddLibraryForm({ driveEmail }: { driveEmail: string | null }) {
  if (!driveEmail) {
    return <p className="text-[13px] text-muted">Google Drive isn&apos;t connected yet: ask an admin to add the service account key.</p>;
  }
  return (
    <ActionForm action={addSoundLibrary} resetOnSuccess className="flex flex-col gap-4">
      <Field label="Name">
        <Input name="name" required placeholder="Pixabay funk, Studio whooshes" />
      </Field>
      <Field label="Google Drive folder" hint={`Share it with ${driveEmail} first (Viewer is enough). Subfolders count too.`}>
        <Input name="link" required placeholder="https://drive.google.com/drive/folders/…" />
      </Field>
      <Field label="Holds">
        <Select name="kind" defaultValue="music">
          <option value="music">Music</option>
          <option value="sfx">Sound effects</option>
        </Select>
      </Field>
      <Field label="Licence" hint="So the sound designer knows what it may do with these files.">
        <Input name="license" placeholder="Pixabay Content License, bought on Artlist…" />
      </Field>
      <div>
        <SubmitButton pendingText="Adding…">Add the library</SubmitButton>
      </div>
    </ActionForm>
  );
}
