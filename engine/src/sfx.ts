// Sound effects. Six are synthesized here (no licensing questions, soft and physical by design:
// air, felt thumps, a wooden tick, a breath swell); the sound designer also picks recorded ones from the
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
    ["whoosh", "Air swish", "titles, cards and camera moves; brightest at the middle of the move"],
    ["pop", "Soft tap", "something small appearing (a word in a list, a tile)"],
    ["hit", "Felt thump", "a 3D title or number landing, a reveal"],
    ["riser", "Breath swell", "into a reveal or the end card, peaking at its end"],
    ["click", "Wooden tick", "a step, a counter, a word locking in"],
    ["ding", "Warm low chime", "a positive result, sparingly"],
  ] as const
).map(([kind, title, use]) => ({ id: kind, title: `${title} (built-in): ${use}`, library: "studio", category: kind, tags: [kind], kind, duration: { whoosh: 0.55, pop: 0.14, hit: 0.8, riser: 1.8, click: 0.09, ding: 0.9 }[kind], url: "", page: "", license: "Synthesized by the engine" }));

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

// Pink noise (1/f, Paul Kellet's filter): air and cloth sound pink, white noise sounds like hiss.
function pink(seed: number) {
  const white = noise(seed);
  let b0 = 0, b1 = 0, b2 = 0;
  return () => {
    const w = white();
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    return (b0 + b1 + b2 + w * 0.1848) * 0.2;
  };
}

// State-variable filter whose cutoff can move per sample: low-pass and band-pass outputs.
function svf() {
  let low = 0;
  let band = 0;
  return (x: number, freq: number, q = 0.9) => {
    const f = 2 * Math.sin((Math.PI * Math.min(freq, RATE / 6)) / RATE);
    low += f * band;
    const high = x - low - band / q;
    band += f * high;
    return { low, band };
  };
}

// The studio's effects are one soft, physical family sized to the move: air that brightens with
// the move's speed, a felt thump with a body phones can play, a wooden tick, a breath that
// swells into the moment. No bubble pops, bells or buzzers: those read as template edits.
function synth(kind: Kind): Float32Array {
  const dur = { whoosh: 0.55, pop: 0.14, hit: 0.8, riser: 1.8, click: 0.09, ding: 0.9 }[kind];
  const n = Math.floor(dur * RATE);
  const out = new Float32Array(n);
  const air = pink(kind.length * 977);
  const rnd = noise(kind.length * 131);
  const f1 = svf(), f2 = svf(), f3 = svf();
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const p = t / dur;
    let v = 0;
    if (kind === "whoosh") {
      // Air past the camera: dark as the move starts, brightest at peak speed, dark as it lands.
      const speed = Math.sin(Math.PI * p) ** 1.6;
      const x = air();
      v = f1(x, 230 + 2400 * speed ** 1.3).low * (0.08 + speed) + f2(x, 220).low * speed * 0.35;
    } else if (kind === "hit") {
      // A felt-mallet landing: a low tone dropping in pitch, softly saturated so a phone plays it,
      // a warm body around 300 Hz and a muffled transient.
      const f = 58 + 52 * Math.exp(-t / 0.045);
      phase += (2 * Math.PI * f) / RATE;
      const env = (1 - Math.exp(-t / 0.002)) * Math.exp(-t / 0.13);
      const body = f3(f1(air(), 320, 0.8).band, 900).low;
      v = (Math.tanh(1.8 * Math.sin(phase)) / Math.tanh(1.8)) * env + body * Math.exp(-t / 0.05) * 1.6 + f2(air(), 1400).low * Math.exp(-t / 0.008) * 0.5;
    } else if (kind === "pop") {
      // A soft tap (a fingertip on a wooden box), for something small appearing.
      const f = 380 + 140 * Math.exp(-t / 0.02);
      phase += (2 * Math.PI * f) / RATE;
      v = Math.sin(phase) * Math.exp(-t / 0.025) * 0.7 + f1(rnd(), 1500).low * Math.exp(-t / 0.006) * 0.3;
    } else if (kind === "riser") {
      // A breath that opens into the moment: air getting brighter over a soft open fifth.
      const rise = p ** 2.2;
      const tone = (Math.sin(2 * Math.PI * 110 * t) + 0.6 * Math.sin(2 * Math.PI * 165 * t) + 0.35 * Math.sin(2 * Math.PI * 220.5 * t)) * rise ** 1.6 * 0.12;
      v = f1(air(), 200 + 3000 * rise).low * rise + tone;
    } else if (kind === "click") {
      // A quiet wooden tick, never a beep.
      v = f2(f1(rnd(), 2400, 1.2).band, 3600).low * Math.exp(-t / 0.006) + Math.sin(2 * Math.PI * 1008 * t) * Math.exp(-t / 0.011) * 0.35;
    } else if (kind === "ding") {
      // A warm, low chime (a soft mallet on wood), not a bell.
      v = f3(Math.sin(2 * Math.PI * 523.25 * t) * Math.exp(-t * 7) + 0.35 * Math.sin(2 * Math.PI * 784 * t) * Math.exp(-t * 11), 2200).low * Math.min(1, t / 0.006);
    }
    out[i] = v;
  }
  // a 4 ms fade-in and a short fade-out avoid clicks; then a steady peak (-3 dBFS)
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    out[i] *= Math.min(1, t / 0.004) * Math.min(1, (dur - t) / (kind === "riser" ? 0.004 : 0.03));
    peak = Math.max(peak, Math.abs(out[i]));
  }
  if (peak > 0) for (let i = 0; i < n; i++) out[i] *= 0.708 / peak;
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

const DIR = path.join(os.tmpdir(), "magik-engine-sfx-v3");

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
