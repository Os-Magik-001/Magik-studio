// Sound effects, synthesized rather than downloaded: no licensing questions, and
// they're short and subtle by design (whooshes, pops, hits), mixed under the voice.

import { mkdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { EditPlan } from "./plan.ts";

const RATE = 48000;
type Kind = EditPlan["sfx"][number]["kind"];

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
