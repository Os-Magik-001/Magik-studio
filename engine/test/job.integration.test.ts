// Runs real edit jobs against the linked Supabase project, with a stand-in for
// Claude's planner. Opt in with ENGINE_INTEGRATION=1; cleans up after itself.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { db } from "../src/config.ts";
import { processJob, type Job } from "../src/job.ts";
import type { EditPlan, PlanInput } from "../src/plan.ts";
import { CUT, makeClip, makeLogo, shot } from "./fixtures.ts";

const enabled = process.env.ENGINE_INTEGRATION === "1";
const tag = `engine-it-${Date.now().toString(36)}`;
let dir: string;
let clientId: string;
let videoId: string;
let editorId: string;

async function queue(fields: Partial<Job> & { source: Job["source"] }) {
  const { data, error } = await db
    .from("edit_jobs")
    .insert({ video_id: videoId, source: fields.source, instructions: fields.instructions ?? null, base_version_id: fields.base_version_id ?? null, status: "running", attempts: 1, started_at: new Date().toISOString() })
    .select("id, video_id, source, instructions, base_version_id, attempts")
    .single();
  if (error) throw error;
  return data as Job;
}

before(async () => {
  if (!enabled) return;
  dir = await mkdtemp(path.join(os.tmpdir(), "magik-it-"));
  const { data: u } = await db.auth.admin.createUser({ email: `${tag}@example.com`, email_confirm: true });
  editorId = u.user!.id;
  await db.from("profiles").insert({ id: editorId, email: `${tag}@example.com`, role: "editor", full_name: "IT editor" });
  const { data: c } = await db.from("clients").insert({ name: tag }).select("id").single();
  clientId = c!.id;
  const logo = path.join(dir, "logo.png");
  await makeLogo(logo);
  await db.storage.from("brand").upload(`${clientId}/logo.png`, await readFile(logo), { contentType: "image/png" });
  await db.from("brand_kits").insert({ client_id: clientId, colors: ["#1E1D1B", "#F2C14E"], fonts: ["Inter"], style_rules: "Captions always on.", logo_path: `${clientId}/logo.png` });
  const { data: v } = await db.from("videos").insert({ client_id: clientId, title: "IT launch", aspect: "9:16", status: "editing", editor_id: editorId }).select("id").single();
  videoId = v!.id;
  await db.from("scripts").insert({ video_id: videoId, body: "Hook on the pour. End with Available now.", shot_list: [{ text: "Pour" }, { text: "Barista" }], status: "approved" });
  for (const [i, spec] of [
    { label: "POUR", w: 1280, h: 720, seconds: 4, tone: 440, color: "#8B5A2B" },
    { label: "BARISTA", w: 720, h: 1280, seconds: 3, tone: null, color: "#2E6BD8" },
  ].entries()) {
    const file = path.join(dir, `take${i}.mp4`);
    await makeClip({ ...spec, file });
    const storagePath = `${videoId}/take${i}.mp4`;
    await db.storage.from("footage").upload(storagePath, await readFile(file), { contentType: "video/mp4" });
    await db.from("footage").insert({ video_id: videoId, storage_path: storagePath, file_name: `take${i}.mp4` });
  }
});

after(async () => {
  if (!enabled) return;
  for (const bucket of ["footage", "versions"]) {
    const { data } = await db.storage.from(bucket).list(videoId);
    if (data?.length) await db.storage.from(bucket).remove(data.map((o) => `${videoId}/${o.name}`));
  }
  await db.storage.from("brand").remove([`${clientId}/logo.png`]);
  await db.from("clients").delete().eq("id", clientId);
  await db.auth.admin.deleteUser(editorId);
  await rm(dir, { recursive: true, force: true });
});

const firstCut: EditPlan = {
  look: "natural",
  summary: "Pour hook, then the barista, then the end card.",
  segments: [
    shot("C1", 0.5, 2.5, "hook: pour"),
    shot("C2", 0, 2, "barista"),
  ],
  on_screen_text: [{ text: "Pumpkin latte is back", start: 0, end: 2, style: "title", position: "top" }],
  end_card: { include: true, headline: "Available now", seconds: 1.5, transition: CUT },
  open_questions: ["Is the barista shot bright enough?"],
};

test("first edit: Claude's inputs, the rendered draft and the hand-off", { skip: !enabled }, async () => {
  const job = await queue({ source: "launch", instructions: "Keep it short" });
  let seen: PlanInput | null = null;
  await processJob(job, async (input) => {
    seen = input;
    return { plan: firstCut, usage: "stub" };
  });

  assert.ok(seen, "planner was called");
  const input = seen as PlanInput;
  assert.equal(input.clips.length, 2);
  assert.ok(input.clips.every((c) => c.sheets.length > 0), "every clip has contact sheets");
  assert.equal(input.clips[1].hasAudio, false);
  assert.deepEqual(input.shots, ["Pour", "Barista"]);
  assert.equal(input.brandKit?.hasLogo, true);
  assert.equal(input.previous, null);

  const { data: j } = await db.from("edit_jobs").select("status, error, result_version_id").eq("id", job.id).single();
  assert.equal(j?.status, "done", j?.error ?? "");
  const { data: version } = await db.from("versions").select("number, status, made_by, notes, edit_plan, storage_path").eq("id", j!.result_version_id!).single();
  assert.equal(version?.number, 1);
  assert.equal(version?.status, "draft");
  assert.equal(version?.made_by, "claude");
  assert.match(version?.notes ?? "", /barista shot bright/);
  assert.equal((version?.edit_plan as EditPlan).segments.length, 2);
  const { data: obj } = await db.storage.from("versions").list(videoId);
  assert.ok(obj?.some((o) => version!.storage_path.endsWith(o.name)), "render uploaded");
  const { data: v } = await db.from("videos").select("status").eq("id", videoId).single();
  assert.equal(v?.status, "editor_check");
  const { count } = await db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", editorId).ilike("title", "%v1 is ready%");
  assert.equal(count, 1);
});

test("client changes: Claude gets the previous cut and comments mapped to shots", { skip: !enabled }, async () => {
  const { data: v1 } = await db.from("versions").select("id").eq("video_id", videoId).eq("number", 1).single();
  const { data: clientUser } = await db.auth.admin.createUser({ email: `${tag}-client@example.com`, email_confirm: true });
  await db.from("profiles").insert({ id: clientUser.user!.id, email: `${tag}-client@example.com`, role: "client", client_id: clientId });
  await db.from("comments").insert({ version_id: v1!.id, author_id: clientUser.user!.id, body: "Longer barista shot please", timecode_ms: 2500 });
  await db.from("versions").update({ status: "changes_requested" }).eq("id", v1!.id);

  const job = await queue({ source: "client_changes", base_version_id: v1!.id, instructions: "Client note: warmer" });
  let seen: PlanInput | null = null;
  await processJob(job, async (input) => {
    seen = input;
    return { plan: { ...firstCut, segments: [firstCut.segments[0], shot("C2", 0, 3, "barista, longer")] }, usage: "stub" };
  });
  await db.auth.admin.deleteUser(clientUser.user!.id);

  const prev = (seen as PlanInput | null)?.previous;
  assert.equal(prev?.number, 1);
  assert.equal(prev?.comments.length, 1);
  assert.equal(prev?.comments[0].fromClient, true);
  assert.equal(prev?.comments[0].timecodeMs, 2500);
  const { data: j } = await db.from("edit_jobs").select("status, error").eq("id", job.id).single();
  assert.equal(j?.status, "done", j?.error ?? "");
  const { data: v2 } = await db.from("versions").select("number").eq("video_id", videoId).order("number", { ascending: false }).limit(1).single();
  assert.equal(v2?.number, 2);
});

test("a planner failure marks the job failed and tells the editor", { skip: !enabled }, async () => {
  const job = await queue({ source: "editor_fix", instructions: "Tighter" });
  await processJob(job, async () => {
    throw new Error("Claude declined to plan this edit.");
  });
  const { data: j } = await db.from("edit_jobs").select("status, error").eq("id", job.id).single();
  assert.equal(j?.status, "failed");
  assert.equal(j?.error, "Claude declined to plan this edit.");
  const { count } = await db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", editorId).ilike("title", "Claude couldn't finish%");
  assert.equal(count, 1);
});
