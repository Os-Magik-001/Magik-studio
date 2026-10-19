// One edit job: gather inputs, have Claude plan the cut, render, hand to the editor.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { config, db } from "./config.ts";
import { contactSheets, download, probe } from "./media.ts";
import { driveWorkingCopy, pruneCache } from "./drive.ts";
import { clientMemory } from "./memory.ts";
import { describeLibrary, loadLibrary, trackFile } from "./music.ts";
import { parseStoredPlan, planEdit, timelineOf, timelineWords, validatePlan, type BrandKit, type Clip, type EditPlan, type PlanInput } from "./plan.ts";
import { render, type Brand } from "./render.ts";
import { reviewRender } from "./review.ts";
import { loadSkills } from "./skills.ts";
import { anchorMotion, tighten } from "./tighten.ts";
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

// ---------------------------------------------------------------- the edit itself

export type Source = { name: string; drive?: string | null; storage?: string | null; file?: string | null };
type Step = (text: string) => unknown;
type Note = (text: string) => void;

// Fetches (Drive), downloads (Storage) or takes (local files) every source, skipping
// anything that isn't video.
export async function prepareClips(sources: Source[], dir: string, step: Step, note: Note, cached: Set<string>) {
  const clips: Clip[] = [];
  for (const [i, f] of sources.entries()) {
    let file: string;
    let preview: string | null = null;
    if (f.drive) {
      const label = `Fetching ${f.name} from Google Drive (${i + 1} of ${sources.length})`;
      await step(label);
      let shown = 0;
      const copy = await driveWorkingCopy(f.drive, (fraction) => {
        const pct = Math.floor(fraction * 100);
        if (pct >= shown + 5) {
          shown = pct;
          void step(`${label}: ${pct}%`);
        }
      });
      if (copy.cached) note(`using the cached copy of ${f.name}`);
      file = copy.file;
      preview = copy.preview;
      cached.add(file).add(preview);
    } else if (f.storage) {
      file = path.join(dir, "footage", `${i}-${path.basename(f.storage)}`);
      await step(`Downloading footage ${i + 1} of ${sources.length}`);
      await download("footage", f.storage, file);
    } else if (f.file) file = f.file;
    else continue;
    const p = await probe(file);
    if (!p.hasVideo || p.duration < 0.5) {
      note(`Skipping ${f.name}: not a usable video`);
      continue;
    }
    clips.push({ id: `C${clips.length + 1}`, fileName: f.name, file, preview: preview ?? file, duration: p.duration, width: p.width, height: p.height, fps: p.fps, hasAudio: p.hasAudio, sheets: [], interval: 1, transcript: null });
  }
  if (!clips.length) throw new Error("None of the footage files could be read as video.");
  return clips;
}

// How Claude watches and listens: contact sheets sampled so the whole shoot fits in
// one look, and transcripts primed with the names it would otherwise mishear.
export async function watchClips(clips: Clip[], dir: string, hint: string, step: Step) {
  const total = clips.reduce((s, c) => s + c.duration, 0);
  const interval = Math.max(0.5, Math.ceil((total / config.maxFrames) * 2) / 2);
  await step("Watching the footage");
  for (const clip of clips) {
    clip.interval = interval;
    clip.sheets = await contactSheets(clip.preview, path.join(dir, "sheets", clip.id), interval);
    if (clip.hasAudio && (await transcriptionAvailable())) {
      await step(`Transcribing ${clip.id}`);
      clip.transcript = await transcribe(clip.preview, dir, hint);
    }
  }
}

export type EditRequest = Omit<PlanInput, "skills" | "clips" | "music"> & { formatKey: string; brand: Brand; selfReview?: boolean; clean?: boolean; bare?: boolean };

// The cut with no graphics at all, for the design pass to design over: the plan's
// captions, titles and motion stay in the plan as the editor's suggestions.
export const bareOf = (plan: EditPlan): EditPlan => ({ ...plan, captions: { ...plan.captions, mode: "off" }, on_screen_text: [], graphics: [], motion: [], end_card: { ...plan.end_card, include: false } });

// Claude plans the cut, the plan is checked against the real footage, and the edit
// renders to `output`.
export async function planAndRender(req: EditRequest, clips: Clip[], dir: string, output: string, step: Step, note: Note, planner: typeof planEdit = planEdit) {
  const { formatKey, brand, clean, bare, ...rest } = req;
  const shown = (plan: EditPlan) => (bare ? bareOf(plan) : plan);
  const skills = await loadSkills(formatKey, undefined, note, clean ? "clean" : "dynamic", [rest.brief, rest.instructions, rest.title].filter(Boolean).join(" "));
  // The clean style is stated up front, so the plan is built for it rather than stripped after.
  const input = { ...rest, instructions: [clean && CLEAN, bare && DESIGNED, rest.instructions].filter(Boolean).join("\n\n") || null };
  note(`skills: ${skills.map((s) => s.name).join(", ") || "none"}`);
  await step("Claude is planning the cut");
  const library = await loadLibrary().catch(() => []);
  const { plan: raw, usage } = await planner({ ...input, skills, clips, music: library.length ? describeLibrary(library) : undefined });
  note(usage);
  let checked;
  try {
    checked = validatePlan(raw, clips, library.map((t) => t.id), { clean });
  } catch (err) {
    // Keep what Claude sent, so a rejected plan can be looked at afterwards.
    const keep = path.join(config.workDir, "rejected", `${path.basename(dir)}.json`);
    await mkdir(path.dirname(keep), { recursive: true });
    await writeFile(keep, JSON.stringify(raw, null, 1));
    note(`rejected plan (saved to ${keep}): ${raw.segments.map((s) => `${s.clip} ${s.start}-${s.end}`).join(", ") || "no shots"}`);
    throw err;
  }
  const first = finish(checked, clips, note);

  const track = (plan: EditPlan) => library.find((t) => t.id === plan.music.track);
  // A music download that fails shouldn't sink the edit: it goes out without music.
  const music = async (plan: EditPlan) => {
    const t = track(plan);
    return t ? await trackFile(t).catch((err) => (note(`music unavailable: ${err.message}`), null)) : null;
  };
  await step(`Rendering ${first.length.toFixed(1)}s`);
  await render({ plan: shown(first.plan), clips, aspect: req.aspect, brand, workDir: dir, output, words: timelineWords(first.plan, clips), musicFile: await music(first.plan) });
  if (req.selfReview === false) return first;

  // Self-review: watch the render back, then revise it like a senior editor would.
  // Anything going wrong here leaves the first cut in place rather than failing the edit.
  let revised;
  try {
    await step("Watching the cut back");
    const review = await reviewRender(output, first.plan, path.join(dir, "review"));
    note(`self-review: ${review.notes.length} note(s)${review.summary.length ? `: ${review.summary.join(" | ")}` : ""}`);
    await step("Claude is reviewing its own cut");
    const { plan: raw2, usage: usage2 } = await planner({
      ...input,
      skills,
      clips,
      music: library.length ? describeLibrary(library) : undefined,
      source: "editor_fix",
      previous: { number: 1, plan: first.plan, comments: review.notes },
      instructions: [SELF_REVIEW, input.instructions && `The original notes for this edit:\n${input.instructions}`].filter(Boolean).join("\n\n"),
      renderSheets: review.sheets,
    });
    note(`${usage2} (self-review)`);
    revised = finish(validatePlan(raw2, clips, library.map((t) => t.id), { clean }), clips, note);
  } catch (err) {
    // The first cut stands if the review can't be planned.
    note(`self-review skipped: ${err instanceof Error ? err.message : err}`);
    return first;
  }
  await step(`Rendering the reviewed cut, ${revised.length.toFixed(1)}s`);
  await render({ plan: shown(revised.plan), clips, aspect: req.aspect, brand, workDir: path.join(dir, "final"), output, words: timelineWords(revised.plan, clips), musicFile: await music(revised.plan) });
  return revised;
}

const CLEAN = `EDITING STYLE: CLEAN (like Cluely's skits). Cuts, framing and subtitles only. Do not use motion templates, freeze frames (hold), titles, labels, stickers, graphics, cards, sound effects, transitions other than cut, pushes or highlight words: they will be removed. Music only as a section under the series intro clip, never under dialogue. All the quality comes from choosing the best takes and cutting them with perfect comic timing.`;

const DESIGNED = `GRAPHICS ARE DESIGNED AFTER YOU: a motion designer designs every caption, title, card, motion graphic and the end card over your finished cut. Still fill in captions, on_screen_text and motion as your suggestions (what text goes where and when, which moments deserve a graphic or a full-frame scene); they guide the designer and are not rendered as they are. Leave the end card out. Your job is the cut itself: takes, timing, shots, framing, holds where a graphic needs a still frame, music and sound effects.`;

const SELF_REVIEW = `Self-review. The previous cut is your own first cut; you are now the senior editor reviewing it before anyone sees it. Watch the render sheets and read the notes pinned to its timeline, then deliver the final cut:
- Natural timing, not maximum tightness: 0.25 to 0.45 s between lines on the same shot, about 0.5 to 0.7 s when a speaker change falls on a cut. Long gaps (over 0.9 s) go, unless they are the beat before a punchline or a reaction. No second take of a line, no stutter.
- Keep every line the script needs and the jokes' timing: keep the beat before a punchline, never cut away from a punchline before its last syllable, hold the reaction after it until it peaks (usually 0.6 to 1.2 s). Label each shot's beat (setup, punchline, reaction).
- Freezes for character intros 2.2 to 2.8 s, a comic freeze 0.8 to 1.2 s.
- Where it sags, tighten it: a tighter cut, a cut to the listener's reaction, a punch-in or a cutaway (or a motion graphic, unless the editing style is clean).
- Keep copying each speech shot's exact words into say: the engine times the cut from them.
- If a note is wrong (a deliberate pause), keep it as it is. Don't change what already works.`;

// Trim pass after validation; logs what it changed.
function finish(checked: ReturnType<typeof validatePlan>, clips: Clip[], note: Note) {
  checked.problems.forEach((p) => note(`plan fix: ${p}`));
  const tight = tighten(checked.plan, clips);
  if (tight.removed) note(`trim pass: removed ${tight.removed.toFixed(1)}s (${tight.notes.length ? tight.notes.join("; ") : "heads and tails"})`);
  const plan = anchorMotion(tight.plan);
  return { plan, length: timelineOf(plan).length };
}

// ---------------------------------------------------------------- one job

// `planner` is injectable so tests can run the whole pipeline without calling Claude.
export async function processJob(job: Job, planner: typeof planEdit = planEdit) {
  const dir = path.join(config.workDir, job.id);
  await mkdir(dir, { recursive: true });
  const cachedFiles = new Set<string>();
  const step = (text: string) => progress(job.id, text);
  const note = (text: string) => log(job.id, text);
  try {
    await step("Gathering the script, brand kit and footage");
    const { data: video } = await db.from("videos").select("*").eq("id", job.video_id).single();
    if (!video) throw new Error("The video no longer exists.");
    const [{ data: client }, { data: kit }, { data: script }, { data: footage }, memory] = await Promise.all([
      db.from("clients").select("name").eq("id", video.client_id).single(),
      db.from("brand_kits").select("*").eq("client_id", video.client_id).maybeSingle(),
      db.from("scripts").select("body, shot_list, status").eq("video_id", video.id).maybeSingle(),
      db.from("footage").select("storage_path, file_name, source, drive_file_id").eq("video_id", video.id).order("created_at"),
      // The edit goes ahead without it if it can't be read.
      clientMemory(video.client_id, video.id, "edit").catch(() => null),
    ]);
    // For now Claude can edit before the script is approved, or with no script (brief and footage only).
    if (!footage?.length) throw new Error("There's no footage on this video.");

    const clips = await prepareClips(
      footage.map((f) => ({ name: f.file_name, drive: f.source === "drive" ? f.drive_file_id : null, storage: f.storage_path })),
      dir,
      step,
      note,
      cachedFiles,
    );
    await watchClips(clips, dir, `${client?.name ?? ""}. ${video.title}. ${script?.body ?? ""}`, step);

    // Revisions start from the previous cut and its open comments.
    let previous = null;
    if (job.base_version_id) {
      const { data: base } = await db.from("versions").select("number, edit_plan").eq("id", job.base_version_id).single();
      const plan = parseStoredPlan(base?.edit_plan);
      if (base && plan) {
        const { data: comments } = await db
          .from("comments")
          .select("timecode_ms, body, author:profiles(role)")
          .eq("version_id", job.base_version_id)
          .eq("resolved", false)
          .is("parent_id", null)
          .order("timecode_ms", { ascending: true, nullsFirst: true });
        previous = {
          number: base.number,
          plan,
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
    const shots = Array.isArray(script?.shot_list)
      ? (script.shot_list as { text?: string }[]).map((s) => s?.text ?? "").filter(Boolean)
      : [];

    const out = path.join(dir, "cut.mp4");
    const { plan } = await planAndRender(
      {
        formatKey: video.format,
        clean: kit?.edit_style === "clean",
        brand: { colors: kit?.colors ?? [], fonts: kit?.fonts ?? [], logoFile },
        clientName: client?.name ?? "Client",
        title: video.title,
        format: video.format.replace("_", " "),
        aspect: video.aspect,
        brief: video.brief,
        script: script?.body ?? "",
        shots,
        brandKit,
        memory,
        instructions: job.instructions,
        source: job.source,
        previous,
      },
      clips,
      dir,
      out,
      step,
      note,
      planner,
    );
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
    await pruneCache(cachedFiles).catch((err) => log(job.id, `cache cleanup failed: ${err.message}`));
  }
}
