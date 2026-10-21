"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field } from "@/components/field";
import { Button, Input, Select } from "@/components/ui";
import { addSoundLibrary } from "@/app/actions/sounds";

const PIXABAY = "Pixabay Content License: commercial use, no credit needed";
const PRESETS = {
  none: { name: "", kind: "music", license: "" },
  pixabay: { name: "Pixabay music", kind: "music", license: PIXABAY },
  pixabaySfx: { name: "Pixabay sound effects", kind: "sfx", license: PIXABAY },
};

export function AddLibraryForm({ driveEmail }: { driveEmail: string | null }) {
  // A preset fills the fields; they remount when it changes or after an add.
  const [preset, setPreset] = useState<keyof typeof PRESETS>("none");
  const [round, setRound] = useState(0);
  if (!driveEmail) {
    return <p className="text-[13px] text-muted">Google Drive isn&apos;t connected yet: ask an admin to add the service account key.</p>;
  }
  const p = PRESETS[preset];
  return (
    <ActionForm
      action={addSoundLibrary}
      onSuccess={() => {
        setPreset("none");
        setRound((r) => r + 1);
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={preset === "pixabay" ? "primary" : "secondary"} onClick={() => setPreset("pixabay")}>
          Pixabay music
        </Button>
        <Button type="button" size="sm" variant={preset === "pixabaySfx" ? "primary" : "secondary"} onClick={() => setPreset("pixabaySfx")}>
          Pixabay sound effects
        </Button>
      </div>
      <div key={`${preset}:${round}`} className="flex flex-col gap-4">
        <Field label="Name">
          <Input name="name" required defaultValue={p.name} placeholder="Pixabay funk, Studio whooshes" />
        </Field>
        <Field label="Google Drive folder" hint={`Share it with ${driveEmail} first (Viewer is enough). Subfolders count too.`}>
          <Input name="link" required placeholder="https://drive.google.com/drive/folders/…" />
        </Field>
        <Field label="Holds">
          <Select name="kind" defaultValue={p.kind}>
            <option value="music">Music</option>
            <option value="sfx">Sound effects</option>
          </Select>
        </Field>
        <Field label="Licence" hint="So the sound designer knows what it may do with these files.">
          <Input name="license" defaultValue={p.license} placeholder="Pixabay Content License, bought on Artlist…" />
        </Field>
      </div>
      <div>
        <SubmitButton pendingText="Adding…">Add the library</SubmitButton>
      </div>
    </ActionForm>
  );
}
