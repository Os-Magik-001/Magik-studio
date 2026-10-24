// The edit-point bench, on real footage and without Claude: cuts whose edit points are known
// are measured as they were and after the edit pass (src/edits.ts).
//   - episode: the team's own edit points, found by matching the sound of their final to the
//     raw clips, then moved by up to ±0.3 s at random (as the word times drift), and refined;
//   - videob: Video B v4, which the client sent back for nine clipped words, against v5's
//     edges placed by hand.
// Measured: every shot heard on its own (whisper.cpp, padded with silence) for words lost or
// clipped at its edges and words or fragments that don't belong; the sound at every cut; the
// air before the first word and after the last (from the sound itself).
//
//   node --env-file=<local env> scripts/cuts-bench.ts --case episode --dir ~/Library/Caches/magik-eval/episode-1 --out <dir>
//   node --env-file=<local env> scripts/cuts-bench.ts --case videob --dir <videoB-data> --out <dir>
// Needs WHISPER_CPP_MODEL (and WHISPER_VAD_MODEL to transcribe as the engine does).

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { clipSounds, refineEdits, type ClipSound } from "../src/edits.ts";
import { probe } from "../src/media.ts";
import { DEFAULT_CAPTIONS, PLAIN_SHOT, type Clip, type EditPlan } from "../src/plan.ts";
import { checkCut, compareWords, listen, snippet, soundRuns } from "../src/qc.ts";
import { levelAt, pcmOf, speechMap, SPEECH, type SpeechMap } from "../src/speech.ts";
import { config } from "../src/config.ts";
import { run } from "../src/exec.ts";
import { namesIn, transcribe, type TranscriptLine } from "../src/transcribe.ts";
import { carryTimes, DTW, placeWords, STRIPPED, whisperWords, type Word } from "../src/words.ts";

const { values } = parseArgs({
  options: {
    case: { type: "string", default: "episode" },
    dir: { type: "string" },
    out: { type: "string", default: "cuts-bench" },
    jitter: { type: "string", default: "0.3" },
    seed: { type: "string", default: "7" },
    language: { type: "string" },
  },
});
const out = path.resolve(values.out!);
const language = values.language ?? (values.case === "videob" ? "en" : "fr");
const work = path.join(out, "work");
await mkdir(work, { recursive: true });
const t0 = Date.now();
const say = (s: string) => console.log(`${((Date.now() - t0) / 1000).toFixed(0).padStart(5)}s  ${s}`);

type Shot = EditPlan["segments"][number];
const planOf = (segments: Shot[]): EditPlan => ({
  summary: "", look: "natural", segments, captions: DEFAULT_CAPTIONS, on_screen_text: [], graphics: [], overlays: [], motion: [],
  music: { track: null, start: 0, volume: "low", sections: [] }, sfx: [], end_card: { include: false, headline: null, seconds: 0, transition: { type: "cut", seconds: 0 } }, open_questions: [],
});
const shot = (clip: string, start: number, end: number, purpose: string, extra: Partial<Shot> = {}): Shot => ({ ...PLAIN_SHOT, clip, start, end, purpose, ...extra });

// Clips transcribed as the engine does: Whisper's lines (with VAD) and the timing pass are
// kept, the words are placed on the sound on every run (so placement changes are quick to try).
async function clipsOf(files: { id: string; file: string }[], hint: string, language: string): Promise<Clip[]> {
  const clips: Clip[] = [];
  for (const { id, file } of files) {
    const p = await probe(file);
    const cache = path.join(work, `${id}.whisper.json`);
    let raw = await readFile(cache, "utf8").then((t) => JSON.parse(t) as { lines: TranscriptLine[]; timing: Word[] }).catch(() => null);
    if (!raw) {
      say(`transcribing ${id}`);
      const lines = (await transcribe(file, work, hint, { place: false })) ?? [];
      const wav = path.join(work, `${id}.16k.wav`);
      await run("ffmpeg", ["-v", "error", "-y", "-i", file, "-ac", "1", "-ar", "16000", wav]);
      raw = { lines, timing: config.whisperVadModel ? await whisperWords(wav, language, namesIn(hint)) : [] };
      await writeFile(cache, JSON.stringify(raw));
    }
    const map = await speechMap(file);
    const words = raw.lines.flatMap((l) => l.words ?? []);
    const starts = raw.timing.length ? carryTimes(words, raw.timing) : words.map((w) => w.start);
    const placed = placeWords(words.map((w, i) => ({ ...w, start: starts[i], end: starts[i] + (w.end - w.start) })), map, raw.timing.length ? DTW : STRIPPED);
    let k = 0;
    const transcript = raw.lines.map((l) => {
      const own = placed.slice(k, (k += (l.words ?? []).length)).map(({ start, end, text }) => ({ start, end, text }));
      return own.length ? { ...l, start: own[0].start, end: own.at(-1)!.end, words: own, placed: true } : l;
    });
    clips.push({ id, fileName: path.basename(file), file, preview: file, duration: p.duration, width: 1080, height: 1920, fps: 30, hasAudio: p.hasAudio, sheets: [], interval: 1, transcript });
  }
  return clips;
}

// ---------------------------------------------------------------- the team's edit points

// Normalized cross-correlation of `a` against `b` at lags [lo, hi] (samples): best lag, score.
function ncc(a: Float32Array, b: Float32Array, at: number, lo: number, hi: number) {
  let best = { lag: 0, score: -1 };
  let ma = 0;
  for (const v of a) ma += v;
  ma /= a.length;
  let ea = 0;
  for (const v of a) ea += (v - ma) ** 2;
  for (let lag = lo; lag <= hi; lag++) {
    const o = at + lag;
    if (o < 0 || o + a.length > b.length) continue;
    let mb = 0;
    for (let k = 0; k < a.length; k++) mb += b[o + k];
    mb /= a.length;
    let dot = 0;
    let eb = 0;
    for (let k = 0; k < a.length; k++) {
      const y = b[o + k] - mb;
      dot += (a[k] - ma) * y;
      eb += y * y;
    }
    const score = ea > 0 && eb > 0 ? dot / Math.sqrt(ea * eb) : 0;
    if (score > best.score) best = { lag, score };
  }
  return best;
}

// Where each moment of the final was cut from: every 0.1 s, the clip and offset whose voice
// envelope matches it best (100 Hz), confirmed on the waveform (8 kHz, ±20 ms). Runs of the
// same clip and offset are the team's shots; each boundary is placed at the 10 ms frame where
// the final stops matching one shot and starts matching the next.
async function teamEdits(final: string, clips: { id: string; file: string }[]) {
  const R = 8000;
  const fmap = await speechMap(final);
  const fwave = await pcmOf(final, R);
  const src = await Promise.all(clips.map(async (c) => ({ id: c.id, map: await speechMap(c.file), wave: await pcmOf(c.file, R) })));
  const W = 50;
  const rows: { t: number; clip: string; off: number; score: number }[] = [];
  for (let f = 0; f + W < fmap.voice.length; f += 10) {
    const win = fmap.voice.subarray(f, f + W);
    if (Math.max(...win) < SPEECH) continue;
    let best = { clip: "", off: 0, score: 0 };
    // Coarse: the envelope against every frame of every clip; the best few go on.
    const cands: { s: (typeof src)[number]; k: number; score: number }[] = [];
    for (const s of src) {
      for (let k = 0; k + W <= s.map.voice.length; k++) {
        const r = ncc(win, s.map.voice, k, 0, 0).score;
        if (r > 0.6) cands.push({ s, k, score: r });
      }
    }
    cands.sort((a, b) => b.score - a.score);
    // Fine: the waveform (the middle 0.25 s of the window), within 10 ms either way.
    const a = fwave.subarray(Math.round((f / 100 + 0.125) * R), Math.round((f / 100 + 0.375) * R));
    for (const c of cands.slice(0, 6)) {
      const fine = ncc(a, c.s.wave, Math.round((c.k / 100 + 0.125) * R), -80, 80);
      if (fine.score > best.score) best = { clip: c.s.id, off: f / 100 - (c.k / 100 + fine.lag / R), score: fine.score };
    }
    if (best.score >= 0.5) rows.push({ t: f / 100, ...best });
  }
  type Piece = { clip: string; off: number; t0: number; t1: number; n: number };
  const pieces: Piece[] = [];
  for (const r of rows) {
    const last = pieces.at(-1);
    if (last && last.clip === r.clip && Math.abs(last.off - r.off) < 0.015 && r.t - last.t1 < 0.35) [last.t1, last.n] = [r.t, last.n + 1];
    else pieces.push({ clip: r.clip, off: r.off, t0: r.t, t1: r.t, n: 1 });
  }
  // A silence inside a shot leaves no match: pieces of one clip at one offset are one shot.
  const shots: Piece[] = [];
  for (const p of pieces.filter((x) => x.n >= 3).map((x) => ({ ...x, t1: x.t1 + W / 100 }))) {
    const last = shots.at(-1);
    if (last && last.clip === p.clip && Math.abs(last.off - p.off) < 0.015 && p.t0 - last.t1 < 2.5) [last.t1, last.n] = [p.t1, last.n + p.n];
    else shots.push(p);
  }
  // The exact boundary between two shots that meet: where the final's waveform stops matching
  // the first and starts matching the second (20 ms windows).
  const sim = (clip: string, off: number, t: number) => {
    const s = src.find((x) => x.id === clip)!;
    const a = fwave.subarray(Math.round(t * R), Math.round((t + 0.02) * R));
    return ncc(a, s.wave, Math.round((t - off) * R), 0, 0).score;
  };
  // An edge with no shot against it: where the final starts (or stops) matching the shot,
  // 0.1 s at a time, to the frame.
  for (const sh of shots) {
    const matches = (t: number) => [0, 0.02, 0.04, 0.06, 0.08].reduce((m, d) => m + sim(sh.clip, sh.off, t + d), 0) / 5 > 0.5;
    let t = sh.t0 - 0.3;
    while (t < sh.t0 + 0.5 && !matches(t)) t += 0.01;
    sh.t0 = Math.min(t, sh.t0 + 0.5);
    t = sh.t1 + 0.3;
    while (t > sh.t1 - 0.5 && !matches(t - 0.1)) t -= 0.01;
    sh.t1 = Math.max(t, sh.t1 - 0.5);
  }
  for (let k = 1; k < shots.length; k++) {
    const [a, b] = [shots[k - 1], shots[k]];
    if (b.t0 - a.t1 > 0.6) continue;
    const lo = Math.min(a.t1, b.t0) - 0.3;
    const hi = Math.max(a.t1, b.t0) + 0.3;
    let best = { t: (a.t1 + b.t0) / 2, score: -Infinity };
    const frames: [number, number][] = [];
    for (let t = lo; t < hi; t += 0.01) frames.push([sim(a.clip, a.off, t), sim(b.clip, b.off, t)]);
    for (let e = 0; e <= frames.length; e++) {
      let score = 0;
      for (let j = 0; j < frames.length; j++) score += j < e ? frames[j][0] : frames[j][1];
      if (score > best.score) best = { t: lo + e * 0.01, score };
    }
    a.t1 = best.t;
    b.t0 = best.t;
  }
  return shots.map((s) => ({ clip: s.clip, start: Math.max(0, s.t0 - s.off), end: s.t1 - s.off, at: s.t0 }));
}

// ---------------------------------------------------------------- measuring a cut

type Measure = { shots: number; heard: number; lostStart: number; lostEnd: number; extraStart: number; extraEnd: number; inSound: number; edges: number; headAir: number; tailAir: number; details: string[] };

const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : NaN);

// The air at an edge from the sound itself: from an in point to the first frame of voice after
// it, and from the last frame of voice before an out point to it (0 when the cut is in sound).
function air(map: SpeechMap, t: number, side: "in" | "out") {
  const step = side === "in" ? 1 : -1;
  for (let d = 0; d < 300; d++) {
    const k = Math.round(t * 100) + step * d;
    if (k < 0 || k >= map.voice.length) return d / 100;
    if (map.level[k] >= SPEECH) return d / 100;
  }
  return 3;
}

// The opening and the ending of each stretch heard on their own (1.6 s each, padded with
// silence): with less of the line around it, Whisper can't fill in a clipped word from context.
async function measure(label: string, plan: EditPlan, clips: Clip[], sounds: Map<string, ClipSound>, expected: (run: ReturnType<typeof soundRuns>[number], k: number, side: "in" | "out") => string | null, language: string): Promise<Measure & { heardText: { in: string; out: string }[] }> {
  const runs = soundRuns(plan, sounds);
  const byId = new Map(clips.map((c) => [c.id, c]));
  const wavs: string[] = [];
  for (const [k, r] of runs.entries()) {
    const file = byId.get(r.clip)!.file;
    await snippet(file, r.start, Math.min(r.end, r.start + 1.6), path.join(work, `${label}-${k}-in.wav`));
    await snippet(file, Math.max(r.start, r.end - 1.6), r.end, path.join(work, `${label}-${k}-out.wav`));
    wavs.push(path.join(work, `${label}-${k}-in.wav`), path.join(work, `${label}-${k}-out.wav`));
  }
  const heard = await listen(wavs, language);
  // Franglais: a window that comes out far from its words is heard again in whatever language
  // Whisper finds (as the edit check does).
  const score = (want: string, t: string, side: "in" | "out") => {
    const h = compareWords(want, t);
    return side === "in" ? h.missingStart.length + h.extraStart.length : h.missingEnd.length + h.extraEnd.length;
  };
  const far = runs.flatMap((r, k) =>
    (["in", "out"] as const).flatMap((side, j) => {
      const want = expected(r, k, side);
      return want && score(want, heard[2 * k + j], side) > 1 ? [2 * k + j] : [];
    }),
  );
  if (far.length) {
    const again = await listen(far.map((i) => wavs[i]), "auto");
    far.forEach((i, j) => {
      const side = i % 2 ? "out" : "in";
      const want = expected(runs[(i - (i % 2)) / 2], (i - (i % 2)) / 2, side)!;
      if (score(want, again[j], side) < score(want, heard[i], side)) heard[i] = again[j];
    });
  }
  const m: Measure = { shots: runs.length, heard: 0, lostStart: 0, lostEnd: 0, extraStart: 0, extraEnd: 0, inSound: 0, edges: 0, headAir: 0, tailAir: 0, details: [] };
  const heads: number[] = [];
  const tails: number[] = [];
  const FILLER = /^(so|but|and|um|uh|yeah|oh|ah|euh|hum|bah|ben|et|mais|donc|alors|hmm|mm)$/;
  runs.forEach((r, k) => {
    const map = sounds.get(r.clip)!.map;
    for (const [t, side] of [[r.start, "in"], [r.end, "out"]] as const) {
      m.edges++;
      // In sound: the voice band at the cut itself (±10 ms) is at speech level.
      if (Math.max(levelAt(map, t - 0.01), levelAt(map, t), levelAt(map, t + 0.01)) >= SPEECH) m.inSound++;
      (side === "in" ? heads : tails).push(air(map, t, side));
    }
    const [hin, hout] = [heard[2 * k], heard[2 * k + 1]];
    const wantIn = expected(r, k, "in");
    const wantOut = expected(r, k, "out");
    if (wantIn === null || wantOut === null) return;
    m.heard++;
    const a = compareWords(wantIn, hin);
    const b = compareWords(wantOut, hout);
    const strays = a.extraStart.filter((w) => !FILLER.test(w));
    if (a.missingStart.length) m.lostStart++;
    if (b.missingEnd.length) m.lostEnd++;
    if (strays.length) m.extraStart++;
    if (b.extraEnd.length) m.extraEnd++;
    if (a.missingStart.length || strays.length) m.details.push(`${label} shot ${r.first + 1}${r.last > r.first ? `-${r.last + 1}` : ""} ${r.clip} in ${r.start.toFixed(2)}: heard "${hin}" for "${wantIn}"`);
    if (b.missingEnd.length || b.extraEnd.length) m.details.push(`${label} shot ${r.first + 1}${r.last > r.first ? `-${r.last + 1}` : ""} ${r.clip} out ${r.end.toFixed(2)}: heard "${hout}" for "${wantOut}"`);
  });
  m.headAir = median(heads);
  m.tailAir = median(tails);
  return { ...m, heardText: runs.map((_, k) => ({ in: heard[2 * k], out: heard[2 * k + 1] })) };
}

// Deterministic jitter.
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rows: { name: string; m: Measure }[] = [];

if (values.case === "episode") {
  const dir = path.resolve(values.dir!);
  const meta = JSON.parse(await readFile(path.join(dir, "clips.json"), "utf8")) as Clip[];
  const names = await readdir(dir);
  // The eval cache keeps each clip's sound as the 16 kHz wav it transcribed.
  const files = meta.flatMap((c) => {
    const wav = names.find((n) => n === `${path.basename(c.preview)}.speech.wav`);
    return wav && c.transcript?.length ? [{ id: c.id, file: path.join(dir, wav) }] : [];
  });
  const finalWav = (await readdir(path.join(dir, "reference"))).find((n) => n.endsWith(".speech.wav"))!;
  const clips = await clipsOf(files, "The Boyz: MI6, Joyboy, Ghost, Racine.", language);
  const edlFile = path.join(work, "team.json");
  let team = await readFile(edlFile, "utf8").then((t) => JSON.parse(t) as Awaited<ReturnType<typeof teamEdits>>).catch(() => null);
  if (!team) {
    say("finding the team's edit points in their final");
    team = await teamEdits(path.join(dir, "reference", finalWav), files);
    await writeFile(edlFile, JSON.stringify(team, null, 1));
  }
  say(`${team.length} shots in the team's final`);
  const base = team.map((s, i) => shot(s.clip, s.start, s.end, `team shot ${i + 1}`));
  const next = random(Number(values.seed));
  const J = Number(values.jitter);
  const jittered = base.map((s) => {
    const start = Math.max(0, s.start + (next() * 2 - 1) * J);
    const end = s.end + (next() * 2 - 1) * J;
    return { ...s, start, end: Math.max(start + 0.3, end) };
  });
  const sounds = await clipSounds(planOf(base), clips);
  // The words of each of the team's shots, as an editor's plan names them (`say`): the jitter
  // stands for drifting times, not for different words.
  const words = (s: Shot) => {
    const S = sounds.get(s.clip)?.sounds ?? [];
    return S.filter((w) => w.text && Math.min(w.end, s.end) - Math.max(w.start, s.start) >= 0.5 * (w.end - w.start)).map((w) => w.text).join(" ");
  };
  const named = jittered.map((s, i) => ({ ...s, say: words(base[i]) }));
  const teamNamed = base.map((s) => ({ ...s, say: words(s) }));
  const { plan: refined, notes } = refineEdits(planOf(jittered), clips, sounds);
  const withSay = refineEdits(planOf(named), clips, sounds);
  await writeFile(path.join(out, "episode-refine-notes.txt"), [...notes, "", "with words:", ...withSay.notes].join("\n"));
  // Each stretch should say the team shot's words (where the team's final fades or overlaps
  // sound at a cut, the matched edge can sit a little inside a word: the words are the point).
  const lines = (plan: EditPlan) => (r: ReturnType<typeof soundRuns>[number]) => plan.segments.slice(r.first, r.last + 1).map((s) => s.say).join(" ") || null;
  const said = (plan: EditPlan) => ({ ...plan, segments: plan.segments.map((s, i) => ({ ...s, say: named[i].say })) });
  rows.push({ name: "team", m: await measure("team", planOf(teamNamed), clips, sounds, lines(planOf(teamNamed)), language) });
  rows.push({ name: `jittered ±${J}s`, m: await measure("jit", planOf(named), clips, sounds, lines(planOf(named)), language) });
  rows.push({ name: "jittered, refined from the times", m: await measure("ref", said(refined), clips, sounds, lines(said(refined)), language) });
  rows.push({ name: "jittered, refined with the words", m: await measure("say", withSay.plan, clips, sounds, lines(withSay.plan), language) });
  const checked = await checkCut({ plan: withSay.plan, clips, sounds, workDir: path.join(work, "qc"), language });
  await writeFile(path.join(out, "episode-qc.txt"), [...checked.notes, "", "flags:", ...checked.flags].join("\n"));
  rows.push({ name: "... then checked by ear", m: await measure("checked", checked.plan, clips, sounds, lines(checked.plan), language) });
} else {
  const dir = path.resolve(values.dir!);
  const ids = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"];
  const clips = await clipsOf(ids.map((id) => ({ id, file: path.join(dir, "wav48", `${id}.wav`) })), "Mercedes-Benz dealership. GLE 53, valet, concierge, jacuzzi, 430 horsepower, 360 camera, Nihal.", language);
  type T = { name: string; say: string; clip: string; in: number; start: number; end: number; speed: number; hold: boolean; zoom: number };
  const v4 = JSON.parse(await readFile(path.join(dir, "v6", "timeline.json"), "utf8")).shots as T[];
  const v5 = (JSON.parse(await readFile(path.join(dir, "v7", "edl.json"), "utf8")).shots as { name: string; say?: string; a?: [string, number, number] | null }[]).filter((s) => s.a);
  const lineOf = (t: string) => t.replace(/ \/ /g, " ").replace(/\(clap\)/g, "").trim();
  const before = v4.filter((s) => s.say).map((s) => shot(s.clip, s.in, s.in + (s.end - s.start) * s.speed, s.name, { say: lineOf(s.say), zoom: { start: s.zoom, end: s.zoom } }));
  const hand = v5.map((s) => shot(s.a![0], s.a![1], s.a![2], s.name, { say: lineOf(s.say ?? "") }));
  const sounds = await clipSounds(planOf([...before, ...hand]), clips);
  const blind = refineEdits(planOf(before.map((s) => ({ ...s, say: "" }))), clips, sounds);
  const withSay = refineEdits(planOf(before), clips, sounds);
  await writeFile(path.join(out, "videob-refine-notes.txt"), [...blind.notes, "", "with say:", ...withSay.notes].join("\n"));
  // Each shot should say its line, as the edit list wrote it.
  const lines = (plan: EditPlan) => (r: ReturnType<typeof soundRuns>[number]) => plan.segments.slice(r.first, r.last + 1).map((s) => s.say).join(" ") || null;
  // Without the shot's words the pass works from the times alone; with them, as in a real edit.
  const blindPlan = { ...blind.plan, segments: blind.plan.segments.map((s, i) => ({ ...s, say: before[i].say })) };
  rows.push({ name: "v4 (sent back)", m: await measure("v4", planOf(before), clips, sounds, lines(planOf(before)), language) });
  rows.push({ name: "v4 refined, times only", m: await measure("blind", blindPlan, clips, sounds, lines(blindPlan), language) });
  rows.push({ name: "v4 refined, with words", m: await measure("say", withSay.plan, clips, sounds, lines(withSay.plan), language) });
  const checked = await checkCut({ plan: withSay.plan, clips, sounds, workDir: path.join(work, "qc"), language });
  await writeFile(path.join(out, "videob-qc.txt"), [...checked.notes, "", "flags:", ...checked.flags].join("\n"));
  rows.push({ name: "v4 refined, then checked by ear", m: await measure("checked", checked.plan, clips, sounds, lines(checked.plan), language) });
  rows.push({ name: "v5 (by hand)", m: await measure("v5", planOf(hand), clips, sounds, lines(planOf(hand)), language) });
}

const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : "–");
let md = `# Edit-point bench: ${values.case}${values.dir ? ` (${path.basename(values.dir)})` : ""}\n\n`;
md += "| | stretches heard | first word lost or clipped | last word lost or clipped | word or fragment before the first | word or fragment after the last | cuts in sound | air before first word (median s) | air after last word (median s) |\n|---|---|---|---|---|---|---|---|---|\n";
for (const { name, m } of rows) md += `| ${name} | ${m.heard} | ${m.lostStart} | ${m.lostEnd} | ${m.extraStart} | ${m.extraEnd} | ${m.inSound} of ${m.edges} | ${f2(m.headAir)} | ${f2(m.tailAir)} |\n`;
md += `\n${rows.flatMap((r) => r.m.details).map((d) => `- ${d}`).join("\n")}\n`;
await writeFile(path.join(out, `${values.case}.md`), md);
console.log(md);
say(`report: ${path.join(out, `${values.case}.md`)}`);
