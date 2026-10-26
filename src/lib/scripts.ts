import "server-only";
import { asShootPlan } from "@/lib/agent-types";
import { describeDesigns, describeThread, reviseScript, runMotionDirector, runScriptwriter, type DesignChoice } from "@/lib/agents";
import { DESIGN_TEMPLATES, templateById } from "@/lib/design-templates";
import { asFindings } from "@/lib/agent-types";
import { clientMemory } from "@/lib/memory";
import { motionLibrary } from "@/lib/motion-prompts";
import { describeReferences, loadReferences } from "@/lib/references";
import type { Json } from "@/lib/database.types";
import { createAdminClient, type Db } from "@/lib/supabase/admin";
import { parseShotList, type RevisionKind, type ScriptStatus } from "@/lib/workflow";

// A script's versions, its thread and the scriptwriter, shared by the video page's actions and
// the agents' background worker (@/lib/production).

// ---------------------------------------------------------------- versions and the thread

// Every version of a script stays in its thread (script_revisions) with what was asked for it,
// so the studio can go back to any version and the agents remember what was asked.
export type Version = { body: string; shot_list: Json; shoot_plan: Json | null; edit_prompt: string | null; beats: Json | null };
export type CurrentScript = Version & { video_id: string; status: ScriptStatus; approved_by: string | null; drafted_by_claude: boolean; updated_at: string };

export const sameText = (a: string | null, b: string | null) => (a ?? "").trim() === (b ?? "").trim();
const shotTexts = (shots: Json) => parseShotList(shots).map((s) => s.text).join("\n");
export const sameVersion = (a: Version, b: Version) =>
  sameText(a.body, b.body) && sameText(a.edit_prompt, b.edit_prompt) && shotTexts(a.shot_list) === shotTexts(b.shot_list) && JSON.stringify(a.shoot_plan) === JSON.stringify(b.shoot_plan);
export const versionOf = (s: Version): Version => ({ body: s.body, shot_list: s.shot_list, shoot_plan: s.shoot_plan, edit_prompt: s.edit_prompt, beats: s.beats ?? null });

export async function record(videoId: string, kind: RevisionKind, by: string | null, entry: { request?: string | null; reply?: string | null; version?: Version; restoredFrom?: string; at?: string } = {}) {
  await createAdminClient()
    .from("script_revisions")
    .insert({
      video_id: videoId,
      kind,
      request: entry.request ?? null,
      reply: entry.reply ?? null,
      ...entry.version,
      restored_from: entry.restoredFrom ?? null,
      created_by: by,
      ...(entry.at ? { created_at: entry.at } : {}),
    });
}

// The thread starts with the script as it was before its first recorded change, so that
// version can always come back.
export async function keepCurrent(script: CurrentScript | null) {
  if (!script || (!script.body.trim() && !script.edit_prompt?.trim())) return;
  const { count } = await createAdminClient()
    .from("script_revisions")
    .select("id", { count: "exact", head: true })
    .eq("video_id", script.video_id)
    .neq("kind", "client");
  if (count === 0) await record(script.video_id, script.drafted_by_claude ? "written" : "edited", null, { version: versionOf(script), at: script.updated_at });
}

// A client's approval covers the script they read: when the script itself changes it goes
// back to draft. A new shot list or edit prompt, or a script the studio approved itself
// (fast track), stays approved.
export async function approvalAfter(current: CurrentScript, body: string, viewerId: string | null): Promise<{ status?: ScriptStatus; approved_by?: string | null; approved_at?: string | null }> {
  if (sameText(current.body, body)) return {};
  if (current.status !== "approved") return { status: "draft" };
  const { data: approver } = current.approved_by
    ? await createAdminClient().from("profiles").select("role").eq("id", current.approved_by).maybeSingle()
    : { data: null };
  if (approver && approver.role !== "client") return { approved_by: viewerId, approved_at: new Date().toISOString() };
  return { status: "draft", approved_by: null, approved_at: null };
}

// A shot keeps its tick from the set when the new list still has it.
export function withTicks(shots: string[], before: Json | undefined) {
  const ticked = new Set(parseShotList(before).filter((s) => s.done).map((s) => s.text));
  return shots.map((s) => (ticked.has(s) ? { text: s, done: true } : { text: s }));
}

// ---------------------------------------------------------------- motion design

// The design templates chosen for a video, as the agents read them: the studio's own, and
// motion prompts the team saved ("prompt:<id>").
export async function designChoices(ids: string[] | null | undefined, db: Db): Promise<DesignChoice[]> {
  const saved = (ids ?? []).filter((id) => id.startsWith("prompt:")).map((id) => id.slice(7));
  const { data: prompts } = saved.length ? await db.from("motion_prompts").select("id, title, prompt, creator").in("id", saved) : { data: [] };
  return (ids ?? []).flatMap((id): DesignChoice[] => {
    const own = templateById(id);
    if (own) return [{ id, title: own.title, direction: own.direction }];
    const p = prompts?.find((x) => `prompt:${x.id}` === id);
    return p ? [{ id, title: `${p.title}${p.creator ? ` (by ${p.creator})` : ""}`, direction: p.prompt }] : [];
  });
}

// Designed graphics: the client's brand kit asks for them, or templates were chosen for the video.
export const isDesigned = (graphics: string | null | undefined, templates: string[] | null | undefined) => graphics === "designed" || !!templates?.length;

const LIBRARY = DESIGN_TEMPLATES.map(({ id, title, category, summary }) => ({ id, title, category, summary }));

// The motion director designs the video's motion from its script; the brief is saved on the
// script for the engine's motion designer.
export async function direct(videoId: string, input: Omit<Parameters<typeof runMotionDirector>[0], "library">, db: Db) {
  const brief = await runMotionDirector({ ...input, library: LIBRARY });
  const { error } = await db.from("scripts").update({ design_brief: brief }).eq("video_id", videoId);
  if (error) throw new Error("The design brief was written but couldn't be saved.");
  return brief;
}

// ---------------------------------------------------------------- the scriptwriter

// The brand strategy, the latest trend research, the brief and the references become the
// script (as beats), the videographer's shoot plan and the edit prompt; the motion director
// designs it right away when the video's graphics are designed. Throws with a plain reason.
// `db`: the caller's client (RLS) from the video page, the server's own from the worker.
export async function writeScript(videoId: string, { by, notes = "", db }: { by: string | null; notes?: string; db: Db }) {
  const admin = createAdminClient();
  const { data: video } = await db.from("videos").select("id, client_id, title, format, aspect, brief").eq("id", videoId).maybeSingle();
  if (!video) throw new Error("Video not found.");
  if (!video.client_id) throw new Error("This video has no client.");
  if (!video.brief?.trim()) throw new Error("Add the brief first: the scriptwriter writes from it.");

  const [{ data: client }, { data: kit }, { data: script }, { data: strategy }, { data: report }, { data: thread }, memory, motion, references] = await Promise.all([
    db.from("clients").select("name").eq("id", video.client_id).single(),
    db.from("brand_kits").select("style_rules, graphics").eq("client_id", video.client_id).maybeSingle(),
    db.from("scripts").select("*").eq("video_id", videoId).maybeSingle(),
    admin.from("brand_strategies").select("niche, business, audience, needs, pillars, charte").eq("client_id", video.client_id).maybeSingle(),
    admin.from("trend_reports").select("id, findings").eq("client_id", video.client_id).eq("status", "done").order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("script_revisions").select("kind, request, reply").eq("video_id", videoId).order("created_at"),
    clientMemory(video.client_id, { except: videoId }, db),
    motionLibrary([video.title, video.brief, notes].filter(Boolean).join(" "), db),
    loadReferences(video.client_id, videoId, db),
  ]);
  if (script?.status === "approved") throw new Error("This script is already approved.");

  const chosen = await designChoices(script?.design_templates, db);
  const brand = {
    clientName: client?.name ?? "Client",
    strategy,
    findings: asFindings(report?.findings),
    styleRules: kit?.style_rules ?? null,
    memory: memory.text,
    motion: motion.text,
  };
  const draft = await runScriptwriter({
    ...brand,
    title: video.title,
    format: video.format.replace("_", " "),
    aspect: video.aspect,
    brief: video.brief,
    notes: [notes, script?.client_note && `The client asked for: ${script.client_note}`].filter(Boolean).join("\n"),
    thread: describeThread(thread ?? []),
    designs: describeDesigns(chosen),
    references: describeReferences(references, "script"),
  });
  await keepCurrent(script);
  const version: Version = { body: draft.script, shot_list: draft.shots.map((s) => ({ text: s })), shoot_plan: draft.plan, edit_prompt: draft.edit_prompt, beats: draft.beats };
  const { error } = await db.from("scripts").upsert({
    video_id: videoId,
    ...version,
    trend_report_id: report?.id ?? null,
    status: "draft",
    drafted_by_claude: true,
  });
  if (error) throw new Error("The scriptwriter wrote a draft but it couldn't be saved.");
  await record(videoId, "written", by, { request: notes || null, reply: draft.concept, version });

  // Designed graphics: the motion director designs the new script's scenes right away.
  let design: "done" | "failed" | null = null;
  if (isDesigned(kit?.graphics, script?.design_templates)) {
    design = await direct(
      videoId,
      {
        ...brand,
        title: video.title,
        format: video.format.replace("_", " "),
        aspect: video.aspect,
        brief: video.brief,
        script: draft.script,
        shots: draft.shots,
        editPrompt: draft.edit_prompt,
        chosen,
        references: describeReferences(references, "motion"),
      },
      db,
    ).then(
      () => "done" as const,
      () => "failed" as const,
    );
  }
  return { title: video.title, concept: draft.concept, beats: draft.beats.length, hasStrategy: !!strategy, remembered: memory.count, design };
}

// The scriptwriter changes what it delivered as asked (the studio's request, the client's notes
// or both) and keeps the rest; the motion director follows. Throws with a plain reason.
export async function reviseWithScriptwriter(videoId: string, { by, asked, useClientNote, db }: { by: string | null; asked: string; useClientNote: boolean; db: Db }) {
  const admin = createAdminClient();
  const { data: video } = await db.from("videos").select("id, client_id, title, format, aspect, brief").eq("id", videoId).maybeSingle();
  if (!video) throw new Error("Video not found.");
  if (!video.client_id) throw new Error("This video has no client.");
  const [{ data: client }, { data: kit }, { data: script }, { data: strategy }, { data: report }, { data: thread }, memory, motion, references] = await Promise.all([
    db.from("clients").select("name").eq("id", video.client_id).single(),
    db.from("brand_kits").select("style_rules, graphics").eq("client_id", video.client_id).maybeSingle(),
    db.from("scripts").select("*").eq("video_id", videoId).maybeSingle(),
    admin.from("brand_strategies").select("niche, business, audience, needs, pillars, charte").eq("client_id", video.client_id).maybeSingle(),
    admin.from("trend_reports").select("findings").eq("client_id", video.client_id).eq("status", "done").order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("script_revisions").select("kind, request, reply").eq("video_id", videoId).order("created_at"),
    clientMemory(video.client_id, { except: videoId }, db),
    motionLibrary([video.title, video.brief, asked].filter(Boolean).join(" "), db),
    loadReferences(video.client_id, videoId, db),
  ]);
  if (!script || (!script.body.trim() && !script.edit_prompt?.trim())) throw new Error("There's no script yet. Write one first.");
  const request = useClientNote && script.client_note ? [`The client asked for: ${script.client_note}`, asked].filter(Boolean).join("\n") : asked;
  if (!request) throw new Error("Tell the scriptwriter what to change.");

  const chosen = await designChoices(script.design_templates, db);
  const brand = {
    clientName: client?.name ?? "Client",
    strategy,
    findings: asFindings(report?.findings),
    styleRules: kit?.style_rules ?? null,
    memory: memory.text,
    motion: motion.text,
  };
  const revised = await reviseScript({
    ...brand,
    title: video.title,
    format: video.format.replace("_", " "),
    aspect: video.aspect,
    brief: video.brief,
    current: { script: script.body, shots: parseShotList(script.shot_list).map((s) => s.text), plan: asShootPlan(script.shoot_plan), editPrompt: script.edit_prompt },
    thread: describeThread(thread ?? []),
    request,
    references: describeReferences(references, "script"),
  });

  await keepCurrent(script);
  // The client's changes are made: the script waits to be sent back to them, even when only its
  // shot list or edit prompt moved.
  const approval = script.status === "changes_requested" ? { status: "draft" as const } : await approvalAfter(script, revised.script, by);
  const version: Version = { body: revised.script, shot_list: withTicks(revised.shots, script.shot_list), shoot_plan: revised.plan, edit_prompt: revised.edit_prompt, beats: revised.beats };
  const { error } = await db.from("scripts").update({ ...version, ...approval }).eq("video_id", videoId);
  if (error) throw new Error("The scriptwriter made the changes but they couldn't be saved.");
  await record(videoId, "revised", by, { request, reply: revised.reply, version });

  // The design follows the script: the motion director redesigns from the new version.
  let design: "done" | "failed" | null = null;
  if (isDesigned(kit?.graphics, script.design_templates)) {
    design = await direct(
      videoId,
      {
        ...brand,
        title: video.title,
        format: video.format.replace("_", " "),
        aspect: video.aspect,
        brief: video.brief,
        script: revised.script,
        shots: revised.shots,
        editPrompt: revised.edit_prompt,
        chosen,
        references: describeReferences(references, "motion"),
      },
      db,
    ).then(
      () => "done" as const,
      () => "failed" as const,
    );
  }
  return { title: video.title, reply: revised.reply, backToClient: script.status === "approved" && approval.status === "draft", design };
}
