// Agent 2, the trend researcher: finds viral reels in a client's niche through Apify,
// downloads the top ones, watches them (contact sheets, transcript, cut rate) and has
// Claude write the key points the scriptwriter and the editor work from. It also counts the
// sounds the reels use, for the sound designer.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { analyzeTrack } from "./analysis.ts";
import { config, db } from "./config.ts";
import { run } from "./exec.ts";
import { log } from "./job.ts";
import { contactSheets, probe } from "./media.ts";
import { clientMemory } from "./memory.ts";
import type { TrendAudio } from "./sound.ts";
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

export type Item = {
  url?: string;
  shortCode?: string;
  caption?: string;
  videoUrl?: string;
  // Instagram serves the picture and the sound separately: videoUrl has no audio track.
  audioUrl?: string;
  videoPlayCount?: number;
  igPlayCount?: number;
  videoViewCount?: number;
  likesCount?: number;
  commentsCount?: number;
  videoDuration?: number;
  ownerUsername?: string;
  timestamp?: string;
  musicInfo?: { artist_name?: string; song_name?: string; uses_original_audio?: boolean; audio_id?: string };
};

export async function apify<T = Item>(actor: string, input: Record<string, unknown>): Promise<T[]> {
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

export const plays = (i: Item) => i.videoPlayCount ?? i.igPlayCount ?? i.videoViewCount ?? null;
// Reach first, engagement as a tie-breaker; likes stand in when plays are hidden.
function score(i: Item) {
  const p = plays(i);
  if (p === null) return (i.likesCount ?? 0) * 40;
  return p * (1 + Math.min(0.5, ((i.likesCount ?? 0) + 3 * (i.commentsCount ?? 0)) / Math.max(1, p)));
}

const audioKey = (m: NonNullable<Item["musicInfo"]>) => m.audio_id || `${(m.song_name ?? "").toLowerCase()}|${(m.artist_name ?? "").toLowerCase()}`;

// The sounds the found reels use, counted across everything the search returned: licensed
// songs, and creators' original sounds when more than one account reuses them.
export function trendingAudio(items: Item[], limit = 12): TrendAudio[] {
  const by = new Map<string, TrendAudio & { owners: Set<string>; best: number }>();
  for (const i of items) {
    const m = i.musicInfo;
    if (!m || (!m.song_name && !m.audio_id)) continue;
    const key = audioKey(m);
    let a = by.get(key);
    if (!a) {
      a = {
        title: m.song_name || "Original audio",
        artist: m.artist_name || i.ownerUsername || "",
        original: m.uses_original_audio === true,
        audioId: m.audio_id ?? null,
        link: m.audio_id ? `https://www.instagram.com/reels/audio/${m.audio_id}/` : null,
        reels: 0,
        creators: 0,
        plays: 0,
        example: null,
        bpm: null,
        owners: new Set(),
        best: -1,
      };
      by.set(key, a);
    }
    a.reels++;
    if (i.ownerUsername) a.owners.add(i.ownerUsername);
    const p = plays(i) ?? 0;
    a.plays += p;
    if (p > a.best) {
      a.best = p;
      a.example = i.url ?? null;
    }
  }
  return [...by.values()]
    .map(({ owners, best: _, ...a }) => ({ ...a, creators: owners.size }))
    // A creator's original audio used once is their own voice-over, not a trend.
    .filter((a) => !a.original || a.creators > 1)
    .sort((a, b) => b.reels - a.reels || b.plays - a.plays)
    .slice(0, limit);
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
  audio: z.array(z.string()).describe("Music, voice, sound effects and trending audio: which sounds the top reels use and how (a voice-over on the chorus, cuts on the beat, the drop on the reveal)."),
  scripting: z.array(z.string()).describe("Key points for writing scripts for this client from these videos."),
  ideas: z.array(z.object({ title: z.string(), hook: z.string(), outline: z.string() })).describe("5 video ideas adapted to this client."),
  avoid: z.array(z.string()).describe("What doesn't work or would not fit this client."),
  reels: z
    .array(z.object({ index: z.number().describe("The reel's number in the list"), why: z.string(), hook: z.string().describe("The hook, word for word or described"), techniques: z.array(z.string()) }))
    .describe("One entry per reel watched."),
});

const SYSTEM = `You are the trend researcher at Magik Studio, a short-form video studio. You study the top-performing Instagram reels in a client's niche and turn them into key points a scriptwriter and an editor can act on.

Each reel comes with its numbers, caption, transcript, cut rate and a contact sheet (a grid of frames sampled across the reel, read left to right, top to bottom). Look closely at the frames: framing, text on screen, captions style, motion graphics, people, setting, pacing. Be concrete and quantitative. Write in English.`;

// A reel's picture with its sound put back: Instagram's video file is silent, its audio a
// separate file. Without the sound there is no transcript and no tempo. Any failure keeps the
// silent picture.
export async function withSound(video: string, audioUrl: string | undefined, out: string) {
  if (!audioUrl) return video;
  try {
    const res = await fetch(audioUrl, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) return video;
    const audio = `${out}.audio`;
    await writeFile(audio, Buffer.from(await res.arrayBuffer()));
    await run(config.ffmpeg, ["-v", "error", "-y", "-i", video, "-i", audio, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", out]);
    await rm(audio, { force: true });
    return out;
  } catch {
    return video;
  }
}

export async function cutTimes(file: string) {
  try {
    const { stderr } = await run(config.ffmpeg, ["-hide_banner", "-i", file, "-vf", "scale=320:-2,select='gt(scene,0.3)',showinfo", "-an", "-f", "null", "-"]);
    return [...stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
  } catch {
    return null;
  }
}

export type Watched = {
  item: Item;
  duration: number;
  sheet: string | null;
  transcript: string;
  cuts: number | null;
  // Measured pacing: shot lengths between detected cuts, speaking rate, and pauses.
  stats: { shots: number; medianShot: number | null; wordsPerMinute: number | null; speechShare: number | null; longestPause: number | null };
  // The tempo of its song, when it plays a licensed song.
  bpm: number | null;
};

// Downloads and measures each reel: a contact sheet, the transcript, cuts and pacing.
export async function watchReels(items: Item[], workDir: string, onProgress: (step: string) => unknown = () => {}): Promise<Watched[]> {
  const watched: Watched[] = [];
  for (const [k, item] of items.entries()) {
    await onProgress(`Watching reel ${k + 1} of ${items.length}`);
    try {
      const silent = path.join(workDir, `reel-${k}-picture.mp4`);
      const res = await fetch(item.videoUrl!, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok) continue;
      await writeFile(silent, Buffer.from(await res.arrayBuffer()));
      const file = await withSound(silent, item.audioUrl, path.join(workDir, `reel-${k}.mp4`));
      const p = await probe(file);
      const sheets = await contactSheets(file, path.join(workDir, `sheets-${k}`), Math.max(0.5, Math.ceil((p.duration / 9) * 2) / 2));
      const lines = p.hasAudio && (await transcriptionAvailable()) ? ((await transcribe(file, workDir)) ?? []) : [];
      const words = lines.flatMap((l) => l.words ?? []);
      const times = await cutTimes(file);
      const bounds = times ? [0, ...times, p.duration] : null;
      const shots = bounds ? bounds.slice(1).map((t, i) => t - bounds[i]).filter((d) => d > 0.05).sort((a, b) => a - b) : [];
      const spoken = words.reduce((a, w) => a + Math.max(0, w.end - w.start), 0);
      const pauses = words.slice(1).map((w, i) => w.start - words[i].end);
      const song = p.hasAudio && item.musicInfo && item.musicInfo.uses_original_audio === false;
      const bpm = song ? await analyzeTrack(file).then((a) => a.bpm, () => null) : null;
      watched.push({
        item,
        duration: p.duration,
        sheet: sheets[0] ?? null,
        transcript: lines.map((l) => l.text).join(" "),
        cuts: times ? Math.round((times.length / Math.max(1, p.duration)) * 100) / 100 : null,
        stats: {
          shots: shots.length,
          medianShot: shots.length ? Math.round(shots[Math.floor(shots.length / 2)] * 10) / 10 : null,
          wordsPerMinute: words.length ? Math.round((words.length / Math.max(1, p.duration)) * 60) : null,
          speechShare: words.length ? Math.round((spoken / p.duration) * 100) / 100 : null,
          longestPause: pauses.length ? Math.round(Math.max(...pauses) * 10) / 10 : null,
        },
        bpm,
      });
    } catch (e) {
      log(null, `research: skipped a reel (${e instanceof Error ? e.message : e})`);
    }
  }
  return watched;
}

// `earlier`: the videos already made for the client (see memory.ts), so the ideas are new.
export type StudyContext = { client: string; niche?: string | null; business?: string | null; audience?: string | null; needs?: string[]; earlier?: string | null };

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

  const watched = await watchReels(picks, workDir, onProgress);
  if (!watched.length) throw new Error("None of the reels could be downloaded.");
  const audio = trendingAudio(found).map((a) => ({
    ...a,
    bpm: watched.find((w) => w.bpm && w.item.musicInfo && audioKey(w.item.musicInfo) === (a.audioId || `${a.title.toLowerCase()}|${a.artist.toLowerCase()}`))?.bpm ?? null,
  }));

  await onProgress("Claude is studying the reels");
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    {
      type: "text",
      text: [
        `Client: ${context.client}`,
        context.niche && `Niche: ${context.niche}\nBusiness: ${context.business ?? ""}\nAudience: ${context.audience ?? ""}\nNeeds: ${(context.needs ?? []).join("; ")}`,
        context.earlier && `Videos the studio already made for this client (your ideas must be new, not repeats of these):\n${context.earlier}`,
        `Searched: ${hashtags.map((h) => `#${h}`).join(" ")} ${accounts.map((a) => `@${a}`).join(" ")}`,
        audio.length &&
          `The sounds the ${found.length} reels found use most:\n${audio.map((a) => `- "${a.title}" by ${a.artist} (${a.original ? "original audio" : "licensed song"}): ${a.reels} reels by ${a.creators} accounts`).join("\n")}`,
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
      text: `Reel ${k + 1}: @${i.ownerUsername} · ${plays(i) ?? "?"} plays · ${i.likesCount ?? "?"} likes · ${i.commentsCount ?? "?"} comments · ${w.duration.toFixed(1)}s · ${w.cuts ?? "?"} cuts per second\nAudio: ${i.musicInfo?.song_name ? `"${i.musicInfo.song_name}" by ${i.musicInfo.artist_name ?? "?"} (${i.musicInfo.uses_original_audio ? "original audio" : "licensed song"})${w.bpm ? `, about ${Math.round(w.bpm)} BPM` : ""}` : "not reported"}\nCaption: ${(i.caption ?? "").slice(0, 400)}\nTranscript: ${w.transcript.slice(0, 1500) || "(no speech)"}`,
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
      audio: w.item.musicInfo?.song_name ? `${w.item.musicInfo.song_name} · ${w.item.musicInfo.artist_name ?? ""}`.trim() : null,
      why: note?.why ?? "",
      hook: note?.hook ?? "",
      techniques: note?.techniques ?? [],
    };
  });
  const { reels: _, ...rest } = findings;
  return { reels, findings: rest, audio };
}

export async function runResearch(report: Report) {
  const dir = path.join(config.workDir, `research-${report.id}`);
  try {
    const { data: strategy } = await db.from("brand_strategies").select("niche, business, audience, needs").eq("client_id", report.client_id).maybeSingle();
    const { data: client } = await db.from("clients").select("name").eq("id", report.client_id).single();
    const earlier = await clientMemory(report.client_id, null, "brief").catch(() => null);
    const { reels, findings, audio } = await study(report.hashtags, report.accounts, { client: client?.name ?? "", ...strategy, earlier }, dir, (progress) =>
      db.from("trend_reports").update({ progress }).eq("id", report.id),
    );
    await db.from("trend_reports").update({ status: "done", reels, findings, audio, progress: null, finished_at: new Date().toISOString() }).eq("id", report.id);
    log(report.id, `research done: ${reels.length} reels studied`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log(report.id, `research failed: ${message}`);
    await db.from("trend_reports").update({ status: "failed", error: message, progress: null, finished_at: new Date().toISOString() }).eq("id", report.id);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
