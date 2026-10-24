// Word times that sit on the sound. Whisper's own times drift: with VAD, whisper.cpp keeps
// word times on the silence-stripped timeline, so a line's words could land up to ~2 s
// early, and its DTW starts run 0.1-0.4 s late even without VAD. Edits placed from them
// clipped words and left fragments of the next one. So:
//   1. a timing pass gives real-time word starts: whisper.cpp without VAD (the default), or
//      faster-whisper when ENGINE_WORD_TIMES=faster-whisper (slower, on the CPU),
//   2. those starts are carried onto the transcript's words by matching the text,
//   3. placeWords moves every start onto a real voice onset in the speech map and ends each
//      word where its sound stops.

import { mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.ts";
import { run } from "./exec.ts";
import { frameOf, QUIET, runs, syllablesOf, type SpeechMap } from "./speech.ts";

export type Word = { start: number; end: number; text: string };

// ---------------------------------------------------------------- timing sources

// How a source's starts sit against the real onsets: `bias` seconds late on average, how far
// before and after it the real onset can be, how widely it scatters (`spread`), and how much
// that error changes from one word to the next within a phrase (`drift`): Whisper's errors
// run together, so a whole phrase is late by about the same amount.
export type Timing = { bias: number; early: number; late: number; spread: number; drift: number };
// whisper.cpp's DTW starts: late by 0.13 s on the median, by up to 0.65 s in running speech.
export const DTW: Timing = { bias: 0.15, early: 0.8, late: 0.35, spread: 0.25, drift: 0.12 };
// faster-whisper's starts reach back into the silence before a line by up to 0.35 s.
export const FASTER: Timing = { bias: -0.08, early: 0.4, late: 0.5, spread: 0.2, drift: 0.12 };
// Times left on VAD's stripped timeline: the real word can be up to ~2.5 s later.
export const STRIPPED: Timing = { bias: -0.6, early: 0.6, late: 2.6, spread: 0.5, drift: 0.1 };

const TOOL = fileURLToPath(new URL("../tools/words.py", import.meta.url));

export const fasterWhisper = () => (process.env.ENGINE_WORD_TIMES ?? "").toLowerCase() === "faster-whisper";
const python = () => process.env.FASTER_WHISPER_PYTHON ?? "/usr/bin/python3";
const fwModel = () => process.env.FASTER_WHISPER_MODEL ?? "large-v3-turbo";

let fwReady: Promise<boolean> | undefined;
// faster-whisper runs under the system Python with its packages in the user's site-packages,
// and only from models already on disk (it never downloads one in the middle of a job).
export function fasterWhisperAvailable() {
  fwReady ??= fasterWhisper()
    ? run(python(), ["-c", `from faster_whisper.utils import download_model; download_model(${JSON.stringify(fwModel())}, local_files_only=True)`]).then(() => true, () => false)
    : Promise.resolve(false);
  return fwReady;
}

// Real-time words from faster-whisper, one list per wav (16 kHz mono). `language` "auto" detects it.
export async function fasterWhisperWords(wavs: string[], language: string, prompt?: string): Promise<(Word & { p: number })[][]> {
  if (!wavs.length) return [];
  const { stdout } = await run(python(), [TOOL, fwModel(), language || "auto", prompt?.trim() || "-", ...wavs]);
  const byFile = new Map<string, (Word & { p: number })[]>();
  for (const line of stdout.split("\n").filter((l) => l.startsWith("{"))) {
    const r = JSON.parse(line) as { file: string; words: [number, number, string, number][] };
    byFile.set(r.file, r.words.map(([start, end, text, p]) => ({ start, end, text, p })));
  }
  return wavs.map((w) => byFile.get(w) ?? []);
}

type Token = { text: string; offsets: { from: number; to: number }; t_dtw?: number };
type Segment = { offsets: { from: number; to: number }; text: string; tokens?: Token[] };

// Words from whisper.cpp's full JSON: tokens are word pieces, and a leading space starts a
// new word. The start is the token's DTW time; the end, the next word's start.
export function wordsOfSegment(segment: Segment): Word[] {
  const end = segment.offsets.to / 1000;
  const words: { start: number; text: string }[] = [];
  for (const t of segment.tokens ?? []) {
    if (t.text.startsWith("[_") || !t.text.trim()) continue;
    const at = t.t_dtw !== undefined && t.t_dtw >= 0 ? t.t_dtw / 100 : t.offsets.from / 1000;
    if (t.text.startsWith(" ") || words.length === 0) words.push({ start: at, text: t.text.trim() });
    else words[words.length - 1].text += t.text;
  }
  return words
    .map((w, i) => ({ start: w.start, end: Math.min(words[i + 1]?.start ?? end, w.start + 1.5), text: w.text }))
    .filter((w) => /[\p{L}\p{N}]/u.test(w.text));
}

// The DTW preset that matches a whisper.cpp model (word timing needs it, with flash attention off).
export function dtwPreset(model: string) {
  const name = path.basename(model).toLowerCase();
  if (name.includes("large-v3-turbo")) return "large.v3.turbo";
  for (const size of ["large-v3", "large-v2", "large-v1", "medium", "small", "base", "tiny"]) {
    if (name.includes(size)) return size.replace("-", ".") + (name.includes(".en") && !size.startsWith("large") ? ".en" : "");
  }
  return null;
}

// whisper.cpp over a 16 kHz wav without VAD: every time is on the real timeline.
export async function whisperWords(wav: string, language: string, prompt?: string): Promise<Word[]> {
  const dir = path.join(os.tmpdir(), "magik-words");
  await mkdir(dir, { recursive: true });
  const base = path.join(dir, `${path.basename(wav)}.${process.pid}.${Date.now()}`);
  const args = ["-m", config.whisperModel!, "-f", wav, "-l", language || "auto", "-ml", "48", "-sow", "-ojf", "-of", base, "-np"];
  const dtw = dtwPreset(config.whisperModel!);
  if (dtw) args.push("-nfa", "--dtw", dtw);
  if (prompt) args.push("--prompt", prompt);
  try {
    await run(config.whisperBin, args);
    const json = JSON.parse(await readFile(`${base}.json`, "utf8")) as { transcription?: Segment[] };
    return (json.transcription ?? []).flatMap(wordsOfSegment);
  } finally {
    await rm(`${base}.json`, { force: true });
  }
}

// ---------------------------------------------------------------- carrying times over

export const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]/gu, "");

// How alike two words are: 3 the same, 1.5 one letter off (or one is a piece of the other).
function alike(a: string, b: string) {
  if (!a || !b) return -2;
  if (a === b) return 3;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return 1.5;
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 3) return -2;
  // One substitution, insertion or deletion.
  let i = 0;
  while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
  const rest = (x: string, k: number) => x.slice(k);
  const ok = rest(a, i + 1) === rest(b, i + 1) || rest(a, i + 1) === rest(b, i) || rest(a, i) === rest(b, i + 1);
  return ok ? 1.5 : -2;
}

// The timing pass's start for each transcript word: the two word lists matched by their text
// (an alignment, so a word missing from one side doesn't shift the rest), within `reach`
// seconds of each other. Words without a match get their neighbours' shift.
export function carryTimes(words: Word[], timing: Word[], reach: { early: number; late: number } = { early: 1.2, late: 3 }): number[] {
  const n = words.length;
  const m = timing.length;
  const a = words.map((w) => norm(w.text));
  const b = timing.map((w) => norm(w.text));
  const GAP = -1;
  // score[i][j]: best alignment of the first i words with the first j timing words.
  const score = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const move = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));
  for (let i = 1; i <= n; i++) (score[i][0] = i * GAP), (move[i][0] = 1);
  for (let j = 1; j <= m; j++) (score[0][j] = j * GAP), (move[0][j] = 2);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const dt = timing[j - 1].start - words[i - 1].start;
      const pair = dt >= -reach.early && dt <= reach.late ? alike(a[i - 1], b[j - 1]) : -Infinity;
      const options = [score[i - 1][j - 1] + pair, score[i - 1][j] + GAP, score[i][j - 1] + GAP];
      const k = options.indexOf(Math.max(...options));
      score[i][j] = options[k];
      move[i][j] = k;
    }
  }
  const shift: (number | null)[] = new Array(n).fill(null);
  let [i, j] = [n, m];
  while (i > 0 && j > 0) {
    if (move[i][j] === 0) {
      if (alike(a[i - 1], b[j - 1]) > 0) shift[i - 1] = timing[j - 1].start - words[i - 1].start;
      i--;
      j--;
    } else if (move[i][j] === 1) i--;
    else j--;
  }
  // Unmatched words move with the nearest matched word before them (or after, at the start).
  const out = words.map((w) => w.start);
  let last: number | null = null;
  for (let k = 0; k < n; k++) {
    if (shift[k] !== null) last = shift[k];
    out[k] = words[k].start + (shift[k] ?? last ?? shift.find((s) => s !== null) ?? 0);
  }
  return out;
}

// ---------------------------------------------------------------- placing words on the sound

export type Placed = Word & { placed: boolean };

// About how many syllables a word has: its groups of vowels, less a silent final "e" ("came",
// "faire") or "-es" ("choses"); letters spoken one by one for capitals ("GLE", "PC") and
// about one and a half per digit ("430").
export function syllableCount(text: string) {
  const raw = text.replace(/[^\p{L}\p{N}]/gu, "");
  if (/^[\p{Lu}\d]{2,5}$/u.test(raw) && /\p{Lu}/u.test(raw)) return Math.min(6, [...raw].reduce((n, c) => n + (/\d/.test(c) ? 1.5 : 1), 0) | 0);
  const w = norm(text);
  if (!w) return 1;
  if (/^\d+$/.test(w)) return Math.max(1, Math.round(w.length * 1.6));
  let n = (w.match(/[aeiouy]+/g) ?? []).length;
  if (n > 1 && (/[^aeiouyl]e$/.test(w) || /[^aeiouy]es$/.test(w))) n--;
  return Math.max(1, n);
}

// The words placed on the syllables of the sound, in order, by a dynamic program: each word
// takes a run of syllables close to its own count (so a word can't swallow the next one), it
// starts near where the timing source put it (allowing for its bias), the source's error
// changes little from one word to the next inside a phrase, a word after punctuation starts
// after a pause rather than in running speech, and a syllable no word takes costs a little
// (Whisper leaves out "um" and laughs, but not real words). A word with no syllable near its
// estimate keeps it and is marked unplaced. A word starts where its sound does (the soft
// lead-in of an "s" or an "h" included) and ends where it stops, its decay and the release
// of a final "t" included.
// What the placement weighs: a syllable no word takes (Whisper leaves out "uh", laughs and
// breaths), a syllable more than the word's count (it was the next sound) or fewer (two
// vowels often read as one), a word opening a phrase in running speech, a break inside a
// word (a closure is shorter) or a pause, and leaving a word unplaced.
export const PLACEMENT = { skip: 0.3, over: 1.5, under: 0.6, opens: 0.6, gap: 1, pause: 2, unplaced: 5 };

export function placeWords(words: Word[], map: SpeechMap, timing: Timing = DTW): Placed[] {
  const n = words.length;
  if (!n) return [];
  const syl = syllablesOf(map);
  const huber = (d: number, scale: number) => {
    const x = Math.abs(d) / scale;
    return x <= 2 ? (x * x) / 2 : 2 * x - 2;
  };
  // A state: word i on syllables [a, a + c), or unplaced (c = 0) after syllable `last`.
  type State = { a: number; c: number; last: number; off: number; cost: number; from: number };
  const layers: State[][] = [];
  const MAX_SKIP = 8;
  for (let i = 0; i < n; i++) {
    const est = words[i].start;
    const expect = est - timing.bias;
    const want = syllableCount(words[i].text);
    const opens = i === 0 || /[.,!?;:…]$/.test(words[i - 1].text);
    const states: State[] = [];
    for (let a = 0; a < syl.length; a++) {
      if (syl[a].on < expect - timing.early) continue;
      if (syl[a].on > expect + timing.late) break;
      for (let c = 1; c <= Math.min(6, want + 2) && a + c <= syl.length; c++) {
        let cost = huber(syl[a].on - expect, timing.spread) + (c > want ? PLACEMENT.over : PLACEMENT.under) * Math.abs(c - want);
        if (opens && !syl[a].gapBefore) cost += PLACEMENT.opens;
        // A word doesn't hold a pause inside it.
        for (let k = a; k < a + c - 1; k++) {
          const gap = syl[k + 1].on - syl[k].off;
          if (gap > 0.35) cost += PLACEMENT.pause;
          else if (gap > 0.12) cost += PLACEMENT.gap;
        }
        states.push({ a, c, last: a + c - 1, off: syl[a].on - est, cost, from: -1 });
      }
    }
    states.push({ a: -1, c: 0, last: -1, off: -timing.bias, cost: PLACEMENT.unplaced, from: -1 });
    if (i === 0) states.forEach((s) => s.c === 0 && (s.last = -1));
    else {
      const prev = layers[i - 1];
      const phrase = !opens && est - words[i - 1].start < 0.8 ? 1 : 0.25;
      for (const s of states) {
        let best = Infinity;
        prev.forEach((p, k) => {
          let c = p.cost + phrase * huber(s.off - p.off, timing.drift);
          if (s.c > 0) {
            const skip = s.a - p.last - 1;
            if (skip < 0 || skip > MAX_SKIP) return;
            c += skip * PLACEMENT.skip;
          }
          if (c < best) [best, s.from] = [c, k];
        });
        if (s.from < 0) {
          s.cost = Infinity;
          continue;
        }
        s.cost += best;
        if (s.c === 0) s.last = prev[s.from].last;
      }
    }
    layers.push(states.filter((s) => s.cost < Infinity));
  }
  const chosen: State[] = new Array(n);
  let k = layers[n - 1].reduce((b, s, idx, all) => (s.cost < all[b].cost ? idx : b), 0);
  for (let i = n - 1; i >= 0; i--) {
    chosen[i] = layers[i][k];
    k = chosen[i].from;
  }
  const out: Placed[] = chosen.map((s, i) =>
    s.c > 0
      ? { start: syl[s.a].on, end: syl[s.a + s.c - 1].off, text: words[i].text, placed: true }
      : { start: words[i].start - timing.bias, end: words[i].end - timing.bias, text: words[i].text, placed: false },
  );
  // Unplaced words share the stretch between their placed neighbours, in order (evenly when
  // their estimates don't fit in it); the last of them ends where its sound does.
  const sound = runs(map);
  for (let i = 0; i < n; ) {
    if (out[i].placed) {
      i++;
      continue;
    }
    let j = i;
    while (j < n && !out[j].placed) j++;
    const lo = i > 0 ? out[i - 1].end : Math.max(0, out[i].start);
    const hi = j < n ? out[j].start : Math.max(lo + 0.3, out[j - 1].end);
    const step = (hi - lo) / (j - i);
    for (let k = i; k < j; k++) {
      const even = lo + (k - i) * step;
      const s = Math.min(Math.max(out[k].start, lo, k > i ? out[k - 1].start + Math.min(0.04, step) : lo), hi - (j - k) * Math.min(0.04, step));
      out[k].start = hi - lo < (j - i) * 0.08 ? even : s;
    }
    for (let k = i; k < j; k++) {
      const next = k + 1 < j ? out[k + 1].start : hi;
      const run = sound.find((r) => r.end > out[k].start && r.start < out[k].start + 0.15);
      const typical = 0.08 + 0.06 * norm(out[k].text).length;
      out[k].end = Math.max(out[k].start + 0.01, k + 1 < j ? next : Math.min(next, run ? Math.max(run.end, out[k].start + 0.05) : out[k].start + 0.05, out[k].start + typical));
    }
    i = j;
  }
  return out.map((w) => ({ ...w, start: round(w.start), end: round(w.end) }));
}

const round = (n: number) => Math.round(n * 1000) / 1000;

// Whether a stretch of the map is a real gap between words: down to the room for most of it.
export function quietShare(map: SpeechMap, from: number, to: number) {
  const [k0, k1] = [Math.max(0, frameOf(from)), Math.min(map.level.length, frameOf(to))];
  if (k1 <= k0) return 0;
  let quiet = 0;
  for (let k = k0; k < k1; k++) if (map.level[k] < QUIET) quiet++;
  return quiet / (k1 - k0);
}
