// What the sound designer needs to know about a piece of audio, measured from the file
// rather than taken on trust: the tempo and beat grid, where the bars start, the loudness
// over time, where the sections change, where the music lifts (drops) and where it ends.
// For a sound effect, when its peak comes, so the peak can land on the moment.

import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { run } from "./exec.ts";

const RATE = 11025;
const N = 512;
const HOP = 256;
// Long files (hour-long mixes in a Drive library) are measured on their first ten minutes.
const LONGEST = 600;
const ffmpeg = () => process.env.FFMPEG_PATH ?? "ffmpeg";

type Level = "low" | "medium" | "high";

export type TrackAnalysis = {
  duration: number;
  bpm: number;
  // Beat n falls at firstBeat + n * 60 / bpm; bars (4/4) start at downbeat + m * 240 / bpm.
  firstBeat: number;
  downbeat: number;
  energy: Level;
  // When the full arrangement is in, after any intro.
  intro: number;
  sections: { start: number; end: number; level: Level }[];
  // Where the music lifts sharply: the moments to put a reveal on.
  drops: number[];
  // The last strong hit, and where the sound dies away.
  lastHit: number;
  end: number;
};

// Mono samples at RATE, decoded by ffmpeg (at most `seconds` of them).
export async function decode(file: string, seconds = LONGEST): Promise<Float32Array> {
  const raw = path.join(os.tmpdir(), `magik-pcm-${randomUUID()}.f32`);
  try {
    await run(ffmpeg(), ["-v", "error", "-y", "-i", file, "-map", "0:a:0", "-t", String(seconds), "-ac", "1", "-ar", String(RATE), "-f", "f32le", raw]);
    const buf = await readFile(raw);
    return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + (buf.length - (buf.length % 4))));
  } finally {
    await rm(raw, { force: true });
  }
}

// In-place radix-2 FFT.
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const xr = re[b] * cr - im[b] * ci;
        const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

// Spectral flux, all bands and the bass band (kicks mark the bars), one value per hop.
function onsets(x: Float32Array) {
  const frames = Math.max(0, Math.floor((x.length - N) / HOP) + 1);
  const all = new Float64Array(frames);
  const low = new Float64Array(frames);
  const win = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  const prev = new Float64Array(N / 2);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const bass = Math.ceil(150 / (RATE / N));
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < N; i++) {
      re[i] = x[f * HOP + i] * win[i];
      im[i] = 0;
    }
    fft(re, im);
    let flux = 0;
    let lowFlux = 0;
    for (let k = 1; k < N / 2; k++) {
      const mag = Math.log1p(1000 * Math.hypot(re[k], im[k]));
      const rise = Math.max(0, mag - prev[k]);
      flux += rise;
      if (k <= bass) lowFlux += rise;
      prev[k] = mag;
    }
    all[f] = flux;
    low[f] = lowFlux;
  }
  // Only what stands out from its neighbourhood counts as an onset.
  const local = (env: Float64Array) => {
    const out = new Float64Array(env.length);
    const r = 8;
    let sum = 0;
    for (let i = 0; i < Math.min(env.length, r); i++) sum += env[i];
    for (let i = 0; i < env.length; i++) {
      if (i + r < env.length) sum += env[i + r];
      if (i - r - 1 >= 0) sum -= env[i - r - 1];
      const count = Math.min(env.length, i + r + 1) - Math.max(0, i - r);
      out[i] = Math.max(0, env[i] - sum / count);
    }
    return out;
  };
  return { all: local(all), low: local(low) };
}

// The tempo whose beat period best repeats in the onsets (with its double and triple),
// leaning towards the 90-140 BPM most music sits in, folded into 70-180.
function tempo(env: Float64Array, fps: number) {
  const n = env.length;
  const lagOf = (bpm: number) => (fps * 60) / bpm;
  const maxLag = Math.ceil(lagOf(40) * 3) + 2;
  const ac = new Float64Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag && lag < n; lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += env[i] * env[i + lag];
    ac[lag] = s / (n - lag);
  }
  const at = (lag: number) => {
    const i = Math.floor(lag);
    const f = lag - i;
    return i + 1 < ac.length ? ac[i] * (1 - f) + ac[i + 1] * f : 0;
  };
  let best = { bpm: 120, score: -Infinity };
  for (let bpm = 60; bpm <= 200; bpm += 0.25) {
    const lag = lagOf(bpm);
    const comb = at(lag) + 0.5 * at(2 * lag) + 0.25 * at(3 * lag);
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 115) / 0.8) ** 2);
    const score = comb * prior;
    if (score > best.score) best = { bpm, score };
  }
  let bpm = best.bpm;
  while (bpm < 70) bpm *= 2;
  while (bpm > 180) bpm /= 2;
  return Math.round(bpm * 10) / 10;
}

// The exact tempo and beat phase: across a whole track a tempo off by 0.3 BPM drifts by most
// of a beat, so both are searched together on a fine grid around the first estimate, keeping
// the grid that collects the most onset energy.
function beatGrid(env: Float64Array, fps: number, estimate: number) {
  let best = { bpm: estimate, phase: 0, score: -1 };
  for (let bpm = estimate * 0.985; bpm <= estimate * 1.015; bpm += 0.01) {
    const period = (fps * 60) / bpm;
    for (let p = 0; p < period; p += 0.25) {
      let s = 0;
      for (let b = p; b < env.length - 1; b += period) {
        const i = b | 0;
        const f = b - i;
        s += env[i] * (1 - f) + env[i + 1] * f;
      }
      if (s > best.score) best = { bpm, phase: p, score: s };
    }
  }
  return best;
}

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const maxOf = (v: ArrayLike<number>, floor: number) => {
  let m = floor;
  for (let i = 0; i < v.length; i++) if (v[i] > m) m = v[i];
  return m;
};
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

// Every measurement, from samples at `rate` (RATE unless resampled elsewhere).
export function analyzeSamples(x: Float32Array, rate = RATE): TrackAnalysis {
  const duration = x.length / rate;
  const fps = rate / HOP;
  const env = onsets(x);
  const grid = beatGrid(env.all, fps, tempo(env.all, fps));
  const bpm = round(grid.bpm);
  const period = (fps * 60) / grid.bpm;
  const first = grid.phase;
  const beat = 60 / grid.bpm;
  // A frame's time is the centre of its window.
  const firstBeat = round((first + N / 2 / HOP) / fps, 3);

  // Bars: of the four beats, the one where the bass hits hardest.
  let bar = { j: 0, score: -1 };
  for (let j = 0; j < 4; j++) {
    let s = 0;
    for (let b = first + j * period; b < env.low.length; b += 4 * period) s += env.low[Math.round(b)] ?? 0;
    if (s > bar.score) bar = { j, score: s };
  }
  const downbeat = round(firstBeat + bar.j * beat, 3);
  const barLen = 4 * beat;
  const snapBar = (t: number) => {
    const n = Math.round((t - downbeat) / barLen);
    const s = downbeat + n * barLen;
    return Math.abs(s - t) <= barLen / 2 && s >= 0 && s <= duration ? round(s) : round(t);
  };

  // Loudness every half second, smoothed over 2.5 s so a single hit doesn't make a section.
  const step = Math.floor(rate / 2);
  const raw: number[] = [];
  for (let i = 0; i + step <= x.length; i += step) {
    let e = 0;
    for (let k = 0; k < step; k++) e += x[i + k] * x[i + k];
    raw.push(10 * Math.log10(e / step + 1e-10));
  }
  const lv = raw.map((_, i) => median(raw.slice(Math.max(0, i - 2), i + 3)));
  const peak = maxOf(lv, -100);
  const audible = lv.filter((v) => v > peak - 30);
  const mid = median(audible);

  // Sections: a new one starts where the level moves 3 dB from the section's average and
  // stays there for 2 s. Short ones merge into the one before.
  type Sec = { start: number; end: number; sum: number; count: number };
  const secs: Sec[] = [];
  let cur: Sec = { start: 0, end: 0, sum: 0, count: 0 };
  for (let i = 0; i < lv.length; i++) {
    const mean = cur.count ? cur.sum / cur.count : lv[i];
    const away = (v: number) => Math.abs(v - mean) >= 3 && Math.sign(v - mean) === Math.sign(lv[i] - mean);
    if (cur.count >= 4 && away(lv[i]) && lv.slice(i, i + 4).every(away)) {
      secs.push(cur);
      cur = { start: i * 0.5, end: i * 0.5, sum: 0, count: 0 };
    }
    cur.sum += lv[i];
    cur.count++;
    cur.end = (i + 1) * 0.5;
  }
  secs.push(cur);
  const merged: Sec[] = [];
  for (const s of secs) {
    const last = merged.at(-1);
    if (last && s.end - s.start < 4) {
      last.end = s.end;
      last.sum += s.sum;
      last.count += s.count;
    } else merged.push({ ...s });
  }
  const levelOf = (mean: number): Level => (mean >= peak - 3 ? "high" : mean <= mid - 4 ? "low" : "medium");
  // Boundaries move to the nearest bar; two that land on the same bar become one.
  const sections: (TrackAnalysis["sections"][number] & { mean: number })[] = [];
  for (const [i, s] of merged.entries()) {
    const start = i === 0 ? 0 : snapBar(s.start);
    const last = sections.at(-1);
    if (last && start - last.start < 1) continue;
    if (last) last.end = start;
    sections.push({ start, end: round(duration), level: levelOf(s.sum / s.count), mean: s.sum / s.count });
  }
  const drops = sections
    .slice(1)
    .filter((s, i) => s.mean - sections[i].mean >= 4)
    .map((s) => s.start);

  // A strong hit, judged against the track's own loud onsets (not its single loudest).
  const strongest = Math.max(1e-9, [...env.all].sort((a, b) => a - b)[Math.floor(env.all.length * 0.98)] ?? 0);
  let lastHit = 0;
  for (let i = env.all.length - 1; i >= 0; i--) {
    if (env.all[i] >= 0.5 * strongest) {
      lastHit = round((i * HOP) / rate);
      break;
    }
  }
  let end = round(duration);
  for (let i = lv.length - 1; i >= 0; i--) {
    if (lv[i] > peak - 30) {
      end = round(Math.min(duration, (i + 1) * 0.5));
      break;
    }
  }
  const intro = round(Math.max(0, lv.findIndex((v) => v >= mid - 3)) * 0.5);

  // Energy from how busy and how loud: onsets per second against the loudness.
  const busy = env.all.reduce((a, v) => a + (v > 0.25 * strongest ? 1 : 0), 0) / Math.max(1, duration);
  const energy: Level = busy >= 2.2 && bpm >= 95 ? "high" : busy < 1 || bpm < 80 ? "low" : "medium";

  return { duration: round(duration), bpm, firstBeat, downbeat, energy, intro, sections: sections.map(({ mean: _, ...s }) => s), drops, lastHit, end };
}

export async function analyzeTrack(file: string): Promise<TrackAnalysis> {
  const x = await decode(file);
  const a = analyzeSamples(x);
  if (x.length < LONGEST * RATE - RATE) return a;
  // A long file: its real length comes from the container.
  const { stdout } = await run(process.env.FFPROBE_PATH ?? "ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return { ...a, duration: round(Number(stdout) || a.duration) };
}

// A sound effect's length and the moment of its peak (loudest 10 ms).
export async function peakOf(file: string): Promise<{ duration: number; peak: number; max: number }> {
  const x = await decode(file);
  const w = Math.round(RATE * 0.01);
  let best = { at: 0, e: -1 };
  let max = 0;
  for (let i = 0; i + w <= x.length; i += w) {
    let e = 0;
    for (let k = 0; k < w; k++) {
      e += x[i + k] * x[i + k];
      max = Math.max(max, Math.abs(x[i + k]));
    }
    if (e > best.e) best = { at: i, e };
  }
  return { duration: round(x.length / RATE, 3), peak: round((best.at + w / 2) / RATE, 3), max };
}
