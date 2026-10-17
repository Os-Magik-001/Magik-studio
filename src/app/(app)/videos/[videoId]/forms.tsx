"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Input, Select, Textarea } from "@/components/ui";
import { Field } from "@/components/field";
import { Uploader } from "@/components/uploader";
import { ASPECTS, FORMAT_LABEL, type ScriptStatus } from "@/lib/workflow";
import { markDelivered, scheduleShoot, updateVideo } from "@/app/actions/studio";
import {
  addDriveFootage,
  draftScriptWithClaude,
  fastTrackScript,
  launchEdit,
  markFootageComplete,
  registerDraftVersion,
  registerFootage,
  saveScript,
  sendScriptToClient,
} from "@/app/actions/workflow";

type Person = { id: string; name: string };

export function VideoDetailsForm({
  isAdmin,
  video,
  editors,
  videographers,
}: {
  isAdmin: boolean;
  video: {
    id: string;
    title: string;
    brief: string;
    dueOn: string;
    format: string;
    aspect: string;
    editorId: string;
    videographerId: string;
  };
  editors: Person[];
  videographers: Person[];
}) {
  return (
    <ActionForm action={updateVideo} className="flex flex-col gap-4">
      <input type="hidden" name="videoId" value={video.id} />
      <Field label="Title">
        <Input name="title" defaultValue={video.title} required />
      </Field>
      <Field label="Client brief" hint="Claude drafts the script from this.">
        <Textarea name="brief" rows={5} defaultValue={video.brief} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Format">
          <Select name="format" defaultValue={video.format}>
            {Object.entries(FORMAT_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Aspect">
          <Select name="aspect" defaultValue={video.aspect}>
            {ASPECTS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Due date">
        <Input name="dueOn" type="date" defaultValue={video.dueOn} />
      </Field>
      {isAdmin && (
        <>
          <Field label="Editor">
            <Select name="editorId" defaultValue={video.editorId}>
              <option value="">Unassigned</option>
              {editors.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Videographer">
            <Select name="videographerId" defaultValue={video.videographerId}>
              <option value="">Unassigned</option>
              {videographers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </>
      )}
      <SubmitButton variant="secondary">Save details</SubmitButton>
    </ActionForm>
  );
}

export function ScriptEditor({
  videoId,
  body,
  shots,
  status,
  hasBrief,
  claudeReady,
  draftedByClaude,
  editPrompt,
  hasStrategy,
}: {
  videoId: string;
  body: string;
  shots: string;
  status: ScriptStatus;
  hasBrief: boolean;
  claudeReady: boolean;
  draftedByClaude: boolean;
  editPrompt: string;
  hasStrategy: boolean;
}) {
  // Remount the textareas after Claude writes a new draft.
  const [key, setKey] = useState(0);
  return (
    <div className="flex flex-col gap-5">
      <ActionForm action={draftScriptWithClaude} onSuccess={() => setKey((k) => k + 1)} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
        <input type="hidden" name="videoId" value={videoId} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Notes for Claude (optional)" className="flex-1">
            <Input name="notes" placeholder="Keep it under 45 seconds, open on the product" />
          </Field>
          <SubmitButton pendingText="The scriptwriter is working (about a minute)…" variant="secondary">
            <Sparkles size={14} aria-hidden /> {body ? "Rewrite with the scriptwriter" : "Write with the scriptwriter"}
          </SubmitButton>
        </div>
        <p className="mt-2 text-xs text-muted">
          Agent 3 writes the script, the videographer&apos;s shoot plan and the edit prompt
          {hasStrategy ? ", from the brand strategy and the latest viral research." : ". Run the brand strategist on the client's Brand & strategy page for sharper scripts."}
        </p>
        {!hasBrief && <p className="mt-2 text-xs text-muted">Add the client brief in Details first.</p>}
        {!claudeReady && (
          <p className="mt-2 text-xs text-warning">Claude isn&apos;t connected yet: ANTHROPIC_API_KEY is missing.</p>
        )}
      </ActionForm>

      <ActionForm key={key} action={saveScript} className="flex flex-col gap-4">
        <input type="hidden" name="videoId" value={videoId} />
        <Field label={draftedByClaude ? "Script (drafted by Claude)" : "Script"}>
          <Textarea name="body" rows={14} defaultValue={body} className="font-mono text-[13px]" />
        </Field>
        <Field label="Shot list" hint="One shot per line. The videographer ticks these off on set.">
          <Textarea name="shots" rows={6} defaultValue={shots} />
        </Field>
        <Field label="Edit prompt" hint="What the engine is told when it edits this video. It starts by itself once the videographer marks the footage complete.">
          <Textarea name="editPrompt" rows={6} defaultValue={editPrompt} className="text-[13px]" />
        </Field>
        <div className="flex flex-wrap gap-2">
          <SubmitButton variant="secondary">Save script</SubmitButton>
        </div>
      </ActionForm>

      <ActionForm action={sendScriptToClient} className="border-t border-line pt-4">
        <input type="hidden" name="videoId" value={videoId} />
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pendingText="Sending…">
            {status === "client_review" ? "Resend to client" : "Send to client for approval"}
          </SubmitButton>
          <span className="text-xs text-muted">Save your edits first. The client sees the last saved version.</span>
        </div>
      </ActionForm>
    </div>
  );
}

export function ScheduleShootForm({ videoId }: { videoId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-left text-[13px] font-medium text-accent">
        + Schedule a shoot
      </button>
    );
  }
  return (
    <ActionForm action={scheduleShoot} resetOnSuccess onSuccess={() => setOpen(false)} className="flex flex-col gap-3">
      <input type="hidden" name="videoId" value={videoId} />
      <input type="hidden" name="tzOffset" value={new Date().getTimezoneOffset()} />
      <Field label="Starts">
        <Input name="startsAt" type="datetime-local" required />
      </Field>
      <Field label="Ends">
        <Input name="endsAt" type="datetime-local" />
      </Field>
      <Field label="Place">
        <Input name="location" placeholder="Studio B, 12 Main St" />
      </Field>
      <Field label="What's needed">
        <Textarea name="needs" rows={3} placeholder="Gimbal, two lav mics, product samples" />
      </Field>
      <SubmitButton>Schedule</SubmitButton>
    </ActionForm>
  );
}

// Supabase Storage on the Free plan takes files up to 50 MB; bigger camera files go through Drive.
const UPLOAD_LIMIT = 50 * 1024 * 1024;

export function FootageDrop({ videoId, driveEmail }: { videoId: string; driveEmail: string | null }) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-4">
      <DriveFootageForm videoId={videoId} driveEmail={driveEmail} />
      <Uploader
        bucket="footage"
        folder={videoId}
        multiple
        label="Or drop small files here"
        hint="Up to 50 MB each. Use Google Drive for camera files."
        maxBytes={UPLOAD_LIMIT}
        tooBig="Too big to upload here (over 50 MB). Put it in Google Drive and paste the link above."
        onUploaded={async ({ path, file }) => {
          const res = await registerFootage({
            videoId,
            path,
            fileName: file.name,
            size: file.size,
            contentType: file.type,
          });
          if (!res.error) router.refresh();
          return res;
        }}
      />
    </div>
  );
}

function DriveFootageForm({ videoId, driveEmail }: { videoId: string; driveEmail: string | null }) {
  if (!driveEmail) {
    return <p className="text-xs text-muted">Google Drive isn&apos;t connected yet, so only small uploads work.</p>;
  }
  return (
    <ActionForm action={addDriveFootage} resetOnSuccess className="flex flex-col gap-2">
      <input type="hidden" name="videoId" value={videoId} />
      <Field
        label="Add from Google Drive"
        hint={`Paste a file or folder link. Share it with ${driveEmail} first (Viewer is enough).`}
      >
        <Input name="link" required placeholder="https://drive.google.com/drive/folders/…" />
      </Field>
      <SubmitButton pendingText="Checking Drive…" size="sm" className="self-start">
        Add footage
      </SubmitButton>
    </ActionForm>
  );
}

export function DraftUpload({ videoId }: { videoId: string }) {
  const router = useRouter();
  const [madeBy, setMadeBy] = useState<"claude" | "editor">("claude");
  const [notes, setNotes] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <Field label="Made by">
          <Select value={madeBy} onChange={(e) => setMadeBy(e.target.value as "claude" | "editor")}>
            <option value="claude">Claude</option>
            <option value="editor">Editor</option>
          </Select>
        </Field>
        <Field label="Notes on this version">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tightened the intro" />
        </Field>
      </div>
      <Uploader
        bucket="versions"
        folder={videoId}
        label="Upload the draft render"
        hint="MP4 or MOV"
        onUploaded={async ({ path, file }) => {
          const res = await registerDraftVersion({ videoId, path, fileName: file.name, madeBy, notes });
          if (!res.error && res.data?.versionId) router.push(`/review/${videoId}?v=${res.data.versionId}`);
          return res;
        }}
      />
    </div>
  );
}

export function LaunchEditForm({ videoId, disabledReason, prompt }: { videoId: string; disabledReason?: string; prompt?: string }) {
  return (
    <ActionForm action={launchEdit} className="flex flex-col gap-3">
      <input type="hidden" name="videoId" value={videoId} />
      <Field label={prompt ? "Edit prompt (from the scriptwriter)" : "Notes for Claude (optional)"}>
        <Textarea name="notes" rows={prompt ? 6 : 2} defaultValue={prompt} placeholder={'"Keep it under 60 seconds", "Open on the product"'} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Starting…">
          <Sparkles size={14} aria-hidden /> Launch the edit
        </SubmitButton>
        {disabledReason && <span className="text-xs text-muted">{disabledReason}</span>}
      </div>
    </ActionForm>
  );
}

// For videos that already have a script (and footage): skip the agents and go straight to the edit.
export function FastTrackForm({ videoId, script, footageCount, hasStrategy }: { videoId: string; script: string; footageCount: number; hasStrategy: boolean }) {
  const box = "h-4 w-4 accent-[var(--accent)]";
  return (
    <ActionForm action={fastTrackScript} className="flex flex-col gap-4">
      <input type="hidden" name="videoId" value={videoId} />
      <Field label="Your script" hint="Paste it as it is: scenes, lines, on-screen text. It won't be rewritten.">
        <Textarea name="script" rows={10} defaultValue={script} className="font-mono text-[13px]" required />
      </Field>
      <Field label="Notes for the edit (optional)" hint="Anything the engine must know: length, style, what to open on.">
        <Textarea name="editPrompt" rows={2} placeholder="Episode style like the series, 40 to 50 seconds, English subtitles" />
      </Field>
      <fieldset className="flex flex-col gap-2 text-sm text-ink-2">
        <legend className="mb-1 text-[13px] font-medium text-ink-2">Skip steps</legend>
        <label className="flex items-start gap-2.5">
          <input type="checkbox" name="writePrompt" defaultChecked className={box} />
          <span>
            Let the scriptwriter write the edit prompt from this script
            <span className="block text-xs text-muted">{hasStrategy ? "Uses the brand strategy and viral research too." : "Keeps your script; adds pacing, captions, motion and music for the engine."}</span>
          </span>
        </label>
        <label className="flex items-start gap-2.5">
          <input type="checkbox" name="skipApproval" defaultChecked className={box} />
          <span>Skip the client&apos;s script approval</span>
        </label>
        <label className="flex items-start gap-2.5">
          <input type="checkbox" name="startEdit" defaultChecked={footageCount > 0} className={box} />
          <span>
            Start the edit now
            <span className="block text-xs text-muted">{footageCount ? `${footageCount} footage file${footageCount > 1 ? "s" : ""} ready.` : "Add the footage first (upload or Google Drive link under Raw footage)."}</span>
          </span>
        </label>
      </fieldset>
      <div>
        <SubmitButton pendingText="Working (up to a minute with the scriptwriter)…">Use this script</SubmitButton>
      </div>
    </ActionForm>
  );
}

// The videographer's last step: the edit starts as soon as this is pressed.
export function FootageCompleteForm({ videoId, completedAt, hasFootage }: { videoId: string; completedAt: string | null; hasFootage: boolean }) {
  return (
    <ActionForm action={markFootageComplete} className="flex flex-col gap-2">
      <input type="hidden" name="videoId" value={videoId} />
      <SubmitButton pendingText="Starting the edit…" variant={completedAt ? "secondary" : "primary"}>
        {completedAt ? "Footage complete ✓ (press again after adding more)" : "All footage is in: start the edit"}
      </SubmitButton>
      <p className="text-xs text-muted">
        {hasFootage ? "Claude starts editing right away with the scriptwriter's edit prompt." : "Upload or link the footage first."}
      </p>
    </ActionForm>
  );
}

export function DeliverButton({ videoId }: { videoId: string }) {
  return (
    <ActionForm action={markDelivered}>
      <input type="hidden" name="videoId" value={videoId} />
      <SubmitButton variant="success" pendingText="…">
        Mark delivered
      </SubmitButton>
    </ActionForm>
  );
}
