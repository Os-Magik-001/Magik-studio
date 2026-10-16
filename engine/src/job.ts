// One edit job: gather inputs, have Claude plan the cut, render, hand to the editor.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { config, db } from "./config.ts";
import { contactSheets, download, probe } from "./media.ts";
import { EditPlan, planEdit, validatePlan, type BrandKit, type Clip } from "./plan.ts";
import { render } from "./render.ts";
import { transcribe, transcriptionAvailable } from "./transcribe.ts";

export const log = (job: string | null, msg: string) =>
  console.log(`${new Date().toISOString()} ${job ? `[${job.slice(0, 8)}] ` : ""}${msg}`);

export type Job = { id: string; video_id: string; source: "launch" | "editor_fix" | "client_changes"; instructions: string | null; base_version_id: string | null; attempts: number };

// ---------------------------------------------------------------- queue

export async function recoverStale() {
  // A job left "running" for an hour means its worker died. Retry it, up to 3 tries.
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data } = await db.from("edit_jobs").select("id, attempts").eq("status", "running").lt("started_at", cutoff);
  for (const j of data ?? []) {
    await db
      .from("edit_jobs")
      .update(
        j.attempts >= 3
          ? { status: "failed", error: "The engine stopped while working on this edit.", progress: null, finished_at: new Date().toISOString() }
          : { status: "queued", progress: null },
      )
      .eq("id", j.id)
      .eq("status", "running");
  }
}

export async function claim(): Promise<Job | null> {
  const { data: queued } = await db
    .from("edit_jobs")
    .select("id, video_id")
    .eq("status", "queued")
    .order("created_at")
    .limit(10);
  for (const candidate of queued ?? []) {
    const { count } = await db
      .from("edit_jobs")
      .select("id", { count: "exact", head: true })
      .eq("video_id", candidate.video_id)
      .eq("status", "running");
    if (count) continue; // one edit per video at a time
    const { data: current } = await db.from("edit_jobs").select("attempts").eq("id", candidate.id).single();
    // Conditional update: only one worker can move it out of "queued".
    const { data: claimed } = await db
      .from("edit_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        attempts: (current?.attempts ?? 0) + 1,
        progress: "Starting",
        error: null,
      })
      .eq("id", candidate.id)
      .eq("status", "queued")
      .select("id, video_id, source, instructions, base_version_id, attempts")
      .maybeSingle();
    if (claimed) return claimed as Job;
  }
  return null;
}

const progress = (jobId: string, text: string) => {
  log(jobId, text);
  return db.from("edit_jobs").update({ progress: text }).eq("id", jobId).eq("status", "running");
};

async function notify(videoId: string, title: string, body?: string) {
  const { data: video } = await db.from("videos").select("editor_id").eq("id", videoId).single();
  const { data: admins } = await db.from("profiles").select("id").eq("role", "admin");
  const ids = new Set<string>([...(admins ?? []).map((a) => a.id), ...(video?.editor_id ? [video.editor_id] : [])]);
  if (ids.size) {
    await db.from("notifications").insert([...ids].map((user_id) => ({ user_id, video_id: videoId, kind: "version_ready", title, body: body ?? null })));
  }
}

// ---------------------------------------------------------------- one job

// `planner` is injectable so tests can run the whole pipeline without calling Claude.
export async function processJob(job: Job, planner: typeof planEdit = planEdit) {
  const dir = path.join(config.workDir, job.id);
  await mkdir(dir, { recursive: true });
  try {
    await progress(job.id, "Gathering the script, brand kit and footage");
    const { data: video } = await db.from("videos").select("*").eq("id", job.video_id).single();
    if (!video) throw new Error("The video no longer exists.");
    const [{ data: client }, { data: kit }, { data: script }, { data: footage }] = await Promise.all([
      db.from("clients").select("name").eq("id", video.client_id).single(),
      db.from("brand_kits").select("*").eq("client_id", video.client_id).maybeSingle(),
      db.from("scripts").select("body, shot_list, status").eq("video_id", video.id).maybeSingle(),
      db.from("footage").select("storage_path, file_name").eq("video_id", video.id).order("created_at"),
    ]);
    if (script?.status !== "approved") throw new Error("The script isn't approved yet.");
    if (!footage?.length) throw new Error("There's no footage on this video.");

    // Download and inspect every file; skip anything that isn't video.
    const clips: Clip[] = [];
    for (const [i, f] of footage.entries()) {
      const file = path.join(dir, "footage", `${i}-${path.basename(f.storage_path)}`);
      await progress(job.id, `Downloading footage ${i + 1} of ${footage.length}`);
      await download("footage", f.storage_path, file);
      const p = await probe(file);
      if (!p.hasVideo || p.duration < 0.5) {
        log(job.id, `Skipping ${f.file_name}: not a usable video`);
        continue;
      }
      clips.push({ id: `C${clips.length + 1}`, fileName: f.file_name, file, duration: p.duration, width: p.width, height: p.height, hasAudio: p.hasAudio, sheets: [], interval: 1, transcript: null });
    }
    if (!clips.length) throw new Error("None of the footage files could be read as video.");

    // Sample frames so the whole shoot fits in one look.
    const total = clips.reduce((s, c) => s + c.duration, 0);
    const interval = Math.max(0.5, Math.ceil((total / config.maxFrames) * 2) / 2);
    await progress(job.id, "Watching the footage");
    for (const clip of clips) {
      clip.interval = interval;
      clip.sheets = await contactSheets(clip.file, path.join(dir, "sheets", clip.id), interval);
      if (clip.hasAudio && (await transcriptionAvailable())) {
        await progress(job.id, `Transcribing ${clip.id}`);
        clip.transcript = await transcribe(clip.file, dir);
      }
    }

    // Revisions start from the previous cut and its open comments.
    let previous = null;
    if (job.base_version_id) {
      const { data: base } = await db.from("versions").select("number, edit_plan").eq("id", job.base_version_id).single();
      const parsed = EditPlan.safeParse(base?.edit_plan);
      if (base && parsed.success) {
        const { data: comments } = await db
          .from("comments")
          .select("timecode_ms, body, author:profiles(role)")
          .eq("version_id", job.base_version_id)
          .eq("resolved", false)
          .is("parent_id", null)
          .order("timecode_ms", { ascending: true, nullsFirst: true });
        previous = {
          number: base.number,
          plan: parsed.data,
          comments: (comments ?? []).map((c) => ({ timecodeMs: c.timecode_ms, body: c.body, fromClient: c.author?.role === "client" })),
        };
      }
    }

    let logoFile: string | null = null;
    if (kit?.logo_path) {
      logoFile = path.join(dir, "logo" + path.extname(kit.logo_path));
      await download("brand", kit.logo_path, logoFile).catch(() => (logoFile = null));
    }
    const brandKit: BrandKit | null = kit
      ? { colors: kit.colors, fonts: kit.fonts, musicMood: kit.music_mood, styleRules: kit.style_rules, hasLogo: !!logoFile }
      : null;

    await progress(job.id, "Claude is planning the cut");
    const shots = Array.isArray(script.shot_list)
      ? (script.shot_list as { text?: string }[]).map((s) => s?.text ?? "").filter(Boolean)
      : [];
    const { plan: raw, usage } = await planner({
      clientName: client?.name ?? "Client",
      title: video.title,
      format: video.format.replace("_", " "),
      aspect: video.aspect,
      brief: video.brief,
      script: script.body,
      shots,
      brandKit,
      instructions: job.instructions,
      source: job.source,
      clips,
      previous,
    });
    log(job.id, usage);
    const { plan, problems, length } = validatePlan(raw, clips);
    problems.forEach((p) => log(job.id, `plan fix: ${p}`));

    await progress(job.id, `Rendering ${length.toFixed(1)}s`);
    const out = path.join(dir, "cut.mp4");
    await render({ plan, clips, aspect: video.aspect, brand: { colors: kit?.colors ?? [], fonts: kit?.fonts ?? [], logoFile }, workDir: dir, output: out });
    const rendered = await probe(out);

    // The editor may have cancelled while Claude was working.
    const { data: still } = await db.from("edit_jobs").select("status").eq("id", job.id).single();
    if (still?.status !== "running") {
      log(job.id, `stopped: job is now ${still?.status}`);
      return;
    }

    await progress(job.id, "Uploading the draft");
    const { data: last } = await db.from("versions").select("number").eq("video_id", video.id).order("number", { ascending: false }).limit(1).maybeSingle();
    const number = (last?.number ?? 0) + 1;
    const objectPath = `${video.id}/${randomUUID()}-claude-v${number}.mp4`;
    const { error: upErr } = await db.storage
      .from("versions")
      .upload(objectPath, await readFile(out), { contentType: "video/mp4", upsert: false });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const notes = [
      plan.summary,
      plan.open_questions.length ? `Check: ${plan.open_questions.join(" ")}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const { data: version, error: vErr } = await db
      .from("versions")
      .insert({
        video_id: video.id,
        number,
        storage_path: objectPath,
        file_name: `${video.title} v${number}.mp4`,
        made_by: "claude",
        notes,
        edit_plan: plan,
      })
      .select("id")
      .single();
    if (vErr || !version) {
      await db.storage.from("versions").remove([objectPath]);
      throw new Error(`Couldn't save the version: ${vErr?.message}`);
    }

    await db
      .from("edit_jobs")
      .update({ status: "done", progress: null, finished_at: new Date().toISOString(), result_version_id: version.id })
      .eq("id", job.id)
      .eq("status", "running");
    await db.from("videos").update({ status: "editor_check" }).eq("id", video.id);
    await notify(video.id, `Claude's v${number} is ready for your check: ${video.title}`, `${rendered.duration.toFixed(1)}s. ${plan.summary}`);
    log(job.id, `done: v${number}, ${rendered.duration.toFixed(1)}s`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(job.id, `failed: ${message}`);
    await db
      .from("edit_jobs")
      .update({ status: "failed", progress: null, error: message.slice(0, 1000), finished_at: new Date().toISOString() })
      .eq("id", job.id)
      .eq("status", "running");
    const { data: video } = await db.from("videos").select("title").eq("id", job.video_id).maybeSingle();
    if (video) await notify(job.video_id, `Claude couldn't finish the edit: ${video.title}`, message.slice(0, 280));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
