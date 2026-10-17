// Runs a whole edit on this machine without touching the database: for checking the
// engine on a real video, or editing any footage (local files or Google Drive links).
//
//   node --env-file=../.env.local scripts/try-edit.ts --video <video id> [--notes "..."] [--fix "..."] --out cut.mp4
//   node --env-file=../.env.local scripts/try-edit.ts --clips a.mp4 b.mov https://drive.google.com/... \
//        --format social_short --aspect 9:16 --client "Name" --title "Title" --brief "..." --notes "..." --out cut.mp4
//
// --fix revises the video's latest version the way an editor's fix request would.

import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { db } from "../src/config.ts";
import { listDriveVideos } from "../src/drive.ts";
import { planAndRender, prepareClips, watchClips, type Source } from "../src/job.ts";
import { probe } from "../src/media.ts";
import { parseStoredPlan } from "../src/plan.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    video: { type: "string" },
    clips: { type: "string", multiple: true },
    notes: { type: "string" },
    fix: { type: "string" },
    format: { type: "string", default: "social_short" },
    aspect: { type: "string", default: "9:16" },
    client: { type: "string", default: "Client" },
    title: { type: "string", default: "Test edit" },
    brief: { type: "string" },
    colors: { type: "string" },
    out: { type: "string", default: "cut.mp4" },
  },
});

const t0 = Date.now();
const say = (text: string) => console.log(`${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s  ${text}`);
const dir = path.join(os.tmpdir(), "magik-try", String(t0));
await mkdir(dir, { recursive: true });
const output = path.resolve(values.out!);

let sources: Source[];
let request: Parameters<typeof planAndRender>[0];

if (values.video) {
  const { data: video } = await db.from("videos").select("*").eq("id", values.video).single();
  if (!video) throw new Error("No such video.");
  const [{ data: client }, { data: kit }, { data: script }, { data: footage }, { data: last }] = await Promise.all([
    db.from("clients").select("name").eq("id", video.client_id).single(),
    db.from("brand_kits").select("*").eq("client_id", video.client_id).maybeSingle(),
    db.from("scripts").select("body, shot_list").eq("video_id", video.id).maybeSingle(),
    db.from("footage").select("storage_path, file_name, source, drive_file_id").eq("video_id", video.id).order("created_at"),
    db.from("versions").select("id, number, edit_plan").eq("video_id", video.id).order("number", { ascending: false }).limit(1).maybeSingle(),
  ]);
  sources = (footage ?? []).map((f) => ({ name: f.file_name, drive: f.source === "drive" ? f.drive_file_id : null, storage: f.storage_path }));
  const base = values.fix && last ? parseStoredPlan(last.edit_plan) : null;
  const { data: comments } = base && last ? await db.from("comments").select("timecode_ms, body, author:profiles(role)").eq("version_id", last.id).eq("resolved", false).is("parent_id", null) : { data: [] };
  request = {
    formatKey: video.format,
    brand: { colors: kit?.colors ?? [], fonts: kit?.fonts ?? [], logoFile: null },
    clientName: client?.name ?? "Client",
    title: video.title,
    format: video.format.replace("_", " "),
    aspect: video.aspect,
    brief: video.brief,
    script: script?.body ?? "",
    shots: Array.isArray(script?.shot_list) ? (script.shot_list as { text?: string }[]).map((s) => s?.text ?? "").filter(Boolean) : [],
    brandKit: kit ? { colors: kit.colors, fonts: kit.fonts, musicMood: kit.music_mood, styleRules: kit.style_rules, hasLogo: false } : null,
    instructions: values.fix ?? values.notes ?? null,
    source: base ? "editor_fix" : "launch",
    previous: base && last ? { number: last.number, plan: base, comments: (comments ?? []).map((c) => ({ timecodeMs: c.timecode_ms, body: c.body, fromClient: c.author?.role === "client" })) } : null,
  };
} else {
  const inputs = [...(values.clips ?? []), ...positionals];
  if (!inputs.length) throw new Error("Give --video <id> or --clips <files or Drive links>.");
  sources = [];
  for (const input of inputs) {
    const drive = input.match(/drive\.google\.com\/.*?(?:folders|file\/d)\/([\w-]{10,})|[?&]id=([\w-]{10,})/);
    if (drive) sources.push(...(await listDriveVideos(drive[1] ?? drive[2])).map((f) => ({ name: f.name, drive: f.id })));
    else sources.push({ name: path.basename(input), file: path.resolve(input) });
  }
  request = {
    formatKey: values.format!,
    brand: { colors: values.colors?.split(",") ?? [], fonts: [], logoFile: null },
    clientName: values.client!,
    title: values.title!,
    format: values.format!.replace("_", " "),
    aspect: values.aspect!,
    brief: values.brief ?? null,
    script: "",
    shots: [],
    brandKit: null,
    instructions: values.notes ?? null,
    source: "launch",
    previous: null,
  };
}

say(`${sources.length} footage file(s)`);
const clips = await prepareClips(sources, dir, say, say, new Set());
await watchClips(clips, dir, `${request.clientName}. ${request.title}. ${request.script}`, say);
const { plan, length } = await planAndRender(request, clips, dir, output, say, say);
await writeFile(output.replace(/\.mp4$/, ".plan.json"), JSON.stringify(plan, null, 1));
const p = await probe(output);
say(`done: ${output} (${p.duration.toFixed(1)}s of a planned ${length.toFixed(1)}s, ${p.width}x${p.height})`);
say(`summary: ${plan.summary}`);
if (plan.open_questions.length) say(`check: ${plan.open_questions.join(" | ")}`);
