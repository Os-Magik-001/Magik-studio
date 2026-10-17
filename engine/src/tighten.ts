// The trim pass: Claude places cuts from contact sheets and word timings, which
// leaves dead frames at the heads and tails of shots. This pass measures the real
// speech in each shot and tightens it, the way an editor trims on the timeline:
//   - heads and tails trimmed to a few frames around the first and last word,
//   - a stuttered or repeated first word dropped ("Comment? Comment?"),
//   - long pauses inside a shot cut out, hidden by a punch-in on the second half,
// then every title, graphic, motion item and sound effect is moved to stay in sync.

import { shotLength, timelineOf, type Clip, type EditPlan } from "./plan.ts";

type Shot = EditPlan["segments"][number];
type Word = { start: number; end: number; text: string };

// Frames kept around speech: a touch before the first word, a breath after the last.
export const HEAD = 0.08;
export const TAIL = 0.14;
// Silence at a head or tail worth removing, and a pause inside a shot worth cutting out.
const DEAD = 0.12;
const PAUSE = 0.45;
// Shots whose point is the silence (reactions, glances, beats) are left alone.
const KEEP_SILENCE = /react|glance|look|stare|deadpan|beat|pause|silent|silence|freeze|hold|b-roll|broll|cutaway|insert|establish|intro clip|logo|title|walk|entrance|ending|end card|tag/i;

const bare = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

export type TightenResult = { plan: EditPlan; removed: number; notes: string[] };

export function tighten(plan: EditPlan, clips: Clip[]): TightenResult {
  const byId = new Map(clips.map((c) => [c.id, c]));
  const notes: string[] = [];
  const out: Shot[] = [];
  // For the remap: each new shot remembers which old shot (and source range) it came from.
  const origin: { old: number; srcStart: number }[] = [];

  plan.segments.forEach((seg, i) => {
    const clip = byId.get(seg.clip);
    const words: Word[] =
      seg.audio === "keep" && seg.hold === 0
        ? (clip?.transcript ?? []).flatMap((l) => l.words ?? []).filter((w) => w.end > seg.start + 0.02 && w.start < seg.end - 0.02)
        : [];
    if (!words.length || KEEP_SILENCE.test(seg.purpose)) {
      out.push(seg);
      origin.push({ old: i, srcStart: seg.start });
      return;
    }

    let first = 0;
    // A repeated first word is a stutter or a retake's first try: start on the second.
    if (words.length > 1 && bare(words[0].text) && bare(words[0].text) === bare(words[1].text)) {
      first = 1;
      notes.push(`shot ${i + 1}: dropped the repeated "${words[0].text}"`);
    }
    const prev = out.at(-1);
    const prevClip = prev && byId.get(prev.clip);
    // The same word ending the previous shot and starting this one is said twice.
    if (prev && prevClip && prev.hold === 0 && words[first]) {
      const prevWords = (prevClip.transcript ?? []).flatMap((l) => l.words ?? []).filter((w) => w.start < prev.end && w.end > prev.start);
      const last = prevWords.at(-1);
      if (last && bare(last.text) && bare(last.text) === bare(words[first].text) && words.length > first + 1) {
        first++;
        notes.push(`shot ${i + 1}: "${last.text}" was said twice across the cut`);
      }
    }

    const head = Math.max(seg.start, words[first].start - HEAD);
    const tail = Math.min(seg.end, words.at(-1)!.end + TAIL);
    let start = head - seg.start > DEAD ? head : seg.start;
    const end = seg.end - tail > DEAD ? tail : seg.end;
    if (start === seg.start && first > 0) start = Math.max(seg.start, words[first].start - HEAD);

    // Split on long pauses inside the shot; the second part punches in to hide the jump.
    const pieces: { start: number; end: number }[] = [];
    let pieceStart = start;
    for (let k = first + 1; k < words.length; k++) {
      const gap = words[k].start - words[k - 1].end;
      if (gap > PAUSE && words[k - 1].end + TAIL > pieceStart + 0.3 && words[k].start - HEAD < end - 0.3) {
        pieces.push({ start: pieceStart, end: words[k - 1].end + TAIL });
        pieceStart = words[k].start - HEAD;
        notes.push(`shot ${i + 1}: cut a ${gap.toFixed(1)}s pause`);
      }
    }
    pieces.push({ start: pieceStart, end });

    pieces.forEach((p, k) => {
      if (p.end - p.start < 0.25) return;
      const punch = k % 2 === 1;
      const zoom = punch ? Math.min(seg.zoom.start + 0.14, 2.5) : seg.zoom.start;
      out.push({
        ...seg,
        start: round(p.start),
        end: round(p.end),
        zoom: punch ? { start: zoom, end: zoom } : seg.zoom,
        transition_in: k === 0 ? seg.transition_in : { type: "cut", seconds: 0 },
        purpose: k === 0 ? seg.purpose : `${seg.purpose} (after a cut pause)`,
      });
      origin.push({ old: i, srcStart: p.start });
    });
  });

  const tightened: EditPlan = { ...plan, segments: out };
  const before = timelineOf(plan);
  const after = timelineOf(tightened);
  const removed = Math.round((before.length - after.length) * 100) / 100;
  if (removed < 0.05) return { plan, removed: 0, notes: [] };

  // Old timeline time -> new timeline time, through the source position in the clip.
  const remap = (t: number) => {
    const k = before.shots.findIndex((s) => t >= s.start && t < s.end);
    if (k < 0) return t >= before.length ? after.length - (before.length - t) : t;
    const old = before.shots[k];
    const src = old.seg.hold > 0 ? old.seg.start : old.seg.start + (t - old.start) * old.seg.speed;
    // The new shot from the same old shot whose source range holds that moment (or the nearest).
    const candidates = after.shots.filter((s, n) => origin[n].old === k);
    if (!candidates.length) return after.shots.find((_, n) => origin[n].old > k)?.start ?? after.length;
    const hit = candidates.find((s) => src >= s.seg.start && src <= s.seg.end) ?? (src < candidates[0].seg.start ? candidates[0] : candidates.at(-1)!);
    if (old.seg.hold > 0) return hit.start + (t - old.start);
    const into = Math.min(Math.max(0, src - hit.seg.start), hit.seg.end - hit.seg.start) / hit.seg.speed;
    return hit.start + into;
  };
  const span = <T extends { start: number; end: number }>(x: T): T => {
    const s = round(remap(x.start));
    const e = round(Math.max(remap(x.end), s + 0.2));
    return { ...x, start: s, end: e };
  };
  tightened.on_screen_text = plan.on_screen_text.map(span);
  tightened.graphics = plan.graphics.map(span);
  tightened.motion = plan.motion.map(span);
  tightened.overlays = plan.overlays.map((o) => ({ ...o, at: round(remap(o.at)) }));
  tightened.sfx = plan.sfx.map((x) => ({ ...x, at: round(remap(x.at)) }));
  tightened.music = { ...plan.music, sections: (plan.music.sections ?? []).map(span) };
  // Graphics that span the whole video (progress bars, follow pills to the end) keep reaching the end.
  tightened.graphics = tightened.graphics.map((g, n) => (plan.graphics[n].end >= before.length - 0.05 ? { ...g, end: round(after.length) } : g));
  tightened.on_screen_text = tightened.on_screen_text.map((x, n) => (plan.on_screen_text[n].end >= before.length - 0.05 ? { ...x, end: round(after.length) } : x));
  return { plan: tightened, removed, notes };
}

const round = (n: number) => Math.round(n * 100) / 100;

// How long the cut would be with every shot at its own length (for logs and tests).
export const totalLength = (plan: EditPlan) => plan.segments.reduce((a, s) => a + shotLength(s), 0);

// Full-frame motion templates belong on a freeze: lock each one onto the nearest hold
// shot, so neither Claude's arithmetic nor the trim pass can leave it half off.
const FULL_FRAME = new Set(["character_intro", "cast_lineup"]);
export function anchorMotion(plan: EditPlan): EditPlan {
  const holds = timelineOf(plan).shots.filter((s) => s.seg.hold > 0);
  const used = new Set<number>();
  const motion = plan.motion.map((m) => {
    if (!FULL_FRAME.has(m.template) || !holds.length) return m;
    const mid = (m.start + m.end) / 2;
    // Closest in time and in length: an end lineup goes on the end freeze, not a short comic one.
    const cost = (h: (typeof holds)[number]) => Math.abs((h.start + h.end) / 2 - mid) + Math.abs(h.end - h.start - (m.end - m.start));
    let best = -1;
    holds.forEach((h, i) => {
      if (used.has(i) || Math.abs((h.start + h.end) / 2 - mid) > 2.5) return;
      if (best < 0 || cost(h) < cost(holds[best])) best = i;
    });
    if (best < 0) return m;
    used.add(best);
    return { ...m, start: round(holds[best].start), end: round(holds[best].end) };
  });
  // A freeze has no speech: when the music plays in sections, it plays under the freezes too.
  const music = plan.music;
  if (!music.track || !music.sections?.length) return { ...plan, motion };
  const sections = [...music.sections];
  for (const m of motion.filter((x) => FULL_FRAME.has(x.template))) {
    const covered = sections.some((sec) => sec.start <= m.start + 0.05 && sec.end >= m.end - 0.05);
    if (!covered) sections.push({ start: round(Math.max(0, m.start - 0.15)), end: round(m.end + 0.1), volume: "medium" });
  }
  sections.sort((a, b) => a.start - b.start);
  // Overlapping sections merge into one.
  const merged: typeof sections = [];
  for (const sec of sections) {
    const last = merged.at(-1);
    if (last && sec.start <= last.end) last.end = Math.max(last.end, sec.end);
    else merged.push({ ...sec });
  }
  return { ...plan, motion, music: { ...music, sections: merged } };
}
