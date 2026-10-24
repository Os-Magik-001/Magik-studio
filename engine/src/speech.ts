// The speech map: how far a clip's sound sits above its own noise floor every 10 ms, in
// the voice band (150 Hz-4 kHz) and the hiss band (4-8 kHz, where "s", "f" and the
// release burst of a "t" or "k" live). Whisper's word times drift by tenths of a second
// (more with VAD), so edits are placed from this map: a cut belongs in a real gap, where
// the sound is down to the room, never inside a word. The map also places Whisper's
// words on the sound itself (placeWords), for edits and captions alike.

import { spawn } from "node:child_process";
import { config } from "./config.ts";

export const RATE = 16000;
// One frame of the map, in seconds.
export const HOP = 0.01;
const FRAME = RATE * HOP;

// dB over the floor: under QUIET is the room (a gap), over SPEECH is a voice, between is a
// breath, the decay of a word or a soft consonant.
export const QUIET = 6;
export const SPEECH = 12;

export type SpeechMap = {
  duration: number;
  // dB over the local noise floor, per 10 ms frame: the louder of the two bands.
  level: Float32Array;
  // The voice band alone (where the vowels are), dB over its floor.
  voice: Float32Array;
  // The clip's noise floor in the voice band, dBFS (for the logs).
  floor: number;
};

// Mono PCM of a file at `rate`, as floats.
export function pcmOf(file: string, rate = RATE, start = 0, seconds?: number): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const args = ["-v", "error", ...(start > 0 ? ["-ss", start.toFixed(3)] : []), ...(seconds ? ["-t", seconds.toFixed(3)] : []), "-i", file, "-vn", "-ac", "1", "-ar", String(rate), "-f", "f32le", "-"];
    const child = spawn(config.ffmpeg, args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let err = "";
    child.stdout.on("data", (d: Buffer) => chunks.push(d));
    child.stderr.on("data", (d) => (err = (err + d).slice(-2000)));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg couldn't read the sound of ${file}: ${err.trim().split("\n").at(-1)}`));
      const buf = Buffer.concat(chunks);
      const out = new Float32Array(Math.floor(buf.length / 4));
      for (let i = 0; i < out.length; i++) out[i] = buf.readFloatLE(i * 4);
      resolve(out);
    });
  });
}

// A 4th-order Butterworth high- or low-pass, as two biquads (the RBJ cookbook's).
function butterworth(x: Float32Array, kind: "high" | "low", f0: number, rate: number) {
  let y = x;
  for (const q of [0.5412, 1.3066]) {
    const w = (2 * Math.PI * f0) / rate;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    const [b0, b1, b2] = kind === "low" ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2] : [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
    const [a0, a1, a2] = [1 + alpha, -2 * cos, 1 - alpha];
    const out = new Float32Array(y.length);
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < y.length; i++) {
      const v = (b0 * y[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1;
      x1 = y[i];
      y2 = y1;
      y1 = v;
      out[i] = v;
    }
    y = out;
  }
  return y;
}

// Energy per frame in dB (digital silence reads -120).
function frameDb(x: Float32Array) {
  const n = Math.floor(x.length / FRAME);
  const out = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    let s = 0;
    for (let i = k * FRAME; i < (k + 1) * FRAME; i++) s += x[i] * x[i];
    out[k] = 10 * Math.log10(s / FRAME + 1e-12);
  }
  return out;
}

const percentile = (xs: ArrayLike<number>, q: number) => {
  const s = Float32Array.from(xs).sort();
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0;
};

// The floor under each frame: the quietest tenth of the sound around it (3 s each way), so
// a car or an air conditioner that comes and goes doesn't hide the gaps. It stays within
// 10 dB of the whole clip's floor, so a long stretch of talk isn't taken for the room.
function floorOf(db: Float32Array) {
  const real = db.filter((v) => v > -90);
  const global = percentile(real.length ? real : db, 0.1);
  const step = 50;
  const reach = 300;
  const points: number[] = [];
  for (let k = 0; k < db.length + step; k += step) {
    const slice = db.subarray(Math.max(0, k - reach), Math.min(db.length, k + reach)).filter((v) => v > -90);
    points.push(Math.min(global + 10, Math.max(global, slice.length > 20 ? percentile(slice, 0.1) : global)));
  }
  const floor = new Float32Array(db.length);
  for (let k = 0; k < db.length; k++) {
    const i = Math.floor(k / step);
    const f = (k % step) / step;
    floor[k] = points[i] * (1 - f) + points[Math.min(points.length - 1, i + 1)] * f;
  }
  return { floor, global };
}

export function speechMapOf(samples: Float32Array, rate = RATE): SpeechMap {
  if (rate !== RATE) throw new Error(`speech maps are made at ${RATE} Hz`);
  const voice = frameDb(butterworth(butterworth(samples, "high", 150, rate), "low", 4000, rate));
  const hiss = frameDb(butterworth(samples, "high", 4000, rate));
  const v = floorOf(voice);
  const h = floorOf(hiss);
  const level = new Float32Array(voice.length);
  const own = new Float32Array(voice.length);
  for (let k = 0; k < level.length; k++) {
    own[k] = voice[k] - v.floor[k];
    level[k] = Math.max(own[k], hiss[k] - h.floor[k]);
  }
  return { duration: samples.length / rate, level, voice: own, floor: v.global };
}

// One map per file, made once (a clip is read again for every shot cut from it).
const maps = new Map<string, Promise<SpeechMap>>();
export function speechMap(file: string): Promise<SpeechMap> {
  if (!maps.has(file)) {
    const p = pcmOf(file).then((x) => speechMapOf(x));
    p.catch(() => maps.delete(file));
    maps.set(file, p);
  }
  return maps.get(file)!;
}

// A map already made from the file's sound (transcription decodes it anyway).
export function rememberMap(file: string, map: SpeechMap) {
  maps.set(file, Promise.resolve(map));
}

// ---------------------------------------------------------------- reading the map

export const frameOf = (t: number) => Math.round(t / HOP);
export const timeOf = (k: number) => k * HOP;

// The level at a time, smoothed over 30 ms (one stray frame doesn't make a word).
export function levelAt(map: SpeechMap, t: number) {
  const k = frameOf(t);
  let s = 0;
  let n = 0;
  for (let j = k - 1; j <= k + 1; j++) {
    if (j < 0 || j >= map.level.length) continue;
    s += map.level[j];
    n++;
  }
  return n ? s / n : 0;
}

// The loudest level in a stretch: what a cut placed anywhere in it would cut through.
export function peakIn(map: SpeechMap, from: number, to: number) {
  let peak = -Infinity;
  for (let k = Math.max(0, frameOf(from)); k <= Math.min(map.level.length - 1, frameOf(to)); k++) peak = Math.max(peak, map.level[k]);
  return peak === -Infinity ? 0 : peak;
}

// A stretch of sound: [start, end) in seconds, with its loudest frame.
export type Island = { start: number; end: number; peak: number };

// Runs of frames over QUIET, as they are (a closure inside a word splits them).
export function runs(map: SpeechMap): Island[] {
  const L = map.level;
  const out: Island[] = [];
  let k = 0;
  while (k < L.length) {
    if (L[k] < QUIET) {
      k++;
      continue;
    }
    let j = k;
    let peak = -Infinity;
    while (j < L.length && L[j] >= QUIET) peak = Math.max(peak, L[j++]);
    out.push({ start: timeOf(k), end: timeOf(j), peak });
    k = j;
  }
  return out;
}

// Where a voice sounds: runs that reach SPEECH somewhere, with dips shorter than `bridge`
// inside them (a stop consonant's closure) kept inside the run. A short burst just after a
// run, with quiet after it (the release of a final "t" or "k"), belongs to it. One or two
// frames of hiss under SPEECH are the room flickering, not a sound.
export function islands(map: SpeechMap, bridge = 0.1): Island[] {
  const parts = runs(map).filter((r) => r.peak >= SPEECH || r.end - r.start > 0.025);
  const merged: Island[] = [];
  parts.forEach((r, i) => {
    const last = merged.at(-1);
    const after = parts[i + 1] ? parts[i + 1].start - r.end : Infinity;
    const burst = last && r.end - r.start <= 0.07 && r.start - last.end < 0.18 && after >= bridge && last.peak >= SPEECH;
    if (last && (r.start - last.end < bridge || burst)) {
      last.end = r.end;
      last.peak = Math.max(last.peak, r.peak);
    } else merged.push({ ...r });
  });
  return merged.filter((i) => i.peak >= SPEECH);
}

// A syllable: the peak of its vowel in the voice band, and where its sound begins and ends,
// at a quiet gap on either side (`gapBefore`, `gapAfter`) or at the deepest dip between it
// and the next syllable when the voice runs on.
export type Syllable = { peak: number; on: number; off: number; gapBefore: boolean; gapAfter: boolean };

// Every syllable of a clip: peaks of the voice band (smoothed over 50 ms) at least 13 dB over
// the room (a soft voice off-mic reaches no more) that stand 3 dB over the dips around them,
// 70 ms apart at least.
export function syllablesOf(map: SpeechMap): Syllable[] {
  const V = map.voice;
  const L = map.level;
  const n = V.length;
  const S = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    let sum = 0;
    let weight = 0;
    for (let j = -2; j <= 2; j++) {
      if (k + j < 0 || k + j >= n) continue;
      sum += V[k + j] * (3 - Math.abs(j));
      weight += 3 - Math.abs(j);
    }
    S[k] = sum / weight;
  }
  const peaks: number[] = [];
  for (let k = 1; k < n - 1; k++) {
    if (S[k] < SPEECH + 1 || S[k] < S[k - 1] || S[k] <= S[k + 1]) continue;
    let left = S[k];
    let right = S[k];
    for (let j = k - 1; j >= Math.max(0, k - 30) && S[j] <= S[k]; j--) left = Math.min(left, S[j]);
    for (let j = k + 1; j < Math.min(n, k + 30) && S[j] <= S[k]; j++) right = Math.min(right, S[j]);
    if (S[k] - Math.max(left, right) < 3) continue;
    const last = peaks.at(-1);
    if (last !== undefined && k - last < 7) {
      if (S[k] > S[last]) peaks[peaks.length - 1] = k;
      continue;
    }
    peaks.push(k);
  }
  const quiet = (k: number) => L[k] < QUIET && (L[k + 1] ?? 0) < QUIET;
  const out: Syllable[] = peaks.map((k) => ({ peak: timeOf(k), on: timeOf(k), off: timeOf(k + 1), gapBefore: false, gapAfter: false }));
  out.forEach((s, i) => {
    const k = peaks[i];
    if (i === 0) {
      let j = k;
      while (j > Math.max(0, k - 25) && !quiet(j - 2)) j--;
      s.on = timeOf(j);
      s.gapBefore = true;
    }
    if (i === out.length - 1) {
      let j = k;
      while (j < Math.min(n - 1, k + 40) && !quiet(j)) j++;
      s.off = timeOf(j);
      s.gapAfter = true;
      return;
    }
    const q = peaks[i + 1];
    // The first and last quiet frames between the two peaks, if the room shows between them.
    let a = -1;
    let b = -1;
    for (let j = k + 1; j < q - 1; j++) {
      if (!quiet(j)) continue;
      if (a < 0) a = j;
      b = j + 2;
    }
    const next = out[i + 1];
    if (a < 0) {
      let v = k + 1;
      for (let j = k + 1; j < q; j++) if (S[j] < S[v]) v = j;
      s.off = next.on = timeOf(v);
      return;
    }
    // The release of a final "t" or "k": a short burst with quiet after it is the syllable's.
    let end = a;
    let j = a;
    while (j < b && L[j] < QUIET) j++;
    let m = j;
    while (m < b && L[m] >= QUIET) m++;
    if (j < b && m - j <= 7 && j - a < 18 && m < b) end = m;
    s.off = Math.min(timeOf(end), s.peak + 0.45);
    next.on = Math.max(timeOf(b), next.peak - 0.25);
    s.gapAfter = next.gapBefore = true;
  });
  return out;
}

// The quietest moment in [from, to], preferring the one nearest `target` when the room is
// even: where an editor puts a cut inside a gap.
export function quietest(map: SpeechMap, from: number, to: number, target: number) {
  if (to <= from) return from;
  let best = target;
  let cost = Infinity;
  for (let k = frameOf(from); k <= frameOf(to); k++) {
    const t = Math.min(to, Math.max(from, timeOf(k)));
    // 1 dB of level weighs as much as 40 ms away from the target, and below the room
    // every frame is as good as another.
    const c = Math.max(0, levelAt(map, t) - QUIET / 2) + Math.abs(t - target) * 25;
    if (c < cost) [cost, best] = [c, t];
  }
  return best;
}
