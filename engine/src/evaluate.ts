// The test bench's measurements: what an edit looks like from the outside (its cuts,
// the air around them, the gaps between lines, its length), which take of each line
// it used, and how close one edit is to another. The engine's edit and the team's
// final edit of the same footage go through exactly the same measurements.

import { spawn } from "node:child_process";
import { config } from "./config.ts";
import type { TranscriptLine } from "./transcribe.ts";

type Word = { start: number; end: number; text: string };

// Cut times in a finished video: frames that differ from the one before far more than
// their neighbours do. Unlike a scene-change score, this also catches jump cuts within
// one framing.
export async function detectCuts(file: string): Promise<number[]> {
  const W = 48;
  const H = 84;
  const N = W * H;
  const buf = await new Promise<Buffer>((resolve, reject) => {
    const child = spawn(config.ffmpeg, ["-v", "error", "-i", file, "-vf", `fps=30,scale=${W}:${H},format=gray`, "-f", "rawvideo", "-"]);
    const chunks: Buffer[] = [];
    child.stdout.on("data", (d: Buffer) => chunks.push(d));
    child.on("error", reject);
    child.on("close", () => resolve(Buffer.concat(chunks)));
  });
  const frames = Math.floor(buf.length / N);
  const diff = [0];
  for (let f = 1; f < frames; f++) {
    let sum = 0;
    for (let i = 0; i < N; i++) sum += Math.abs(buf[f * N + i] - buf[(f - 1) * N + i]);
    diff.push(sum / N);
  }
  const cuts: number[] = [];
  for (let f = 1; f < frames; f++) {
    const around = [...diff.slice(Math.max(1, f - 15), f), ...diff.slice(f + 1, f + 16)].sort((a, b) => a - b);
    const typical = around[Math.floor(around.length / 2)] || 0.1;
    const peak = Math.max(...diff.slice(Math.max(1, f - 3), f + 4));
    if (diff[f] > 6 && diff[f] > 3 * typical && diff[f] === peak && (!cuts.length || f / 30 - cuts.at(-1)! >= 0.3)) cuts.push(f / 30);
  }
  return cuts;
}

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

export type CutStats = {
  duration: number;
  cuts: number;
  cutsPerSecond: number;
  medianShot: number;
  // Seconds from a cut to the first word after it, and from the last word before it to the cut.
  headAir: number;
  tailAir: number;
  // Silences between phrases (0.15 to 3 s): median and the 90th percentile.
  gap: number;
  gapP90: number;
  longGaps: number;
  wordsPerMinute: number;
  speechShare: number;
};

export function cutStats(words: Word[], cuts: number[], duration: number): CutStats {
  const ws = [...words].sort((a, b) => a.start - b.start);
  const bounds = [0, ...cuts, duration];
  const shots = bounds.slice(1).map((t, i) => t - bounds[i]).filter((s) => s > 0.05);
  const head: number[] = [];
  const tail: number[] = [];
  for (const c of cuts) {
    const next = ws.find((w) => w.start >= c - 0.05);
    const prev = [...ws].reverse().find((w) => w.end <= c + 0.05);
    if (next && next.start - c < 1.5) head.push(Math.max(0, next.start - c));
    if (prev && c - prev.end < 1.5) tail.push(Math.max(0, c - prev.end));
  }
  const gaps = ws.slice(1).map((w, i) => w.start - ws[i].end).filter((g) => g >= 0.15 && g < 3);
  const speech = ws.reduce((s, w) => s + Math.max(0, w.end - w.start), 0);
  return {
    duration,
    cuts: cuts.length,
    cutsPerSecond: cuts.length / Math.max(1, duration),
    medianShot: median(shots),
    headAir: median(head),
    tailAir: median(tail),
    gap: median(gaps),
    gapP90: quantile(gaps, 0.9),
    longGaps: gaps.filter((g) => g > 0.9).length,
    wordsPerMinute: (ws.length / Math.max(1, duration)) * 60,
    speechShare: Math.min(1, speech / Math.max(1, duration)),
  };
}

export const tokens = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 1);

const similarity = (a: string[], b: string[]) => {
  const sa = new Set(a);
  const sb = new Set(b);
  return [...sa].filter((t) => sb.has(t)).length / Math.max(1, Math.max(sa.size, sb.size));
};

// How much of the same dialogue two edits keep: F1 over their words.
export function wordOverlap(a: string, b: string) {
  const count = (ts: string[]) => ts.reduce((m, t) => m.set(t, (m.get(t) ?? 0) + 1), new Map<string, number>());
  const ca = count(tokens(a));
  const cb = count(tokens(b));
  let common = 0;
  for (const [t, n] of ca) common += Math.min(n, cb.get(t) ?? 0);
  const na = [...ca.values()].reduce((s, n) => s + n, 0);
  const nb = [...cb.values()].reduce((s, n) => s + n, 0);
  return na + nb ? (2 * common) / (na + nb) : 0;
}

// Mono PCM of a stretch of a file, at a low rate: enough to recognise a recording.
const RATE = 2000;
export function pcm(file: string, start: number, seconds: number): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const child = spawn(config.ffmpeg, ["-v", "error", "-ss", Math.max(0, start).toFixed(3), "-t", seconds.toFixed(3), "-i", file, "-vn", "-ac", "1", "-ar", String(RATE), "-f", "s16le", "-"]);
    const chunks: Buffer[] = [];
    child.stdout.on("data", (d: Buffer) => chunks.push(d));
    child.on("error", reject);
    child.on("close", () => {
      const buf = Buffer.concat(chunks);
      const out = new Float32Array(Math.floor(buf.length / 2));
      for (let i = 0; i < out.length; i++) out[i] = buf.readInt16LE(i * 2) / 32768;
      resolve(out);
    });
  });
}

// Where `needle` sits inside `hay`: normalized cross-correlation, best offset in samples.
export function locate(needle: Float32Array, hay: Float32Array) {
  const n = needle.length;
  if (!n || hay.length < n) return { offset: 0, score: 0 };
  let mean = 0;
  for (const v of needle) mean += v;
  mean /= n;
  const nd = needle.map((v) => v - mean);
  let ne = 0;
  for (const v of nd) ne += v * v;
  // Prefix sums for the hay's running mean and energy.
  const s1 = new Float64Array(hay.length + 1);
  const s2 = new Float64Array(hay.length + 1);
  for (let i = 0; i < hay.length; i++) {
    s1[i + 1] = s1[i] + hay[i];
    s2[i + 1] = s2[i] + hay[i] * hay[i];
  }
  let best = { offset: 0, score: -1 };
  for (let o = 0; o + n <= hay.length; o++) {
    let dot = 0;
    for (let k = 0; k < n; k++) dot += nd[k] * hay[o + k];
    const sum = s1[o + n] - s1[o];
    const he = s2[o + n] - s2[o] - (sum * sum) / n;
    const score = he > 0 && ne > 0 ? dot / Math.sqrt(he * ne) : 0;
    if (score > best.score) best = { offset: o, score };
  }
  return best;
}

export type Source = { id: string; file: string; transcript: TranscriptLine[] };
export type TakeMatch = { text: string; at: number; clip: string | null; sourceTime: number | null; score: number };

// For each line of an edit, the raw clip and the time in it that the line was cut
// from: the lines with matching words are the candidate takes, and the audio decides.
export async function matchTakes(edit: string, lines: TranscriptLine[], sources: Source[]): Promise<TakeMatch[]> {
  const out: TakeMatch[] = [];
  for (const line of lines) {
    const words = tokens(line.text);
    const result: TakeMatch = { text: line.text, at: line.start, clip: null, sourceTime: null, score: 0 };
    if (words.length >= 3) {
      const candidates = sources.flatMap((s) => s.transcript.filter((l) => similarity(words, tokens(l.text)) >= 0.5).map((l) => ({ s, l })));
      if (candidates.length) {
        const seconds = Math.min(1.5, Math.max(0.6, line.end - line.start));
        const needle = await pcm(edit, line.start, seconds);
        for (const { s, l } of candidates) {
          const from = Math.max(0, l.start - 1.2);
          const hay = await pcm(s.file, from, l.end - l.start + 2.4 + seconds);
          const { offset, score } = locate(needle, hay);
          if (score > result.score) Object.assign(result, { clip: s.id, sourceTime: from + offset / RATE, score });
        }
        if (result.score < 0.35) Object.assign(result, { clip: null, sourceTime: null });
      }
    }
    out.push(result);
  }
  return out;
}

// Of the reference's lines, how many the edit cut from the same take, from another
// take, or left out.
export function takeAgreement(reference: TakeMatch[], edit: TakeMatch[]) {
  let same = 0;
  let other = 0;
  let missing = 0;
  const details: string[] = [];
  for (const r of reference.filter((m) => m.clip)) {
    const twins = edit.filter((e) => e.clip && similarity(tokens(r.text), tokens(e.text)) >= 0.5);
    if (!twins.length) {
      missing++;
      details.push(`missing: "${r.text.trim()}"`);
    } else if (twins.some((e) => e.clip === r.clip && Math.abs(e.sourceTime! - r.sourceTime!) < 1.5)) same++;
    else {
      other++;
      details.push(`other take: "${r.text.trim()}" (team: ${r.clip} ${r.sourceTime!.toFixed(1)}s, engine: ${twins[0].clip} ${twins[0].sourceTime!.toFixed(1)}s)`);
    }
  }
  const total = same + other + missing;
  return { same, other, missing, rate: total ? same / total : NaN, details };
}
