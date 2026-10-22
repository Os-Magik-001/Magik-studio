"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Input, Select, Textarea, cx } from "@/components/ui";
import { createPlannedVideos, planMonth, scheduleShootDay, sendScripts, startProductionNow, writeScripts } from "@/app/actions/production";
import { requestTrendResearch } from "@/app/actions/agents";
import type { PlanIdea } from "@/lib/agent-types";

// The Production panel's buttons (./panel.tsx): one form per step.

type Person = { id: string; name: string };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Label({ text, children, className }: { text: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx("flex flex-col gap-1.5 text-[12px] font-medium text-muted", className)}>
      {text}
      {children}
    </label>
  );
}

export function StartProductionButton({ clientId, again }: { clientId: string; again: boolean }) {
  return (
    <ActionForm action={startProductionNow}>
      <input type="hidden" name="clientId" value={clientId} />
      <SubmitButton variant={again ? "secondary" : "primary"} size={again ? "sm" : "md"} pendingText="Starting…">
        {again ? "Run the strategist again" : "Start production"}
      </SubmitButton>
    </ActionForm>
  );
}

export function ResearchForm({ clientId, hashtags, accounts, label }: { clientId: string; hashtags: string[]; accounts: string[]; label: string }) {
  return (
    <ActionForm action={requestTrendResearch} className="flex flex-col gap-3">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Label text="Hashtags">
          <Input name="hashtags" defaultValue={hashtags.slice(0, 4).join(" ")} placeholder="boulangerie montrealfood" />
        </Label>
        <Label text="Accounts">
          <Input name="accounts" defaultValue={accounts.slice(0, 4).join(" ")} placeholder="fournilrosemont" />
        </Label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="sm" variant="secondary" pendingText="Starting…">
          {label}
        </SubmitButton>
        <span className="text-xs text-muted">Up to 4 of each, from the strategy. The engine finds their top reels and watches the best 10.</span>
      </div>
    </ActionForm>
  );
}

export function PlanForm({ clientId, count, again }: { clientId: string; count: number; again: boolean }) {
  return (
    <ActionForm action={planMonth} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="clientId" value={clientId} />
      <Label text="Videos">
        <Input name="count" type="number" min={1} max={12} defaultValue={count} className="w-20" />
      </Label>
      <SubmitButton variant={again ? "secondary" : "primary"} pendingText="Starting…">
        {again ? "Plan again" : "Plan the month"}
      </SubmitButton>
    </ActionForm>
  );
}

export function CreateVideosForm({
  runId,
  ideas,
  editors,
  videographers,
  defaultEditor,
  defaultVideographer,
  dueOn,
  canCreate,
}: {
  runId: string;
  ideas: (PlanIdea & { index: number })[];
  editors: Person[];
  videographers: Person[];
  defaultEditor: string;
  defaultVideographer: string;
  dueOn: string;
  // Only the studio manager adds videos.
  canCreate: boolean;
}) {
  const open = ideas.filter((i) => !i.video_id);
  const [picked, setPicked] = useState(() => new Set(open.map((i) => i.index)));
  const toggle = (i: number) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  return (
    <ActionForm action={createPlannedVideos} className="flex flex-col gap-4">
      <input type="hidden" name="runId" value={runId} />
      <ul className="grid gap-3 md:grid-cols-2">
        {ideas.map((idea) => {
          const made = !!idea.video_id;
          const on = picked.has(idea.index);
          const body = (
            <>
              <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
                <span className="truncate">{idea.pillar}</span>
                <span className="ml-auto shrink-0 font-mono tracking-normal normal-case">{Math.round(idea.length_seconds)} s</span>
              </div>
              <div className="mt-1 text-[14.5px] font-semibold text-ink">{idea.title}</div>
              <p className="mt-1.5 text-[13px] leading-snug text-ink-2">
                <span className="text-muted">Hook · </span>
                {idea.hook}
              </p>
              <p className="mt-1.5 text-xs leading-snug text-muted">{idea.why}</p>
            </>
          );
          return (
            <li key={idea.index}>
              {made ? (
                <Link href={`/videos/${idea.video_id}`} className="flex h-full flex-col rounded-xl border border-success/30 bg-success-soft/40 p-3.5 transition-colors hover:border-success/60">
                  {body}
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-success">
                    <Check size={13} aria-hidden /> Video created · open it <ArrowRight size={12} aria-hidden />
                  </span>
                </Link>
              ) : (
                <label
                  className={cx(
                    "flex h-full gap-3 rounded-xl border p-3.5 transition-colors",
                    canCreate ? "cursor-pointer" : "",
                    on ? "border-accent/50 bg-accent-soft/40" : "border-white/[0.09] bg-white/[0.02] hover:border-white/20",
                  )}
                >
                  {canCreate && <input type="checkbox" name="idea" value={idea.index} checked={on} onChange={() => toggle(idea.index)} className="mt-1 h-4 w-4 shrink-0 accent-[#f6d43a]" />}
                  <div className="min-w-0 flex-1">{body}</div>
                </label>
              )}
            </li>
          );
        })}
      </ul>
      {open.length > 0 && canCreate && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5">
          <Label text="Editor">
            <Select name="editorId" defaultValue={defaultEditor} className="w-44">
              <option value="">Nobody yet</option>
              {editors.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Label>
          <Label text="Videographer">
            <Select name="videographerId" defaultValue={defaultVideographer} className="w-44">
              <option value="">Nobody yet</option>
              {videographers.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Label>
          <Label text="Due by">
            <Input name="dueOn" type="date" defaultValue={dueOn} className="w-40" />
          </Label>
          <label className="flex h-9 items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" name="writeScripts" defaultChecked className="h-4 w-4 accent-[#f6d43a]" /> Write their scripts right away
          </label>
          <SubmitButton pendingText="Creating…" className="ml-auto">
            Create {plural(picked.size, "video")}
          </SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}

export function ScriptActions({ clientId, toWrite, toRevise, toSend }: { clientId: string; toWrite: number; toRevise: number; toSend: number }) {
  if (!toWrite && !toRevise && !toSend) return null;
  return (
    <div className="flex flex-wrap items-start gap-2">
      {toWrite > 0 && (
        <ActionForm action={writeScripts}>
          <input type="hidden" name="clientId" value={clientId} />
          <SubmitButton pendingText="Starting…">Write {plural(toWrite, "script")}</SubmitButton>
        </ActionForm>
      )}
      {toRevise > 0 && (
        <ActionForm action={writeScripts}>
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="mode" value="revise" />
          <SubmitButton variant={toWrite ? "secondary" : "primary"} pendingText="Starting…">
            Make the client&apos;s changes ({toRevise})
          </SubmitButton>
        </ActionForm>
      )}
      {toSend > 0 && (
        <ActionForm action={sendScripts}>
          <input type="hidden" name="clientId" value={clientId} />
          <SubmitButton variant={toWrite || toRevise ? "secondary" : "primary"} pendingText="Sending…">
            Send {plural(toSend, "script")} to the client
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}

// The browser's offset from UTC, set once it runs, so the shoot's time is stored as meant.
function TzOffset() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.value = String(new Date().getTimezoneOffset());
  }, []);
  return <input ref={ref} type="hidden" name="tzOffset" defaultValue="0" />;
}

export function ShootDayForm({
  clientId,
  videos,
  videographers,
  isAdmin,
  defaultVideographer,
}: {
  clientId: string;
  videos: { id: string; title: string; approved: boolean; videographer: string | null }[];
  videographers: Person[];
  isAdmin: boolean;
  defaultVideographer: string;
}) {
  return (
    <ActionForm action={scheduleShootDay} resetOnSuccess className="flex flex-col gap-4">
      <input type="hidden" name="clientId" value={clientId} />
      <TzOffset />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[12px] font-medium text-muted">Videos to shoot that day</legend>
        {videos.map((v) => (
          <label key={v.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[13.5px] text-ink">
            <input type="checkbox" name="video" value={v.id} defaultChecked={v.approved} className="h-4 w-4 accent-[#f6d43a]" />
            {v.title}
            {!v.approved && <span className="text-xs text-warning">script not approved yet</span>}
            {v.videographer && <span className="text-xs text-muted">· {v.videographer}</span>}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label text="Starts">
          <Input name="startsAt" type="datetime-local" required />
        </Label>
        <Label text="Ends">
          <Input name="endsAt" type="datetime-local" />
        </Label>
        <Label text="Place">
          <Input name="location" placeholder="At the client's, 4321 rue Saint-Denis" />
        </Label>
        {isAdmin && (
          <Label text="Videographer">
            <Select name="videographerId" defaultValue={defaultVideographer}>
              <option value="">The one on each video</option>
              {videographers.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Label>
        )}
      </div>
      <Label text="What's needed">
        <Textarea name="needs" rows={2} placeholder="Gimbal, two lav mics, the products, the team in uniform" />
      </Label>
      <div>
        <SubmitButton pendingText="Scheduling…">Schedule and tell the videographer</SubmitButton>
      </div>
    </ActionForm>
  );
}
