// Agent 2, the trend researcher: finds viral reels in a client's niche through Apify,
// downloads the top ones, watches them (contact sheets, transcript, cut rate) and has
// Claude write the key points the scriptwriter and the editor work from.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { config, db } from "./config.ts";
import { run } from "./exec.ts";
import { log } from "./job.ts";
import { contactSheets, probe } from "./media.ts";
import { transcribe, transcriptionAvailable } from "./transcribe.ts";

type Report = { id: string; client_id: string; hashtags: string[]; accounts: string[]; attempts: number };

// Reels to watch closely per run, and how many to scrape to find them.
const WATCH = 10;
const PER_HASHTAG = 30;
const PER_ACCOUNT = 12;

export async function claimResearch(): Promise<Report | null> {
  const { data: queued } = await db.from("trend_reports").select("id, attempts").eq("status", "queued").order("created_at").limit(1).maybeSingle();
  if (!queued) return null;
  const { data } = await db
    .from("trend_reports")
    .update({ status: "running", started_at: new Date().toISOString(), attempts: queued.attempts + 1, progress: "Starting", error: null })
    .eq("id", queued.id)
    .eq("status", "queued")
    .select("id, client_id, hashtags, accounts, attempts")
    .maybeSingle();
  return data;
}

export async function recoverStaleResearch() {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data } = await db.from("trend_reports").select("id, attempts").eq("status", "running").lt("started_at", cutoff);
  for (const r of data ?? []) {
    await db
      .from("trend_reports")
      .update(r.attempts >= 3 ? { status: "failed", error: "The engine stopped during the research.", progress: null, finished_at: new Date().toISOString() } : { status: "queued", progress: null })
      .eq("id", r.id)
      .eq("status", "running");
  }
}

// ---------------------------------------------------------------- Apify

type Item = {
  url?: string;
  shortCode?: string;
  caption?: string;
  videoUrl?: string;
  videoPlayCount?: number;
  igPlayCount?: number;
  videoViewCount?: number;
  likesCount?: number;
  commentsCount?: number;
  videoDuration?: number;
  ownerUsername?: string;
  timestamp?: string;
};

async function apify(actor: string, input: Record<string, unknown>): Promise<Item[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("The trend researcher needs APIFY_TOKEN in the engine's environment.");
  const res = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?timeout=280`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(300_000),
  });
  if (res.status === 401) throw new Error("Apify rejected the token (APIFY_TOKEN).");
  if (res.status === 402) throw new Error("The Apify account is out of credit for this month.");
  if (!res.ok) throw new Error(`Apify returned ${res.status} for ${actor}.`);
  const items = await res.json();
  return Array.isArray(items) ? items : [];
}

const plays = (i: Item) => i.videoPlayCount ?? i.igPlayCount ?? i.videoViewCount ?? null;
// Reach first, engagement as a tie-breaker; likes stand in when plays are hidden.
function score(i: Item) {
  const p = plays(i);
  if (p === null) return (i.likesCount ?? 0) * 40;
  return p * (1 + Math.min(0.5, ((i.likesCount ?? 0) + 3 * (i.commentsCount ?? 0)) / Math.max(1, p)));
}

export function pickReels(items: Item[], count = WATCH) {
  const seen = new Set<string>();
  const perOwner = new Map<string, number>();
  const usable = items
    .filter((i) => i.videoUrl && (i.videoDuration ?? 30) >= 4 && (i.videoDuration ?? 30) <= 120)
    .filter((i) => {
      const key = i.shortCode ?? i.url ?? i.videoUrl!;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => score(b) - score(a));
  // At most 3 per account, so one big creator doesn't fill the report.
  return usable
    .filter((i) => {
      const n = perOwner.get(i.ownerUsername ?? "") ?? 0;
      perOwner.set(i.ownerUsername ?? "", n + 1);
      return n < 3;
    })
    .slice(0, count);
}

// ---------------------------------------------------------------- analysis

const Findings = z.object({
  summary: z.string().describe("What makes videos go viral in this niche right now, in 3 to 5 sentences."),
  hooks: z.array(z.object({ pattern: z.string(), example: z.string(), why: z.string() })).describe("4 to 8 hook patterns seen in the first 2 seconds."),
  structures: z.array(z.object({ name: z.string(), beats: z.array(z.string()), length: z.string() })).describe("2 to 5 video structures that work."),
  editing: z.array(z.string()).describe("Editing techniques with numbers: cut rate, shot length, punch-ins, transitions, text style, motion graphics, color."),
  on_screen_text: z.array(z.string()).describe("How text and captions are used."),
  audio: z.array(z.string()).describe("Music, voice, sound effects, trending audio."),
  scripting: z.array(z.string()).describe("Key points for writing scripts for this client from these videos."),
  ideas: z.array(z.object({ title: z.string(), hook: z.string(), outline: z.string() })).describe("5 video ideas adapted to this client."),
  avoid: z.array(z.string()).describe("What doesn't work or would not fit this client."),
  reels: z
    .array(z.object({ index: z.number().describe("The reel's number in the list"), why: z.string(), hook: z.string().describe("The hook, word for word or described"), techniques: z.array(z.string()) }))
    .describe("One entry per reel watched."),
});

const SYSTEM = `You are the trend researcher at Magik Studio, a short-form video studio. You study the top-performing Instagram reels in a client's niche and turn them into key points a scriptwriter and an editor can act on.

Each reel comes with its numbers, caption, transcript, cut rate and a contact sheet (a grid of frames sampled across the reel, read left to right, top to bottom). Look closely at the frames: framing, text on screen, captions style, motion graphics, people, setting, pacing. Be concrete and quantitative. Write in English.`;

async function cutsPerSecond(file: string, duration: number) {
  try {
    const { stderr } = await run(config.ffmpeg, ["-hide_banner", "-i", file, "-vf", "scale=320:-2,select='gt(scene,0.3)',showinfo", "-an", "-f", "null", "-"]);
    return Math.round(((stderr.match(/pts_time:/g)?.length ?? 0) / Math.max(1, duration)) * 100) / 100;
  } catch {
    return null;
  }
}

export type StudyContext = { client: string; niche?: string | null; business?: string | null; audience?: string | null; needs?: string[] };

// Searches, picks, watches and analyses; no database. `onProgress` reports each step.
export async function study(hashtags: string[], accounts: string[], context: StudyContext, workDir: string, onProgress: (step: string) => unknown = () => {}) {
  await mkdir(workDir, { recursive: true });
  await onProgress(`Searching Instagram: ${[...hashtags.map((h) => `#${h}`), ...accounts.map((a) => `@${a}`)].join(", ")}`);
  const results = await Promise.all([
    hashtags.length ? apify("apify~instagram-hashtag-scraper", { hashtags, resultsType: "reels", resultsLimit: PER_HASHTAG }) : [],
    accounts.length ? apify("apify~instagram-reel-scraper", { username: accounts, resultsLimit: PER_ACCOUNT, skipPinnedPosts: true }) : [],
  ]);
  const found = results.flat();
  const picks = pickReels(found);
  log(null, `research: ${found.length} reels found, watching ${picks.length}`);
  if (!picks.length) throw new Error("Apify found no usable reels for these hashtags and accounts. Try broader hashtags.");

  const watched: { item: Item; duration: number; sheet: string | null; transcript: string; cuts: number | null }[] = [];
  for (const [k, item] of picks.entries()) {
    await onProgress(`Watching reel ${k + 1} of ${picks.length}`);
    try {
      const file = path.join(workDir, `reel-${k}.mp4`);
      const res = await fetch(item.videoUrl!, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok) continue;
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
      const p = await probe(file);
      const sheets = await contactSheets(file, path.join(workDir, `sheets-${k}`), Math.max(0.5, Math.ceil((p.duration / 9) * 2) / 2));
      const lines = p.hasAudio && (await transcriptionAvailable()) ? ((await transcribe(file, workDir)) ?? []) : [];
      watched.push({ item, duration: p.duration, sheet: sheets[0] ?? null, transcript: lines.map((l) => l.text).join(" "), cuts: await cutsPerSecond(file, p.duration) });
    } catch (e) {
      log(null, `research: skipped a reel (${e instanceof Error ? e.message : e})`);
    }
  }
  if (!watched.length) throw new Error("None of the reels could be downloaded.");

  await onProgress("Claude is studying the reels");
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    {
      type: "text",
      text: [
        `Client: ${context.client}`,
        context.niche && `Niche: ${context.niche}\nBusiness: ${context.business ?? ""}\nAudience: ${context.audience ?? ""}\nNeeds: ${(context.needs ?? []).join("; ")}`,
        `Searched: ${hashtags.map((h) => `#${h}`).join(" ")} ${accounts.map((a) => `@${a}`).join(" ")}`,
        `The ${watched.length} top reels, by reach:`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
  for (const [k, w] of watched.entries()) {
    const i = w.item;
    content.push({
      type: "text",
      text: `Reel ${k + 1}: @${i.ownerUsername} · ${plays(i) ?? "?"} plays · ${i.likesCount ?? "?"} likes · ${i.commentsCount ?? "?"} comments · ${w.duration.toFixed(1)}s · ${w.cuts ?? "?"} cuts per second\nCaption: ${(i.caption ?? "").slice(0, 400)}\nTranscript: ${w.transcript.slice(0, 1500) || "(no speech)"}`,
    });
    if (w.sheet) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: (await readFile(w.sheet)).toString("base64") } });
  }
  content.push({ type: "text", text: "Write the key points." });

  const anthropic = new Anthropic();
  const response = await anthropic.beta.messages.parse({
    model: config.model,
    max_tokens: 20000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: betaZodOutputFormat(Findings) },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  const findings = response.parsed_output;
  if (!findings) throw new Error("Claude's analysis came back incomplete.");

  const reels = watched.map((w, k) => {
    const note = findings.reels.find((r) => r.index === k + 1);
    return {
      url: w.item.url ?? "",
      owner: w.item.ownerUsername ?? "",
      plays: plays(w.item),
      likes: w.item.likesCount ?? null,
      comments: w.item.commentsCount ?? null,
      duration: Math.round(w.duration * 10) / 10,
      caption: (w.item.caption ?? "").slice(0, 300),
      cutsPerSecond: w.cuts,
      why: note?.why ?? "",
      hook: note?.hook ?? "",
      techniques: note?.techniques ?? [],
    };
  });
  const { reels: _, ...rest } = findings;
  return { reels, findings: rest };
}

export async function runResearch(report: Report) {
  const dir = path.join(config.workDir, `research-${report.id}`);
  try {
    const { data: strategy } = await db.from("brand_strategies").select("niche, business, audience, needs").eq("client_id", report.client_id).maybeSingle();
    const { data: client } = await db.from("clients").select("name").eq("id", report.client_id).single();
    const { reels, findings } = await study(report.hashtags, report.accounts, { client: client?.name ?? "", ...strategy }, dir, (progress) =>
      db.from("trend_reports").update({ progress }).eq("id", report.id),
    );
    await db.from("trend_reports").update({ status: "done", reels, findings, progress: null, finished_at: new Date().toISOString() }).eq("id", report.id);
    log(report.id, `research done: ${reels.length} reels studied`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log(report.id, `research failed: ${message}`);
    await db.from("trend_reports").update({ status: "failed", error: message, progress: null, finished_at: new Date().toISOString() }).eq("id", report.id);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
