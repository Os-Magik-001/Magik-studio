// Royalty-free music for edits. music/library.json lists the tracks: CC0 or the Pixabay
// Content License, so they can go under client videos on any platform without credit. Each entry's `page` is the archived
// freepd.com listing that states the licence (the site closed in 2025; the files are served
// from an archive.org mirror, byte-identical to freepd.com's originals). bpm and firstBeat
// were measured from the audio, so beat n falls at firstBeat + n * 60 / bpm.

import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
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

export type Track = {
  id: string;
  title: string;
  artist: string;
  mood: (typeof MOODS)[number];
  energy: "low" | "medium" | "high";
  bpm: number;
  firstBeat: number;
  duration: number;
  url: string;
  page: string;
  license: string;
};

const LUFS = -16;

export const musicDir = () => process.env.ENGINE_MUSIC_DIR ?? path.join(os.tmpdir(), "magik-engine-music");
const ffmpeg = () => process.env.FFMPEG_PATH ?? "ffmpeg";

export async function loadLibrary(): Promise<Track[]> {
  return JSON.parse(await readFile(new URL("../music/library.json", import.meta.url), "utf8")) as Track[];
}

export function describeLibrary(tracks: Track[]) {
  return tracks
    .map((t) => `${t.id}: ${t.mood}, ${t.energy} energy, ${t.bpm} BPM, ${Math.round(t.duration)}s`)
    .join("\n");
}

// Two jobs asking for the same track share one download.
const inFlight = new Map<string, Promise<string>>();

export function trackFile(track: Track): Promise<string> {
  let job = inFlight.get(track.id);
  if (!job) {
    job = prepare(track).finally(() => inFlight.delete(track.id));
    inFlight.set(track.id, job);
  }
  return job;
}

async function prepare(track: Track) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(track.id)) throw new Error(`Bad music track id "${track.id}"`);
  const dir = musicDir();
  const out = path.join(dir, `${track.id}.m4a`);
  if (await stat(out).then((s) => s.size > 0, () => false)) return out;

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
