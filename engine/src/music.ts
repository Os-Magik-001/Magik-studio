// Royalty-free music for edits. music/library.json lists the studio's picks: CC0 or the
// Pixabay Content License, so they can go under client videos on any platform without credit.
// Each entry's `page` is the archived freepd.com listing that states the licence (the site
// closed in 2025; the files are served from an archive.org mirror, byte-identical to
// freepd.com's originals). bpm and firstBeat were measured from the audio, so beat n falls at
// firstBeat + n * 60 / bpm.
//
// The sound designer also searches whole libraries (music/*.json, built by
// scripts/sound-catalog.ts) and the studio's Google Drive libraries (libraries.ts). Their
// tempo and structure are measured when it looks closer (analysis.ts).

import { createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { analyzeTrack, type TrackAnalysis } from "./analysis.ts";
import { fetchDriveFile } from "./drive.ts";
import { run } from "./exec.ts";

export const MOODS = [
  "upbeat-pop",
  "hip-hop",
  "chill-lofi",
  "inspiring-corporate",
  "cinematic-epic",
  "emotional-piano",
  "ambient-minimal",
  "funky-groovy",
  "electronic-tech",
  "warm-acoustic",
  "dramatic-suspense",
  "luxury-elegant",
] as const;

export type Mood = (typeof MOODS)[number];
export type Energy = "low" | "medium" | "high";

// A track in any library. Tempo, first beat and energy are filled in when the library states
// them or once the track has been measured.
export type Track = {
  id: string;
  title: string;
  artist: string;
  // studio, freepd, incompetech, mixkit, or the name of a Drive library.
  library: string;
  mood: Mood | null;
  tags: string[];
  description?: string;
  energy?: Energy;
  bpm?: number;
  firstBeat?: number;
  duration: number;
  // A web link, or "drive:<file id>" for files the studio keeps in Google Drive.
  url: string;
  page: string;
  license: string;
  // The line the post must carry when the licence asks for credit (CC BY).
  credit?: string;
  // Measured already (the Drive libraries are measured when they're added).
  analysis?: TrackAnalysis;
};

// The studio's picks (music/library.json): measured, credit-free, always complete.
export type StudioTrack = Omit<Track, "library" | "tags" | "mood" | "energy" | "bpm" | "firstBeat"> & { mood: Mood; energy: Energy; bpm: number; firstBeat: number };

// The built-in libraries besides the studio's picks, in the order they're preferred.
export const LIBRARIES = ["freepd", "mixkit", "incompetech"] as const;

const LUFS = -16;

export const musicDir = () => process.env.ENGINE_MUSIC_DIR ?? path.join(os.tmpdir(), "magik-engine-music");
const ffmpeg = () => process.env.FFMPEG_PATH ?? "ffmpeg";

export async function loadLibrary(): Promise<StudioTrack[]> {
  return JSON.parse(await readFile(new URL("../music/library.json", import.meta.url), "utf8")) as StudioTrack[];
}

// Every built-in track: the studio's picks first, then the libraries (a track already among
// the picks keeps its measured entry), then the extra tracks given (the Drive libraries).
export async function loadCatalog(extra: Track[] = []): Promise<Track[]> {
  const picks: Track[] = (await loadLibrary()).map((t) => ({ ...t, library: "studio", tags: [t.mood.replace("-", " ")] }));
  const libraries = await Promise.all(
    LIBRARIES.map((name) =>
      readFile(new URL(`../music/${name}.json`, import.meta.url), "utf8")
        .then((text) => JSON.parse(text) as Track[])
        .catch(() => []),
    ),
  );
  const seen = new Set<string>();
  const urls = new Set<string>();
  return [...picks, ...libraries.flat(), ...extra].filter((t) => {
    if (seen.has(t.id) || urls.has(t.url)) return false;
    seen.add(t.id);
    urls.add(t.url);
    return true;
  });
}

export const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "track";

// The closest of the studio's moods for a library's own words (genre, feel, tags, title).
const MOOD_WORDS: [Mood, RegExp][] = [
  ["hip-hop", /hip[ -]?hop|trap|\brap\b|urban|boom bap|drill/i],
  ["chill-lofi", /lo-?fi|chill|downtempo|laid[- ]back|easy listening|relaxed/i],
  ["electronic-tech", /electro|\bedm\b|house|techno|synth|dubstep|drum and bass|breakbeat|trance|future/i],
  ["dramatic-suspense", /suspense|tense|eerie|horror|ominous|unnerving|thriller|scary|\bdark\b/i],
  ["cinematic-epic", /epic|cinematic|orchestra|film score|trailer|heroic|action|soundtrack/i],
  ["emotional-piano", /piano|\bsad\b|somber|emotional|sentimental|romantic|melanchol/i],
  ["inspiring-corporate", /inspir|corporate|motivational|uplifting|business|success/i],
  ["funky-groovy", /funk|groov|disco|comedy|quirky|humorous|bouncy|playful/i],
  ["luxury-elegant", /jazz|lounge|elegant|luxury|bossa|swing|classical|smooth/i],
  ["warm-acoustic", /acoustic|folk|ukulele|country|americana|bluegrass|world/i],
  ["ambient-minimal", /ambient|atmospher|minimal|drone|meditat|mystical|peaceful|calming/i],
  ["upbeat-pop", /pop|upbeat|happy|bright|positive|energetic|summer|dance|fun/i],
];
export const moodOf = (words: string): Mood | null => MOOD_WORDS.find(([, re]) => re.test(words))?.[0] ?? null;

export type MusicQuery = {
  words?: string;
  moods?: Mood[];
  energy?: Energy;
  bpm?: [number, number];
  minSeconds?: number;
  libraries?: string[];
  // false leaves out tracks whose licence asks for credit.
  creditOk?: boolean;
};

const STOP = new Set(["a", "an", "and", "the", "with", "for", "of", "in", "on", "to", "music", "track", "song", "bed", "background"]);
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9&]+/).filter((w) => w.length > 1 && !STOP.has(w));

// Best matches first: the words in the tags, title and description, the mood, energy, a
// tempo in range (half or double time counts), long enough for the video, and credit-free
// tracks and the studio's picks ahead of the rest.
export function searchMusic(tracks: Track[], q: MusicQuery, limit = 20) {
  const asked = words(q.words ?? "");
  return tracks
    .filter((t) => (!q.libraries?.length || q.libraries.includes(t.library)) && (q.creditOk !== false || !t.credit))
    .map((t) => {
      const tags = new Set(t.tags.flatMap(words));
      const title = new Set(words(t.title));
      const text = `${t.description ?? ""} ${t.tags.join(" ")}`.toLowerCase();
      let score = 0;
      for (const w of asked) score += tags.has(w) ? 3 : title.has(w) ? 2 : text.includes(w) ? 1 : 0;
      if (t.mood && q.moods?.includes(t.mood)) score += 4;
      if (q.energy && t.energy === q.energy) score += 2;
      if (q.bpm && t.bpm) {
        const [lo, hi] = q.bpm;
        const fits = (b: number) => b >= lo && b <= hi;
        score += fits(t.bpm) ? 3 : fits(t.bpm * 2) || fits(t.bpm / 2) ? 2 : -1;
      }
      if (q.minSeconds && t.duration < q.minSeconds) score -= 5;
      if (t.credit) score -= 2;
      if (t.library === "studio") score += 1;
      return { track: t, score };
    })
    .filter((m) => m.score > 0 || !asked.length)
    .sort((a, b) => b.score - a.score || a.track.duration - b.track.duration)
    .slice(0, limit);
}

export function describeLibrary(tracks: StudioTrack[]) {
  return tracks
    .map((t) => `${t.id}: ${t.mood}, ${t.energy} energy, ${t.bpm} BPM, ${Math.round(t.duration)}s`)
    .join("\n");
}

// A track's measurements: kept next to its normalized file, so each track is measured once.
export async function trackAnalysis(track: Track): Promise<TrackAnalysis> {
  if (track.analysis) return track.analysis;
  const cache = path.join(musicDir(), `${track.id}.analysis.json`);
  const known = await readFile(cache, "utf8").then((t) => JSON.parse(t) as TrackAnalysis).catch(() => null);
  if (known) return known;
  const measured = await analyzeTrack(await trackFile(track));
  await writeFile(cache, JSON.stringify(measured));
  return measured;
}

// Keeps the music cache under ENGINE_MUSIC_GB (2 by default): the tracks used longest ago go
// first. Their measurements stay, so no track is measured twice.
export async function pruneMusic(maxBytes = Number(process.env.ENGINE_MUSIC_GB ?? 2) * 1024 ** 3) {
  const dir = musicDir();
  const names = (await readdir(dir).catch(() => [] as string[])).filter((n) => n.endsWith(".m4a") && !n.includes(".partial."));
  const files = (await Promise.all(names.map(async (n) => ({ file: path.join(dir, n), st: await stat(path.join(dir, n)).catch(() => null) }))))
    .flatMap(({ file, st }) => (st ? [{ file, size: st.size, used: st.mtimeMs }] : []))
    .sort((a, b) => b.used - a.used);
  let total = 0;
  for (const f of files) {
    total += f.size;
    if (total > maxBytes) await rm(f.file, { force: true });
  }
}

// Two jobs asking for the same track share one download.
const inFlight = new Map<string, Promise<string>>();

type Downloadable = Pick<Track, "id" | "title" | "url">;

export function trackFile(track: Downloadable): Promise<string> {
  let job = inFlight.get(track.id);
  if (!job) {
    job = prepare(track).finally(() => inFlight.delete(track.id));
    inFlight.set(track.id, job);
  }
  return job;
}

async function prepare(track: Downloadable) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(track.id)) throw new Error(`Bad music track id "${track.id}"`);
  const dir = musicDir();
  const out = path.join(dir, `${track.id}.m4a`);
  if (await stat(out).then((s) => s.size > 0, () => false)) {
    // Marks it as just used, for pruneMusic.
    await utimes(out, new Date(), new Date()).catch(() => {});
    return out;
  }

  await mkdir(dir, { recursive: true });
  const tag = `${track.id}.${process.pid}.${Date.now()}`;
  const source = path.join(dir, `${tag}.source`);
  const partial = path.join(dir, `${tag}.partial.m4a`);
  try {
    // Tracks the studio keeps in Google Drive are "drive:<file id>"; the rest are web links.
    // archive.org sometimes answers a 5xx for a moment: try a few times before giving up.
    const get = () => (track.url.startsWith("drive:") ? fetchDriveFile(track.url.slice(6)) : fetch(track.url, { signal: AbortSignal.timeout(5 * 60_000) }));
    let res = await get();
    for (let tries = 1; res.status >= 500 && tries < 4; tries++) {
      await new Promise((r) => setTimeout(r, 2000 * tries));
      res = await get();
    }
    if (!res.ok || !res.body) throw new Error(`Couldn't download music "${track.title}" (${res.status})`);
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(source));

    // Two-pass loudnorm: measure first, so the second pass can apply one steady gain
    // instead of riding the level through the song.
    const target = `I=${LUFS}:TP=-1.5:LRA=11`;
    const { stderr } = await run(ffmpeg(), [
      "-hide_banner", "-nostats", "-i", source, "-map", "0:a:0",
      "-af", `loudnorm=${target}:print_format=json`, "-f", "null", "-",
    ]);
    const m = JSON.parse(stderr.slice(stderr.lastIndexOf("{"), stderr.lastIndexOf("}") + 1)) as Record<string, string>;
    await run(ffmpeg(), [
      "-v", "error", "-y", "-i", source, "-map", "0:a:0",
      "-af",
      `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}` +
        `:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`,
      "-ar", "48000", "-ac", "2", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
      partial,
    ]);
    await rename(partial, out);
    return out;
  } finally {
    await rm(source, { force: true });
    await rm(partial, { force: true });
  }
}
