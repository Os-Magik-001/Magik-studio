"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth";
import { claudeConfigured } from "@/lib/claude";
import { asPlan, type PlanIdea } from "@/lib/agent-types";
import { answeredCount, readAnswers } from "@/lib/questionnaire";
import { queueRuns, startProduction, startWorkers } from "@/lib/production";
import { deliver } from "@/lib/notify";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { done, fail, optionalText, text, type ActionResult } from "@/lib/action-result";

// The client's Production panel: each step of making the month's videos is one click, and the
// agents do the work in the background (@/lib/production).

const NOT_CONNECTED = "The agents aren't connected yet: ANTHROPIC_API_KEY is missing.";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// The client, if the signed-in studio member may work on it (RLS).
async function visibleClient(clientId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) return null;
  const { data } = await (await createClient()).from("clients").select("id, name").eq("id", clientId).maybeSingle();
  return data;
}

// Runs of an agent already waiting or at work for this client (or these videos).
async function openRuns(clientId: string, agent: "strategist" | "planner" | "scriptwriter") {
  const { data } = await createAdminClient().from("agent_runs").select("id, video_id").eq("client_id", clientId).eq("agent", agent).in("status", ["queued", "running"]);
  return data ?? [];
}

// ---------------------------------------------------------------- 1. strategy and research

export async function startProductionNow(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  if (!claudeConfigured()) return fail(NOT_CONNECTED);
  const client = await visibleClient(text(formData, "clientId"));
  if (!client) return fail("Client not found.");
  const { data: form } = await createAdminClient().from("brand_questionnaires").select("answers").eq("client_id", client.id).maybeSingle();
  if (answeredCount(readAnswers(form?.answers)) < 4) return fail("The questionnaire needs at least 4 answers first: the client fills it in during onboarding, or you can on Brand & strategy.");
  if (!(await startProduction(client.id, viewer.id))) return fail("The brand strategist is already at work.");
  refresh();
  return done("The brand strategist is at work. The trend research starts on the edit engine as soon as the strategy is ready.");
}

// ---------------------------------------------------------------- 2. the month's plan

export async function planMonth(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  if (!claudeConfigured()) return fail(NOT_CONNECTED);
  const client = await visibleClient(text(formData, "clientId"));
  if (!client) return fail("Client not found.");
  const count = Math.round(Number(text(formData, "count")));
  if (!(count >= 1 && count <= 12)) return fail("Plan between 1 and 12 videos.");
  const { data: strategy } = await createAdminClient().from("brand_strategies").select("client_id").eq("client_id", client.id).maybeSingle();
  if (!strategy) return fail("Run the brand strategist first: the plan builds on the strategy.");
  if ((await openRuns(client.id, "planner")).length) return fail("The content planner is already planning.");

  await queueRuns([{ agent: "planner", client_id: client.id, input: { count }, requested_by: viewer.id }]);
  await startWorkers(1);
  refresh();
  return done(`The content planner is planning ${plural(count, "video")} (about a minute).`);
}

// The ideas the studio keeps become videos, each with its brief; their scripts start right away
// unless asked not to.
export async function createPlannedVideos(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin");
  const runId = text(formData, "runId");
  const admin = createAdminClient();
  const { data: run } = await admin.from("agent_runs").select("id, client_id, agent, status, output").eq("id", runId).maybeSingle();
  if (!run || run.agent !== "planner" || run.status !== "done") return fail("Plan not found.");
  const client = await visibleClient(run.client_id);
  if (!client) return fail("Client not found.");
  const plan = asPlan(run.output);
  if (!plan) return fail("Plan not found.");

  const picked = new Set(formData.getAll("idea").map((v) => Number(v)));
  const ideas = plan.ideas.map((idea, i) => ({ idea, i })).filter(({ idea, i }) => picked.has(i) && !idea.video_id);
  if (!ideas.length) return fail("Pick at least one idea.");
  const editorId = optionalText(formData, "editorId");
  const videographerId = optionalText(formData, "videographerId");
  const dueOn = optionalText(formData, "dueOn");
  const writeNow = formData.get("writeScripts") === "on";
  if (writeNow && !claudeConfigured()) return fail(NOT_CONNECTED);

  const brief = (idea: PlanIdea) =>
    [idea.brief, `Hook: ${idea.hook}`, `Pillar: ${idea.pillar} · Goal: ${idea.goal}`, `About ${Math.round(idea.length_seconds)} seconds.`, idea.why && `Why it should work: ${idea.why}`].filter(Boolean).join("\n\n");
  const { data: created, error } = await admin
    .from("videos")
    .insert(
      ideas.map(({ idea }) => ({
        client_id: client.id,
        title: idea.title.slice(0, 160),
        format: idea.format,
        aspect: "9:16",
        brief: brief(idea),
        editor_id: editorId,
        videographer_id: videographerId,
        due_on: dueOn,
        created_by: viewer.id,
      })),
    )
    .select("id, title");
  if (error || !created?.length) return fail("Couldn't create the videos.");
  await admin.from("scripts").insert(created.map((v) => ({ video_id: v.id })));

  // The plan remembers which idea became which video.
  const byTitle = new Map(created.map((v) => [v.title, v.id]));
  const ideasOut = plan.ideas.map((idea, i) => (picked.has(i) && !idea.video_id ? { ...idea, video_id: byTitle.get(idea.title.slice(0, 160)) ?? null } : idea));
  await admin.from("agent_runs").update({ output: { ...plan, ideas: ideasOut } as unknown as Json }).eq("id", run.id);

  if (editorId && editorId !== viewer.id) {
    await deliver([
      {
        user_id: editorId,
        client_id: client.id,
        kind: "production",
        title: `${client.name}: ${plural(created.length, "new video")} for you`,
        body: created.map((v) => v.title).join(" · "),
      },
    ]);
  }
  if (writeNow) {
    await queueRuns(created.map((v) => ({ agent: "scriptwriter" as const, client_id: client.id, video_id: v.id, requested_by: viewer.id })));
    await startWorkers(Math.min(3, created.length));
  }
  refresh();
  return done(writeNow ? `${plural(created.length, "video")} created. The scriptwriter is writing their scripts.` : `${plural(created.length, "video")} created.`);
}

// ---------------------------------------------------------------- 3. scripts

// The scriptwriter writes the scripts of the client's videos that have a brief and no script
// yet; with `revise`, it makes the changes the client asked for instead.
export async function writeScripts(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  if (!claudeConfigured()) return fail(NOT_CONNECTED);
  const client = await visibleClient(text(formData, "clientId"));
  if (!client) return fail("Client not found.");
  const revise = text(formData, "mode") === "revise";

  const supabase = await createClient();
  const { data: videos } = await supabase.from("videos").select("id, brief, status, scripts(body, status)").eq("client_id", client.id).in("status", ["script", "shoot"]);
  const busy = new Set((await openRuns(client.id, "scriptwriter")).map((r) => r.video_id));
  const todo = (videos ?? []).filter((v) => {
    if (busy.has(v.id)) return false;
    const s = v.scripts;
    return revise ? s?.status === "changes_requested" : !!v.brief?.trim() && !s?.body.trim() && s?.status !== "approved";
  });
  if (!todo.length) return fail(revise ? "No script is waiting for changes." : busy.size ? "The scriptwriter is already on them." : "Every video with a brief has its script. Add a video or a brief first.");

  await queueRuns(todo.map((v) => ({ agent: "scriptwriter" as const, client_id: client.id, video_id: v.id, input: revise ? { mode: "revise" } : {}, requested_by: viewer.id })));
  await startWorkers(Math.min(3, todo.length));
  refresh();
  return done(revise ? `The scriptwriter is making the client's changes on ${plural(todo.length, "script")}.` : `The scriptwriter is writing ${plural(todo.length, "script")}. They appear here as they're ready.`);
}

// Every finished draft goes to the client at once, with one message.
export async function sendScripts(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  const client = await visibleClient(text(formData, "clientId"));
  if (!client) return fail("Client not found.");
  const supabase = await createClient();
  const { data: videos } = await supabase.from("videos").select("id, title, scripts(body, status)").eq("client_id", client.id);
  const busy = new Set((await openRuns(client.id, "scriptwriter")).map((r) => r.video_id));
  const ready = (videos ?? []).filter((v) => v.scripts?.status === "draft" && v.scripts.body.trim() && !busy.has(v.id));
  if (!ready.length) return fail("No finished script is waiting to be sent.");

  const admin = createAdminClient();
  const { error } = await admin.from("scripts").update({ status: "client_review", client_note: null }).in("video_id", ready.map((v) => v.id)).eq("status", "draft");
  if (error) return fail("Couldn't send the scripts.");
  const { data: people } = await admin.from("profiles").select("id").eq("client_id", client.id).eq("role", "client");
  const others = (people ?? []).filter((p) => p.id !== viewer.id);
  if (others.length) {
    await deliver(
      others.map((p) => ({
        user_id: p.id,
        client_id: client.id,
        // One script opens it; several open the list.
        video_id: ready.length === 1 ? ready[0].id : null,
        kind: "script_ready",
        title: ready.length === 1 ? `Script ready for your approval: ${ready[0].title}` : `${ready.length} scripts are ready for your approval`,
        body: ready.length > 1 ? ready.map((v) => v.title).join(" · ") : null,
      })),
    );
  }
  refresh();
  return done(`${plural(ready.length, "script")} sent to the client for approval.`);
}

// ---------------------------------------------------------------- 4. shoots

// One shoot day for several videos: each gets its shoot, and the videographer gets one message.
export async function scheduleShootDay(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  const client = await visibleClient(text(formData, "clientId"));
  if (!client) return fail("Client not found.");
  const ids = [...new Set(formData.getAll("video").map(String))];
  if (!ids.length) return fail("Pick the videos to shoot.");
  const startsAt = text(formData, "startsAt");
  const endsAt = optionalText(formData, "endsAt");
  if (!startsAt) return fail("Pick when the shoot starts.");
  // datetime-local has no zone; the browser sends its offset so we store the right instant.
  const tz = Number(text(formData, "tzOffset") || "0");
  const toIso = (local: string) => new Date(Date.parse(local + "Z") + tz * 60_000).toISOString();
  const starts = toIso(startsAt);
  const ends = endsAt ? toIso(endsAt) : null;
  if (Number.isNaN(Date.parse(starts))) return fail("Pick when the shoot starts.");
  if (ends && ends <= starts) return fail("The shoot has to end after it starts.");

  const supabase = await createClient();
  const { data: videos } = await supabase.from("videos").select("id, title, videographer_id").eq("client_id", client.id).in("id", ids);
  if (!videos?.length) return fail("Pick the videos to shoot.");
  // Only the studio manager assigns people; an editor schedules for the videographer on the video.
  const chosen = viewer.role === "admin" ? optionalText(formData, "videographerId") : null;
  const missing = videos.filter((v) => !v.videographer_id && !chosen);
  if (missing.length) return fail(viewer.role === "admin" ? "Pick the videographer." : `Ask the studio manager to assign a videographer to ${missing.map((v) => v.title).join(", ")}.`);

  const admin = createAdminClient();
  if (chosen) {
    const { data: who } = await admin.from("profiles").select("id").eq("id", chosen).eq("role", "videographer").maybeSingle();
    if (!who) return fail("Pick the videographer.");
    await admin.from("videos").update({ videographer_id: chosen }).in("id", videos.map((v) => v.id));
  }
  const location = optionalText(formData, "location");
  const needs = optionalText(formData, "needs");
  const { error } = await supabase.from("shoots").insert(videos.map((v) => ({ video_id: v.id, starts_at: starts, ends_at: ends, location, needs })));
  if (error) return fail("Couldn't schedule the shoot.");

  const crew = new Map<string, string[]>();
  for (const v of videos) {
    const who = chosen ?? v.videographer_id!;
    crew.set(who, [...(crew.get(who) ?? []), v.title]);
  }
  // The wall-clock time as it was picked, for the message.
  const when = new Date(startsAt + "Z").toLocaleString("en-CA", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  await deliver(
    [...crew].filter(([id]) => id !== viewer.id).map(([user_id, titles]) => ({
      user_id,
      client_id: client.id,
      video_id: titles.length === 1 ? videos.find((v) => v.title === titles[0])!.id : null,
      kind: "shoot_scheduled",
      title: `Shoot for ${client.name}${when ? `: ${when}` : ""}`,
      body: `${plural(titles.length, "video")}: ${titles.join(" · ")}${location ? `. At ${location}.` : ""}`,
    })),
  );
  refresh();
  return done(`Shoot scheduled for ${plural(videos.length, "video")}. The videographer has the shoot plans.`);
}
