// Sound effects. Six are synthesized here (no licensing questions, short and subtle by
// design: whooshes, pops, hits); the sound designer also picks recorded ones from the
// libraries (sfx/*.json, built by scripts/sound-catalog.ts, and the studio's Drive libraries).

import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { peakOf } from "./analysis.ts";
import { fetchDriveFile } from "./drive.ts";
import { run } from "./exec.ts";
import type { EditPlan } from "./plan.ts";

const RATE = 48000;
type Kind = EditPlan["sfx"][number]["kind"];

// An effect in a library. `kind` is the built-in effect closest to it, played instead when
// the file can't be fetched (null: nothing close, so the effect is skipped).
export type SfxEntry = {
  id: string;
  title: string;
  library: string;
  category: string;
  tags: string[];
  kind: Kind | null;
  duration: number;
  // A web link, "drive:<file id>", or empty for the built-in effects.
  url: string;
  page: string;
  license: string;
};

export const BUILT_IN: SfxEntry[] = (
  [
    ["whoosh", "Soft whoosh", "transitions and fast moves"],
    ["pop", "Pop", "text or a graphic appearing"],
    ["hit", "Low hit", "a big reveal or punchline"],
    ["riser", "Riser", "a build into a drop, peaking at its end"],
    ["click", "Click", "UI and typing"],
    ["ding", "Ding", "a positive result"],
  ] as const
).map(([kind, title, use]) => ({ id: kind, title: `${title} (built-in): ${use}`, library: "studio", category: kind, tags: [kind], kind, duration: { whoosh: 0.55, pop: 0.12, hit: 0.9, riser: 1.8, click: 0.04, ding: 0.9 }[kind], url: "", page: "", license: "Synthesized by the engine" }));

export async function loadSfxCatalog(extra: SfxEntry[] = []): Promise<SfxEntry[]> {
  const library = await readFile(new URL("../sfx/mixkit.json", import.meta.url), "utf8")
    .then((text) => JSON.parse(text) as SfxEntry[])
    .catch(() => []);
  return [...BUILT_IN, ...library, ...extra];
}

// Best matches for some words (title, category and tags), an optional built-in kind and a
// longest length. Recorded effects come before the engine's own on a tie: they sound richer.
export function searchSfx(entries: SfxEntry[], q: { words?: string; kind?: Kind; maxSeconds?: number }, limit = 15) {
  const asked = (q.words ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
  return entries
    .filter((e) => (!q.kind || e.kind === q.kind) && (!q.maxSeconds || e.duration <= q.maxSeconds))
    .map((e) => {
      const hay = `${e.title} ${e.category} ${e.tags.join(" ")}`.toLowerCase();
      const score = asked.reduce((a, w) => a + (e.tags.includes(w) || e.category === w ? 3 : hay.includes(w) ? 1 : 0), 0) - (e.library === "studio" ? 0.5 : 0);
      return { entry: e, score };
    })
    .filter((m) => m.score > 0 || !asked.length)
    .sort((a, b) => b.score - a.score || a.entry.duration - b.entry.duration)
    .slice(0, limit);
}

// A tiny deterministic noise source, so every render of a plan sounds the same.
function noise(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 31 - 1;
  };
}

// Resonant band-pass (state-variable filter) whose center can move per sample.
function bandpass() {
  let low = 0;
  let band = 0;
  return (x: number, freq: number, q = 1.2) => {
    const f = 2 * Math.sin((Math.PI * Math.min(freq, RATE / 6)) / RATE);
    low += f * band;
    const high = x - low - band / q;
    band += f * high;
    return band;
  };
}

function synth(kind: Kind): Float32Array {
  const dur = { whoosh: 0.55, pop: 0.12, hit: 0.9, riser: 1.8, click: 0.04, ding: 0.9 }[kind];
  const n = Math.floor(dur * RATE);
  const out = new Float32Array(n);
  const rnd = noise(kind.length * 977);
  const bp = bandpass();
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const p = t / dur;
    let v = 0;
    if (kind === "whoosh") {
      // Noise swept up then down through a band, swelling in the middle.
      const env = Math.sin(Math.PI * p) ** 2;
      v = bp(rnd(), 300 + 3200 * Math.sin(Math.PI * p), 1.6) * env * 1.6;
    } else if (kind === "pop") {
      const f = 900 - 500 * p;
      v = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 38) * 0.8;
    } else if (kind === "hit") {
      // A low thump with a short noise transient on top.
      const f = 70 * Math.exp(-t * 3) + 38;
      v = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 4.5) * 0.9 + rnd() * Math.exp(-t * 60) * 0.35;
    } else if (kind === "riser") {
      const env = p ** 2;
      v = (bp(rnd(), 400 + 5000 * p ** 2, 2) * 1.2 + Math.sin(2 * Math.PI * (200 + 600 * p ** 2) * t) * 0.25) * env;
    } else if (kind === "click") {
      v = rnd() * Math.exp(-t * 900) * 0.7 + Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t * 400) * 0.3;
    } else if (kind === "ding") {
      v = (Math.sin(2 * Math.PI * 1318.5 * t) * 0.6 + Math.sin(2 * Math.PI * 2637 * t) * 0.25) * Math.exp(-t * 5);
    }
    // 4 ms fade-in avoids a click at the start.
    out[i] = v * Math.min(1, t / 0.004);
  }
  return out;
}

function wav(samples: Float32Array) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((s, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2));
  return buf;
}

const DIR = path.join(os.tmpdir(), "magik-engine-sfx-v1");

// The effect's WAV file, synthesized once per machine.
export async function sfxFile(kind: Kind) {
  const file = path.join(DIR, `${kind}.wav`);
  if (!(await stat(file).catch(() => null))) {
    await mkdir(DIR, { recursive: true });
    await writeFile(file, wav(synth(kind)));
  }
  return file;
}

// How far before its `at` time an effect starts, so its peak lands on the moment.
export const sfxLead: Record<Kind, number> = { whoosh: 0.28, pop: 0, hit: 0, riser: 1.75, click: 0, ding: 0 };

// Two renders asking for the same effect share one download.
const fetching = new Map<string, Promise<{ file: string; lead: number }>>();

// A library effect as a WAV at a steady peak level (-3 dBFS), with the moment of its peak.
async function libraryFile(entry: SfxEntry) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(entry.id)) throw new Error(`Bad effect id "${entry.id}"`);
  const dir = path.join(DIR, "library");
  const file = path.join(dir, `${entry.id}.wav`);
  const meta = path.join(dir, `${entry.id}.json`);
  const known = await readFile(meta, "utf8").then((t) => JSON.parse(t) as { lead: number }).catch(() => null);
  if (known && (await stat(file).catch(() => null))) return { file, lead: known.lead };

  await mkdir(dir, { recursive: true });
  const source = path.join(dir, `${entry.id}.${process.pid}.source`);
  const partial = path.join(dir, `${entry.id}.${process.pid}.partial.wav`);
  try {
    const res = entry.url.startsWith("drive:") ? await fetchDriveFile(entry.url.slice(6)) : await fetch(entry.url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok || !res.body) throw new Error(`Couldn't download the effect "${entry.title}" (${res.status})`);
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(source));
    const { peak, max } = await peakOf(source);
    const gain = max > 0 ? Math.min(24, 20 * Math.log10(0.708 / max)) : 0;
    await run(process.env.FFMPEG_PATH ?? "ffmpeg", ["-v", "error", "-y", "-i", source, "-map", "0:a:0", "-t", "12", "-af", `volume=${gain.toFixed(2)}dB`, "-ar", String(RATE), "-ac", "2", "-c:a", "pcm_s16le", partial]);
    await rename(partial, file);
    await writeFile(meta, JSON.stringify({ lead: peak }));
    return { file, lead: peak };
  } finally {
    await rm(source, { force: true });
    await rm(partial, { force: true });
  }
}

// The file to play for one of the plan's effects and how early it starts: a library effect
// when the plan names one, otherwise (or when it can't be fetched) the built-in kind. Null
// when a library effect with no built-in equivalent can't be fetched.
export async function sfxSource(fx: EditPlan["sfx"][number], catalog: SfxEntry[], warn: (msg: string) => void = () => {}) {
  const entry = fx.id ? catalog.find((e) => e.id === fx.id) : undefined;
  if (entry?.url) {
    let job = fetching.get(entry.id);
    if (!job) {
      job = libraryFile(entry).finally(() => fetching.delete(entry.id));
      fetching.set(entry.id, job);
    }
    try {
      return await job;
    } catch (err) {
      warn(`effect ${entry.id} unavailable: ${(err as Error).message}`);
      if (!entry.kind) return null;
      return { file: await sfxFile(entry.kind), lead: sfxLead[entry.kind] };
    }
  }
  return { file: await sfxFile(fx.kind), lead: sfxLead[fx.kind] };
}
