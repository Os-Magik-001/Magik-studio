// The edit pass: every cut with sound goes where a dialogue editor would put it. Claude
// chooses the words of each shot and the transcript times them, but those times drift,
// and a client sent a video back for nine clipped words ("car", "horsepower", "jacuzzi",
// the end of "services") and a "yo-" left from the next line. So every in and out point is
// placed again from the sound itself (speech.ts, with the words placed on it, words.ts):
//   - in a real gap between words, never inside one: a word mostly inside the shot is kept
//     whole, a fragment of one mostly outside is left out,
//   - ~0.1 s before the first word and 0.2-0.35 s after the last, or in the middle of a gap
//     too short for that (a punchline keeps its beat, a reaction its silence),
//   - at the quietest moment near there, so a breath or a word's decay isn't cut through,
//   - shots that carry on the same take meet at one source time, so nothing plays twice
//     ("Nor-Normally") and the join is sample-exact, and a punch-in there changes size by
//     0.3 or more (smaller ones read as glitches),
//   - every shot lasts a whole number of frames, so its picture and sound end together,
// then every title, graphic and sound effect moves with its moment. Each change is logged.

import { config } from "./config.ts";
import { findRun, FPS, type Clip, type EditPlan } from "./plan.ts";
import { frameOf, islands, levelAt, QUIET, quietest, SPEECH, speechMap, timeOf, type SpeechMap } from "./speech.ts";
import { followCut, KEEP_SILENCE } from "./tighten.ts";
import { DTW, norm, placeWords, STRIPPED, type Placed } from "./words.ts";

type Shot = EditPlan["segments"][number];

// Air around the words of a shot, in seconds of the finished video.
export const HEAD = 0.1;
export const TAIL = 0.25;
export const TAIL_MIN = 0.2;
export const TAIL_MAX = 0.35;
// A punchline keeps up to this much beat before it and hold after it.
const PUNCH_AIR = 0.6;
// How close a cut comes to a neighbouring word when the gap allows it.
const GUARD = 0.04;
// Shots of one clip that meet, or overlap by up to this much, carry on the same take.
const SAME_TAKE = 0.6;
// A punch-in that changes the size by less reads as a glitch.
export const PUNCH = 0.3;

// A word, or a sound no word was written for (a laugh, a breath, someone off-screen).
export type Sound = { start: number; end: number; text: string | null };
export type ClipSound = { map: SpeechMap; sounds: Sound[] };

// One edge of a shot as the pass left it: where it was and is (source seconds), the air
// between it and the shot's first or last word, and whether it sits in a real gap.
export type Edge = { shot: number; side: "in" | "out"; from: number; to: number; air: number | null; word: string | null; quiet: boolean };

// A sound no word was written for counts when it is loud enough to be a voice or a laugh;
// a softer one (a breath, the room) can be cut through, at its quietest.
const LOUD_SOUND = 20;

export function soundsOf(map: SpeechMap, words: (Placed | { start: number; end: number; text: string })[]): Sound[] {
  const out: Sound[] = words.map((w) => ({ start: w.start, end: w.end, text: w.text }));
  for (const x of islands(map)) {
    if (x.end - x.start >= 0.08 && x.peak >= LOUD_SOUND && !words.some((w) => w.end > x.start && w.start < x.end)) out.push({ start: x.start, end: x.end, text: null });
  }
  return out.sort((a, b) => a.start - b.start);
}

// The sound of every clip a shot keeps the sound of: its speech map and its words. A
// transcript made before words were placed on the sound is placed here.
export async function clipSounds(plan: EditPlan, clips: Clip[]): Promise<Map<string, ClipSound>> {
  const used = new Set(plan.segments.filter((s) => s.audio === "keep" && s.hold === 0).map((s) => s.clip));
  const out = new Map<string, ClipSound>();
  for (const clip of clips) {
    if (!used.has(clip.id) || !clip.hasAudio) continue;
    const map = await speechMap(clip.preview);
    const lines = clip.transcript ?? [];
    const words = lines.flatMap((l) => l.words ?? []);
    const placed = lines.every((l) => l.placed || !l.words?.length) ? words : placeWords(words, map, config.whisperVadModel ? STRIPPED : DTW);
    out.set(clip.id, { map, sounds: soundsOf(map, placed) });
  }
  return out;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), Math.max(lo, hi));
const overlap = (s: Sound, a: number, b: number) => Math.max(0, Math.min(s.end, b) - Math.max(s.start, a));
const quoted = (s: Sound | undefined) => (s?.text ? `"${s.text.replace(/[,.!?;:]+$/, "")}"` : "a sound");
// The sound a cut at t would go through (more than 20 ms of it on either side).
const inside = (S: Sound[], t: number) => S.find((s) => s.start + 0.02 < t && s.end - 0.02 > t);

// The sounds a shot keeps: the words of its `say` when they are where the shot is, else
// every sound mostly inside it.
export function keptSounds(seg: Shot, S: Sound[], piece = false): [number, number] | null {
  const words = S.flatMap((s, k) => (s.text ? [{ ...s, text: s.text, k }] : []));
  if (seg.say?.trim() && !piece) {
    const run = findRun(seg.say, words, seg.start);
    // The quoted words, where the shot is: inside its range give or take 0.6 s (a shot may
    // open on a pause, and the trim pass's pieces each hold only part of the quote).
    if (run && words[run.from].start >= seg.start - 0.6 && words[run.to].end <= seg.end + 0.6) return [words[run.from].k, words[run.to].k];
  }
  let from = -1;
  let to = -1;
  S.forEach((s, k) => {
    if (overlap(s, seg.start, seg.end) >= 0.5 * Math.max(0.01, s.end - s.start)) {
      if (from < 0) from = k;
      to = k;
    }
  });
  return from < 0 ? null : [from, to];
}

// Whether t sits in a dip between two syllables (6 dB under the sound on both sides within
// 80 ms): where words that run together meet.
function inDip(map: SpeechMap, t: number) {
  const k = frameOf(t);
  const v = levelAt(map, t);
  let before = -Infinity;
  let after = -Infinity;
  for (let j = Math.max(0, k - 8); j < k; j++) before = Math.max(before, map.level[j]);
  for (let j = k + 1; j <= Math.min(map.level.length - 1, k + 8); j++) after = Math.max(after, map.level[j]);
  return before - v >= 6 && after - v >= 6;
}

// A cut inside a run of sound, a little way from its edge, goes outside the run, whatever the
// word times say: just after a run starts is a word's onset, the last 0.35 s of one is a
// word's last syllable or its decay ("horsepower", "I do" were heard clipped there). A cut in
// a dip between syllables stays (words that run together meet there), and so does one with
// the next word (or the one before) placed inside the rest of the run.
function outOfSound(map: SpeechMap, t: number, side: "in" | "out", neighbour: Sound | undefined, air: number) {
  if (levelAt(map, t) < QUIET || inDip(map, t)) return t;
  const L = map.level;
  let a = frameOf(t);
  while (a > 0 && L[a - 1] >= QUIET) a--;
  let b = frameOf(t);
  while (b < L.length && L[b] >= QUIET) b++;
  const [start, end] = [timeOf(a), timeOf(b)];
  if (side === "out" && end - t <= 0.35 && !(neighbour && neighbour.start > t - 0.02 && neighbour.start < end)) {
    let next = b;
    while (next < L.length && L[next] < SPEECH) next++;
    const room = timeOf(next) - end;
    return quietest(map, end + Math.min(0.02, room / 2), end + Math.min(air, room / 2), end + Math.min(air, room / 2));
  }
  if (side === "in" && t - start <= 0.15 && !(neighbour && neighbour.end < t + 0.02 && neighbour.end > start)) {
    let prev = a - 1;
    while (prev > 0 && L[prev] < SPEECH) prev--;
    const room = start - timeOf(prev + 1);
    return quietest(map, start - Math.min(air, room / 2), start - Math.min(0.02, room / 2), start - Math.min(air, room / 2));
  }
  return t;
}

// The boundary between two sounds nearest t, within [lo, hi]: the quietest moment of the gap
// between them, or the moment they meet when the voice runs on.
function boundaryNear(S: Sound[], map: SpeechMap, t: number, lo: number, hi: number) {
  const points: number[] = [];
  for (let k = 0; k + 1 < S.length; k++) {
    const [a, b] = [S[k].end, S[k + 1].start];
    if (b < lo || a > hi) continue;
    const [from, to] = [Math.max(lo, Math.min(a, b)), Math.min(hi, Math.max(a, b))];
    points.push(to - from > 0.02 ? quietest(map, from, to, clamp(t, from, to)) : clamp(b, lo, hi));
  }
  return points.length ? points.reduce((x, y) => (Math.abs(y - t) < Math.abs(x - t) ? y : x)) : null;
}

export type RefineResult = { plan: EditPlan; notes: string[]; edges: Edge[] };

export function refineEdits(plan: EditPlan, clips: Clip[], sounds: Map<string, ClipSound>): RefineResult {
  const byId = new Map(clips.map((c) => [c.id, c]));
  const segs: Shot[] = plan.segments.map((s) => ({ ...s }));
  const notes: string[] = [];
  const edges: Edge[] = [];
  const n = segs.length;
  const sound = (s: Shot) => (s.audio === "keep" && s.hold === 0 ? sounds.get(s.clip) : undefined);
  const name = (i: number) => `shot ${i + 1}`;
  const at = (t: number) => `${t.toFixed(2)}s`;

  // Pieces of one planned shot (the trim pass cut a pause out of it) share its `say`.
  const piece = (i: number) => {
    const s = segs[i];
    const same = (j: number) => j >= 0 && j < n && segs[j].clip === s.clip && !!s.say?.trim() && segs[j].say === s.say;
    return same(i - 1) || same(i + 1);
  };

  // 1. Shots that carry on the same take meet at one source time, in a gap between words
  // when there is one close by: the sound runs on untouched, only the picture changes.
  const joined = segs.map(() => false);
  for (let i = 1; i < n; i++) {
    const [a, b] = [segs[i - 1], segs[i]];
    if (a.clip !== b.clip || a.hold > 0 || b.hold > 0 || a.speed !== b.speed || a.audio !== b.audio || b.transition_in.type !== "cut") continue;
    let d = b.start - a.end;
    // A pause cut out of a line must not take words with it (a cut once dropped the
    // middle of "built in Mercedes-Benz"): the line plays through instead.
    const cs = sound(a);
    if (d > 0.04 && piece(i) && cs) {
      const lost = cs.sounds.filter((s) => s.text && overlap(s, a.end, b.start) >= 0.5 * (s.end - s.start));
      if (lost.length) {
        notes.push(`${name(i)}: kept ${lost.map((s) => quoted(s)).join(" ")}, which the pause cut before it had dropped`);
        d = 0;
        b.start = a.end;
      }
    }
    if (d > 0.04 || d < -SAME_TAKE) continue;
    joined[i] = true;
    const lo = Math.min(a.end, b.start);
    const hi = Math.max(a.end, b.start);
    let J = a.end;
    if (cs) {
      const S = cs.sounds;
      // Where the two shots overlapped, the sound in between would have played twice.
      const twice = d < -0.02 ? S.filter((s) => s.text && overlap(s, lo, hi) > 0.02) : [];
      const room = [a.start + 0.3, b.end - 0.3] as const;
      const free = (t: number) => !inside(S, t);
      // An overlap meets inside the stretch both shots had, at a word boundary if it holds
      // one; a join inside a word moves to that word's nearer boundary.
      if (hi - lo > 0.02) J = boundaryNear(S, cs.map, (lo + hi) / 2, lo, hi) ?? boundaryNear(S, cs.map, (lo + hi) / 2, clamp(lo - 0.25, ...room), clamp(hi + 0.25, ...room)) ?? hi;
      else if (!free(J)) J = boundaryNear(S, cs.map, J, clamp(J - 0.25, ...room), clamp(J + 0.25, ...room)) ?? J;
      if (d < -0.02) notes.push(`${name(i - 1)}-${i + 1}: one take, now meeting at ${at(J)} (they overlapped by ${(-d).toFixed(2)}s${twice.length ? `: ${twice.map((s) => quoted(s)).join(" ")} played twice` : ""})`);
      else if (Math.abs(J - a.end) > 0.005) notes.push(`${name(i - 1)}-${i + 1}: one take, the picture now changes at ${at(J)}, between words`);
    } else if (d < -0.02) notes.push(`${name(i - 1)}-${i + 1}: one take, now meeting at ${at(J)} (they overlapped by ${(-d).toFixed(2)}s)`);
    a.end = J;
    b.start = J;
  }

  // 2. Every other edge with sound, placed from the words and the gaps around them.
  const kept = segs.map((s, i) => {
    const cs = sound(s);
    return cs ? keptSounds(s, cs.sounds, piece(i)) : null;
  });
  // A word said at the end of one shot and again at the start of the next is said twice.
  for (let i = 1; i < n; i++) {
    const [ka, kb] = [kept[i - 1], kept[i]];
    const [ca, cb] = [sound(segs[i - 1]), sound(segs[i])];
    if (joined[i] || !ka || !kb || !ca || !cb || kb[0] >= kb[1]) continue;
    const [wa, wb] = [ca.sounds[ka[1]], cb.sounds[kb[0]]];
    if (wa.text && wb.text && norm(wa.text).length > 1 && norm(wa.text) === norm(wb.text) && (segs[i - 1].clip !== segs[i].clip || Math.abs(wa.start - wb.start) > 0.05)) {
      kb[0] = cb.sounds.findIndex((s, k) => k > kb[0] && !!s.text);
      if (kb[0] < 0 || kb[0] > kb[1]) kb[0] = kb[1];
      notes.push(`${name(i)}: ${quoted(wb)} was said twice across the cut, so the shot starts on ${quoted(cb.sounds[kb[0]])}`);
    }
  }

  segs.forEach((seg, i) => {
    const cs = sound(seg);
    if (!cs) return;
    const { map, sounds: S } = cs;
    const duration = byId.get(seg.clip)?.duration ?? map.duration;
    const sp = seg.speed;
    const silent = seg.beat === "reaction" || KEEP_SILENCE.test(seg.purpose);
    const punch = seg.beat === "punchline";
    const k = kept[i];

    if (!joined[i]) {
      const from = seg.start;
      let to = from;
      let first: Sound | undefined;
      let note = "";
      if (k) {
        first = S[k[0]];
        const prevEnd = k[0] > 0 ? S[k[0] - 1].end : 0;
        const gap = first.start - prevEnd;
        const planned = first.start - from;
        const lo = prevEnd + Math.min(GUARD, gap / 2);
        const hi = first.start - Math.min(0.05, gap / 2);
        if (silent && from >= lo && from <= hi) to = from;
        else {
          const wanted = silent ? Math.max(planned, HEAD * sp) : punch ? clamp(planned, HEAD * sp, PUNCH_AIR * sp) : HEAD * sp;
          // At the quietest moment near there, but no nearer the word: the air is the point.
          const target = clamp(first.start - Math.min(wanted, gap / 2), lo, hi);
          to = quietest(map, Math.max(lo, target - 0.05), Math.min(hi, target + 0.01), target);
        }
        const sure = outOfSound(map, to, "in", S[k[0] - 1], HEAD * sp);
        const cut = inside(S, from);
        note =
          Math.abs(sure - to) > 0.005 ? "the first word's sound starts before its time"
          : cut === first ? `${quoted(first)} was clipped`
          : cut ? `cut inside ${quoted(cut)}`
          : from < prevEnd ? `${quoted(S[k[0] - 1])} came before the first word`
          : "";
        to = sure;
        if (gap < 0.03) note += `${note ? "; " : ""}no gap before ${quoted(first)}: cut where the words meet`;
      } else {
        // Nothing kept: only keep the edge out of any sound it would cut through.
        const cut = inside(S, from);
        if (cut) [to, note] = [Math.min(cut.end + 0.02, seg.end - 0.3), `cut inside ${quoted(cut)}, left out`];
      }
      to = Math.max(0, to);
      seg.start = to;
      edges.push({ shot: i, side: "in", from, to, air: first ? (first.start - to) / sp : null, word: first?.text ?? null, quiet: levelAt(map, to) < QUIET });
      if (Math.abs(to - from) >= 0.02) notes.push(`${name(i)} in: ${at(from)} -> ${at(to)}${note ? ` (${note})` : ""}`);
    }

    if (!joined[i + 1]) {
      const from = seg.end;
      let to = from;
      let last: Sound | undefined;
      let note = "";
      if (k) {
        last = S[k[1]];
        const nextStart = k[1] + 1 < S.length ? S[k[1] + 1].start : duration;
        const gap = nextStart - last.end;
        const planned = from - last.end;
        const lo = last.end + Math.min(0.05, gap / 2);
        const hi = nextStart - Math.min(GUARD, gap / 2);
        if (silent && from >= lo && from <= hi) to = from;
        else {
          const wanted = silent ? Math.max(planned, TAIL * sp) : punch ? clamp(planned, 0.3 * sp, PUNCH_AIR * sp) : planned < TAIL_MIN * sp ? TAIL * sp : Math.min(planned, TAIL_MAX * sp);
          const target = clamp(last.end + Math.min(wanted, gap / 2), lo, hi);
          to = quietest(map, Math.max(lo, target - 0.01), Math.min(hi, target + 0.05), target);
        }
        const sure = outOfSound(map, to, "out", S[k[1] + 1], TAIL * sp);
        const cut = inside(S, from);
        note =
          Math.abs(sure - to) > 0.005 ? "the last word's sound runs on past its time"
          : cut === last ? `${quoted(last)} was clipped`
          : cut ? `cut inside ${quoted(cut)}`
          : from > nextStart ? `${quoted(S[k[1] + 1])} came after the last word`
          : "";
        to = sure;
        if (gap < 0.03) note += `${note ? "; " : ""}no gap after ${quoted(last)}: cut where the words meet`;
      } else {
        const cut = inside(S, from);
        if (cut) [to, note] = [Math.max(cut.start - 0.02, seg.start + 0.3), `cut inside ${quoted(cut)}, left out`];
      }
      to = Math.min(duration, to);
      seg.end = to;
      edges.push({ shot: i, side: "out", from, to, air: last ? (to - last.end) / sp : null, word: last?.text ?? null, quiet: levelAt(map, to) < QUIET });
      if (Math.abs(to - from) >= 0.02) notes.push(`${name(i)} out: ${at(from)} -> ${at(to)}${note ? ` (${note})` : ""}`);
    }
  });

  // 3. A punch-in within one take (where it carries on, or jumps a pause) changes the size by
  // PUNCH or more.
  for (let i = 1; i < n; i++) {
    const [a, b] = [segs[i - 1], segs[i]];
    const oneTake = joined[i] || (a.clip === b.clip && a.hold === 0 && b.hold === 0 && b.transition_in.type === "cut" && Math.abs(b.start - a.end) < 1.5);
    if (!oneTake || a.zoom.start !== a.zoom.end || b.zoom.start !== b.zoom.end) continue;
    const dz = b.zoom.start - a.zoom.start;
    if (Math.abs(dz) < 0.01 || Math.abs(dz) >= PUNCH - 1e-9) continue;
    const top = b.zoom.start > 1.4 || a.zoom.start > 1.4 ? 2.5 : 1.4;
    const up = Math.round((a.zoom.start + PUNCH) * 100) / 100;
    const down = Math.round((a.zoom.start - PUNCH) * 100) / 100;
    const z = dz > 0 ? (up <= top ? up : down >= 1 ? down : null) : down >= 1 ? down : up <= top ? up : null;
    if (z === null) continue;
    notes.push(`${name(i)}: punch-in ${a.zoom.start} -> ${b.zoom.start} read as a glitch, now ${z}`);
    b.zoom = { start: z, end: z };
  }

  // 4. Every shot a whole number of frames long, the out point moving by under half a
  // frame (to the side that stays out of the words); one take's next shot follows it. Shots
  // start on a whole sample of the edit's 48 kHz sound, so a take that carries on meets
  // itself on one sample.
  for (let i = 0; i < n; i++) {
    const seg = segs[i];
    if (seg.hold > 0) continue;
    if (!joined[i]) seg.start = Math.round(seg.start * 48000) / 48000;
    const S = sound(seg)?.sounds ?? [];
    const frames = (seg.end - seg.start) / seg.speed * FPS;
    const options = [Math.round(frames), Math.floor(frames), Math.ceil(frames)].map((f) => Math.max(1, f));
    const end = options.map((f) => seg.start + (f * seg.speed) / FPS).find((t) => joined[i + 1] || !inside(S, t)) ?? seg.start + (options[0] * seg.speed) / FPS;
    seg.end = end;
    if (joined[i + 1]) segs[i + 1].start = end;
  }
  edges.forEach((e) => {
    if (e.side === "out") {
      const t = segs[e.shot].end;
      if (e.air !== null) e.air += (t - e.to) / segs[e.shot].speed;
      e.to = t;
    }
  });

  const refined = followCut(plan, { ...plan, segments: segs }, segs.map((_, i) => i));
  return { plan: refined, notes, edges };
}
