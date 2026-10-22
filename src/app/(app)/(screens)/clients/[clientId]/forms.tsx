"use client";

import { useRouter } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Input, Select, Textarea } from "@/components/ui";
import { Field } from "@/components/field";
import { Uploader } from "@/components/uploader";
import { ASPECTS, FORMAT_LABEL } from "@/lib/workflow";
import {
  createVideo,
  saveBrandKit,
  setBrandLogo,
  setClientEditor,
  updateClientSettings,
} from "@/app/actions/studio";

type Person = { id: string; name: string };

export function NewVideoForm({
  clientId,
  editors,
  videographers,
}: {
  clientId: string;
  editors: Person[];
  videographers: Person[];
}) {
  return (
    <ActionForm action={createVideo} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="clientId" value={clientId} />
      <Field label="Title" className="sm:col-span-2">
        <Input name="title" required placeholder="Fall menu launch" />
      </Field>
      <Field label="Format">
        <Select name="format" defaultValue="social_short">
          {Object.entries(FORMAT_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Aspect ratio">
        <Select name="aspect" defaultValue="9:16">
          {ASPECTS.map((a) => (
            <option key={a} value={a}>
              {a === "9:16" ? "9:16 vertical" : a === "1:1" ? "1:1 square" : "16:9 wide"}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Editor">
        <Select name="editorId" defaultValue="">
          <option value="">Unassigned</option>
          {editors.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Videographer">
        <Select name="videographerId" defaultValue="">
          <option value="">Unassigned</option>
          {videographers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Due date">
        <Input name="dueOn" type="date" />
      </Field>
      <Field
        label="Client brief"
        hint="What the client wants. The scriptwriter writes the script from this."
        className="sm:col-span-2"
      >
        <Textarea name="brief" rows={4} placeholder="Goal, audience, key message, must-have shots, call to action…" />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Creating…">Create video</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function BrandKitForm({
  clientId,
  logoUrl,
  kit,
}: {
  clientId: string;
  logoUrl?: string;
  kit: { colors: string; fonts: string; musicMood: string; styleRules: string; editStyle: string; graphics: string };
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
          <img src={logoUrl} alt="Client logo" className="h-16 w-16 rounded-xl border border-line object-contain p-1" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-line-strong text-xs text-muted">
            No logo
          </div>
        )}
        <div className="min-w-60 flex-1">
          <Uploader
            bucket="brand"
            folder={clientId}
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            label={logoUrl ? "Replace logo" : "Upload logo"}
            hint="PNG, SVG, JPG or WebP"
            onUploaded={async ({ path }) => {
              const res = await setBrandLogo({ clientId, path });
              if (!res.error) router.refresh();
              return res;
            }}
          />
        </div>
      </div>
      <ActionForm action={saveBrandKit} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="clientId" value={clientId} />
        <Field label="Colors" hint="Comma-separated, e.g. #1E1D1B, #F2C14E">
          <Input name="colors" defaultValue={kit.colors} />
        </Field>
        <Field label="Fonts" hint="Comma-separated">
          <Input name="fonts" defaultValue={kit.fonts} />
        </Field>
        <Field
          label="Editing style"
          hint="Clean: cuts, reframing and subtitles only, like Cluely's skits. Dynamic: 3D intros, motion graphics, stickers and sound effects."
          className="sm:col-span-2"
        >
          <Select name="editStyle" defaultValue={kit.editStyle}>
            <option value="dynamic">Dynamic: motion graphics and effects</option>
            <option value="clean">Clean: cuts and subtitles only</option>
          </Select>
        </Field>
        <Field
          label="Graphics"
          hint="Designed: the motion director writes a design prompt for every scene and the engine's motion designer codes the graphics for each video (slower, costs more per edit). A video can also be designed on its own by choosing design templates on its script."
          className="sm:col-span-2"
        >
          <Select name="graphics" defaultValue={kit.graphics}>
            <option value="templates">The engine&apos;s motion templates</option>
            <option value="designed">Designed for each video by the motion director</option>
          </Select>
        </Field>
        <Field label="Music mood" className="sm:col-span-2">
          <Input name="musicMood" defaultValue={kit.musicMood} placeholder="Warm acoustic, upbeat, no vocals" />
        </Field>
        <Field label="Style rules" className="sm:col-span-2">
          <Textarea
            name="styleRules"
            rows={5}
            defaultValue={kit.styleRules}
            placeholder="Open on the product. Captions always on, bottom third. No jump cuts on faces. Logo end card for 2 seconds."
          />
        </Field>
        <div className="sm:col-span-2">
          <SubmitButton>Save brand kit</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}

export function ClientSettingsForm({
  clientId,
  name,
  revisionLimit,
}: {
  clientId: string;
  name: string;
  revisionLimit: number;
}) {
  return (
    <ActionForm action={updateClientSettings} className="flex flex-col gap-4">
      <input type="hidden" name="clientId" value={clientId} />
      <Field label="Name">
        <Input name="name" defaultValue={name} required />
      </Field>
      <Field label="Included revision rounds" hint="Change requests beyond this are flagged as extra, billable work.">
        <Input name="revisionLimit" type="number" min={0} max={20} defaultValue={revisionLimit} required />
      </Field>
      <SubmitButton variant="secondary">Save</SubmitButton>
    </ActionForm>
  );
}

export function EditorToggle({ clientId, userId, assigned }: { clientId: string; userId: string; assigned: boolean }) {
  return (
    <ActionForm action={setClientEditor}>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="assign" value={assigned ? "0" : "1"} />
      <SubmitButton size="sm" variant={assigned ? "secondary" : "ghost"} pendingText="…">
        {assigned ? "Assigned" : "Assign"}
      </SubmitButton>
    </ActionForm>
  );
}
