// The edit check, after the render: every edit is listened to the way an editor plays it
// back, without Claude. A whole-cut transcript isn't proof (Whisper "hears" a clipped word
// from the words around it), so each shot's sound is heard on its own, padded with silence:
//   - the sound at every cut: a cut should fall where the dialogue is down to the room,
//   - words cut: a word of the clip straddling a shot's edge,
//   - the shot's own words: transcribed alone and compared with the words it should say,
//     so a clipped first or last word, a fragment of the next line or a stray "um" shows.
// What it can fix it moves (an edge out of a word, a clipped word given back, a stray word
// left out), checking the fix by listening again; the rest is flagged for the editor.

import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.ts";
import { keptSounds, type ClipSound, type Sound } from "./edits.ts";
import { run } from "./exec.ts";
import { FPS, sameTake, timelineOf, type Clip, type EditPlan } from "./plan.ts";
import { levelAt, pcmOf, QUIET, quietest, SPEECH, speechMapOf } from "./speech.ts";
import { followCut } from "./tighten.ts";
import { transcriptionAvailable } from "./transcribe.ts";
import { norm } from "./words.ts";

// ---------------------------------------------------------------- listening

// A stretch of a file as a padded 16 kHz snippet: 0.5 s of silence before, 0.6 s after, and
// 15 ms fades at its edges, as the edit plays them.
export async function snippet(file: string, start: number, end: number, out: string) {
  await mkdir(path.dirname(out), { recursive: true });
  await run(config.ffmpeg, [
    "-v", "error", "-y", "-ss", Math.max(0, start).toFixed(4), "-t", Math.max(0.05, end - start).toFixed(4), "-i", file, "-vn",
    "-af", "afade=t=in:d=0.015,areverse,afade=t=in:d=0.015,areverse,adelay=500:all=1,apad=pad_dur=0.6",
    "-ar", "16000", "-ac", "1", out,
  ]);
}

// What Whisper hears in each wav on its own (one model load for all of them).
export async function listen(wavs: string[], language: string): Promise<string[]> {
  if (!wavs.length) return [];
  const args = ["-m", config.whisperModel!, "-l", language || "auto", "-bs", "5", "-mc", "0", "-oj", "-np", "-nt", ...wavs];
  await run(config.whisperBin, args);
  const out: string[] = [];
  for (const w of wavs) {
    const json = JSON.parse(await readFile(`${w}.json`, "utf8").catch(() => "{}")) as { transcription?: { text: string }[] };
    out.push((json.transcription ?? []).map((s) => s.text.trim()).join(" ").replace(/(^|\s)-\s/g, "$1").trim());
    await rm(`${w}.json`, { force: true });
  }
  return out;
}

// Whisper's own additions at the start of a snippet ("so", "but"), and the fillers people say.
const FILLER = new Set("so but and um umm uh uhm er erm yeah oh ah eh hmm mm euh heu hum bah ben et mais donc alors".split(" "));

export type Heard = { heard: string; missingStart: string[]; extraStart: string[]; missingEnd: string[]; extraEnd: string[]; ok: boolean };

const edits = (a: string, b: string) => {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return d[b.length];
};
// The same word, give or take Whisper's spelling ("cache" for "cash"), but not a word cut
// short ("horses" for "horsepower").
const sameWord = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && edits(a, b) <= Math.max(1, Math.round(a.length / 3)));

// The words heard against the words expected: what is missing or extra at either end (the
// middle of a line isn't the edit's business).
// A word heard as two ("PlanMaker", "Plan Maker") is one word, either way round.
function joinSplits(a: string[], b: string[]) {
  const whole = new Set(a.filter((w) => w.length >= 5));
  const out: string[] = [];
  for (let j = 0; j < b.length; j++) {
    if (j + 1 < b.length && whole.has(b[j] + b[j + 1])) out.push(b[j] + b[++j]);
    else out.push(b[j]);
  }
  return out;
}

export function compareWords(expected: string, heard: string): Heard {
  let e = expected.split(/\s+/).map(norm).filter(Boolean);
  let r = heard.split(/\s+/).map(norm).filter(Boolean);
  r = joinSplits(e, r);
  e = joinSplits(r, e);
  const n = e.length;
  const m = r.length;
  const D = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (sameWord(e[i - 1], r[j - 1]) ? 0 : 1));
  const pairs: [number, number][] = [];
  let [i, j] = [n, m];
  while (i > 0 && j > 0) {
    const match = sameWord(e[i - 1], r[j - 1]);
    if (D[i][j] === D[i - 1][j - 1] + (match ? 0 : 1)) {
      if (match) pairs.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (D[i][j] === D[i - 1][j] + 1) i--;
    else j--;
  }
  pairs.reverse();
  if (!pairs.length) return { heard, missingStart: e, extraStart: r, missingEnd: [], extraEnd: [], ok: !n && !m };
  const [[i0, j0], [i1, j1]] = [pairs[0], pairs.at(-1)!];
  const extraStart = r.slice(0, j0);
  const out = { heard, missingStart: e.slice(0, i0), extraStart, missingEnd: e.slice(i1 + 1), extraEnd: r.slice(j1 + 1) };
  // A lone "so" or "but" before the first word is usually Whisper's, not the sound's.
  const whispers = extraStart.length === 1 && FILLER.has(extraStart[0]);
  return { ...out, ok: !out.missingStart.length && !out.missingEnd.length && !out.extraEnd.length && (!extraStart.length || whispers) };
}

// ---------------------------------------------------------------- checking a cut

// One stretch of the edit with sound: a shot, or shots that carry on the same take (one
// sound, only the picture changes), with the words it should say.
type Run = { first: number; last: number; clip: string; start: number; end: number; expected: string; at: number; until: number };

export type CutCheck = {
  notes: string[];
  // For the editor: what the check couldn't settle.
  flags: string[];
  plan: EditPlan;
  repaired: boolean;
  shots: (Heard & { shots: string; start: number; end: number })[];
};

export function soundRuns(plan: EditPlan, sounds: Map<string, ClipSound>): Run[] {
  const { shots } = timelineOf(plan);
  const runs: Run[] = [];
  plan.segments.forEach((seg, i) => {
    const cs = seg.audio === "keep" && seg.hold === 0 ? sounds.get(seg.clip) : undefined;
    if (!cs) return;
    const last = runs.at(-1);
    if (last && last.last === i - 1 && sameTake(plan.segments[i - 1], seg)) {
      last.last = i;
      last.end = seg.end;
      last.until = shots[i].end;
    } else runs.push({ first: i, last: i, clip: seg.clip, start: seg.start, end: seg.end, expected: "", at: shots[i].start, until: shots[i].end });
  });
  // What each stretch should say: its shots' quoted words where they lie in it (the trim
  // pass's pieces share one quote, so they fall back on the words inside them).
  for (const r of runs) {
    const S = sounds.get(r.clip)!.sounds;
    const says = plan.segments.slice(r.first, r.last + 1).map((s) => s.say?.trim() ?? "");
    const quoted = says.every(Boolean) && new Set(says).size === says.length ? says.join(" ") : "";
    const k = keptSounds({ ...plan.segments[r.first], start: r.start, end: r.end, say: quoted }, S);
    r.expected = k ? S.slice(k[0], k[1] + 1).flatMap((s) => (s.text ? [s.text] : [])).join(" ") : "";
  }
  return runs;
}

const inside = (S: Sound[], t: number) => S.find((s) => s.text && s.start + 0.02 < t && s.end - 0.02 > t);

// Checks every edit of a cut and repairs what it can. `dialogue` is the render's own sound
// before music and effects (render() leaves it in picture.mp4); without it, each stretch is
// heard from its clip, as the render will play it.
export async function checkCut(opts: { dialogue?: string; plan: EditPlan; clips: Clip[]; sounds: Map<string, ClipSound>; workDir: string; language?: string }): Promise<CutCheck> {
  const { plan, sounds, workDir } = opts;
  const language = opts.language ?? config.whisperLanguage;
  const notes: string[] = [];
  const flags: string[] = [];
  const segs = plan.segments.map((s) => ({ ...s }));
  const runs = soundRuns(plan, sounds);
  const name = (r: Run) => (r.first === r.last ? `shot ${r.first + 1}` : `shots ${r.first + 1}-${r.last + 1}`);
  const at = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, "0")}`;
  await mkdir(workDir, { recursive: true });

  // 1. The sound at each cut, in the render (just outside the 15 ms fades on each side), or at
  // the shots' edges in their clips.
  const map = opts.dialogue ? speechMapOf(await pcmOf(opts.dialogue)) : null;
  for (let k = 1; k < runs.length; k++) {
    const [a, b] = [runs[k - 1], runs[k]];
    const before = map ? levelAt(map, b.at - 0.02) : levelAt(sounds.get(a.clip)!.map, a.end - 0.01);
    const after = map ? levelAt(map, b.at + 0.02) : levelAt(sounds.get(b.clip)!.map, b.start + 0.01);
    // Clear speech on either side of the cut, not a breath or a word's first whisper.
    if (Math.max(before, after) >= SPEECH + 6) flags.push(`${at(b.at)}: the cut into ${name(b)} goes through sound (${before.toFixed(0)} dB before, ${after.toFixed(0)} dB after, over the room)`);
  }

  // 2. Words cut at an edge, from the words placed on each clip's sound.
  for (const r of runs) {
    const S = sounds.get(r.clip)!.sounds;
    for (const [t, side] of [[r.start, "in"], [r.end, "out"]] as const) {
      const w = inside(S, t);
      if (w) flags.push(`${name(r)} ${side}: the edge at ${t.toFixed(2)}s is inside "${w.text}"`);
    }
  }

  // 3. Each stretch heard on its own, from the render, against its words.
  const heardShots: CutCheck["shots"] = [];
  if (await transcriptionAvailable()) {
    const clipOf = new Map(opts.clips.map((c) => [c.id, c]));
    const wavs = await Promise.all(runs.map(async (r, k) => {
      const wav = path.join(workDir, `run-${k}.wav`);
      if (opts.dialogue) await snippet(opts.dialogue, r.at, r.until, wav);
      else await snippet(clipOf.get(r.clip)!.preview, r.start, r.end, wav);
      return wav;
    }));
    const heard = await listen(wavs, language);
    // A line in another language than the clip's (franglais) comes out translated: those are
    // heard again with Whisper choosing the language.
    const far = runs.flatMap((r, k) => (r.expected && compareWords(r.expected, heard[k]).missingStart.length + compareWords(r.expected, heard[k]).missingEnd.length > r.expected.split(/\s+/).length / 2 ? [k] : []));
    if (far.length && language !== "auto") {
      const again = await listen(far.map((k) => wavs[k]), "auto");
      far.forEach((k, j) => {
        const score = (h: Heard) => h.missingStart.length + h.missingEnd.length + h.extraStart.length + h.extraEnd.length;
        if (score(compareWords(runs[k].expected, again[j])) < score(compareWords(runs[k].expected, heard[k]))) heard[k] = again[j];
      });
    }
    const problems: { r: Run; h: Heard }[] = [];
    runs.forEach((r, k) => {
      if (!r.expected) return;
      const h = compareWords(r.expected, heard[k]);
      heardShots.push({ ...h, shots: name(r), start: r.start, end: r.end });
      if (!h.ok) problems.push({ r, h });
    });

    // 4. Repairs, each checked by listening to the source again before it is kept. They move
    // an edge by the sound itself, not by the word times (those are what went wrong): past
    // the run of sound the edge is in or next to, to the room on its far side.
    const trials: { r: Run; side: "in" | "out"; t: number; why: string }[] = [];
    for (const { r, h } of problems) {
      const cmap = sounds.get(r.clip)!.map;
      const L = cmap.level;
      const frame = (t: number) => Math.min(L.length - 1, Math.max(0, Math.round(t * 100)));
      // The run of sound at frame k (or the nearest one in the direction `step`).
      const runFrom = (k: number, step: 1 | -1) => {
        while (k > 0 && k < L.length - 1 && L[k] < QUIET) k += step;
        let [a, b] = [k, k];
        while (a > 0 && L[a - 1] >= QUIET) a--;
        while (b < L.length && L[b] >= QUIET) b++;
        return [a / 100, b / 100] as const;
      };
      if (h.missingStart.length) {
        const [a] = runFrom(frame(r.start), -1);
        if (a < r.start - 0.01 && a > r.start - 0.6) trials.push({ r, side: "in", t: quietest(cmap, Math.max(0, a - 0.1), a - 0.02, a - 0.06), why: `"${h.missingStart.join(" ")}" was missing at the start` });
      } else if (h.extraStart.some((w) => !FILLER.has(w)) || h.extraStart.length > 1) {
        const [, b] = runFrom(frame(r.start + 0.02), 1);
        const [next] = runFrom(frame(b + 0.03), 1);
        if (b > r.start && next < r.end - 0.3) trials.push({ r, side: "in", t: quietest(cmap, b + 0.02, Math.max(b + 0.02, next - 0.04), Math.max(b + 0.02, next - 0.1)), why: `"${h.extraStart.join(" ")}" was heard before the first word` });
      }
      if (h.missingEnd.length) {
        const [, b] = runFrom(frame(r.end), 1);
        if (b > r.end + 0.01 && b < r.end + 0.6) {
          const [after] = runFrom(Math.min(L.length - 1, frame(b + 0.03)), 1);
          const room = after - b;
          trials.push({ r, side: "out", t: quietest(cmap, b + Math.min(0.05, room / 2), b + Math.min(0.3, room / 2), b + Math.min(0.25, room / 2)), why: `"${h.missingEnd.join(" ")}" was missing at the end` });
        }
      } else if (h.extraEnd.length) {
        const [a] = runFrom(frame(r.end - 0.02), -1);
        const [, prevEnd] = runFrom(frame(a - 0.03), -1);
        if (a < r.end && prevEnd > r.start + 0.3) trials.push({ r, side: "out", t: quietest(cmap, Math.min(prevEnd + 0.04, a - 0.02), a - 0.02, Math.min(prevEnd + 0.2, a - 0.02)), why: `"${h.extraEnd.join(" ")}" was heard after the last word` });
      }
    }
    if (trials.length) {
      const wavs = await Promise.all(trials.map(async (x, k) => {
        const wav = path.join(workDir, `try-${k}.wav`);
        const [start, end] = x.side === "in" ? [x.t, x.r.end] : [x.r.start, x.t];
        await snippet(clipOf.get(x.r.clip)!.preview, start, end, wav);
        return wav;
      }));
      const again = await listen(wavs, language);
      trials.forEach((x, k) => {
        const after = compareWords(x.r.expected, again[k]);
        const stray = (h: Heard) => h.extraStart.filter((w) => !FILLER.has(w)).length;
        const fixed = x.side === "in" ? !after.missingStart.length && stray(after) === 0 : !after.missingEnd.length && !after.extraEnd.length;
        if (fixed) {
          // The shot keeps a whole number of frames: an opening moves its start, an ending its end.
          if (x.side === "in") {
            const seg = segs[x.r.first];
            seg.start = seg.end - (Math.max(1, Math.round(((seg.end - x.t) / seg.speed) * FPS)) * seg.speed) / FPS;
          } else {
            const seg = segs[x.r.last];
            seg.end = seg.start + (Math.max(1, Math.round(((x.t - seg.start) / seg.speed) * FPS)) * seg.speed) / FPS;
          }
          notes.push(`${name(x.r)} ${x.side}: ${x.why}; moved to ${x.t.toFixed(2)}s, now heard as "${again[k]}"`);
        } else flags.push(`${name(x.r)} ${x.side} (${at(x.side === "in" ? x.r.at : x.r.until)}): ${x.why}; moving the edge didn't fix it (heard "${again[k]}"), listen to it`);
      });
    }
    for (const { r, h } of problems) {
      if (trials.some((x) => x.r === r)) continue;
      flags.push(`${name(r)} (${at(r.at)}): heard "${h.heard}", expected "${r.expected}"`);
    }
  }

  const repaired = segs.some((s, i) => Math.abs(s.start - plan.segments[i].start) > 1e-6 || Math.abs(s.end - plan.segments[i].end) > 1e-6);
  // Titles, graphics and effects stay on their moments.
  const fixedPlan = repaired ? followCut(plan, { ...plan, segments: segs }, segs.map((_, i) => i)) : plan;
  return { notes, flags, plan: fixedPlan, repaired, shots: heardShots };
}
