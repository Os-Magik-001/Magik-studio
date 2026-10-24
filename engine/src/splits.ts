// Split edits: professional dialogue editing rarely cuts picture and sound at the same
// instant. The sound edit stays where the plan put it (it follows the words); the
// picture cut moves a few frames:
//   - L-cut onto a reaction: the picture goes to the listener while the line finishes,
//     so the reaction lands on the words (Dmytryk: the listener grasps the meaning
//     before the sentence ends).
//   - J-cut into a new speaker: their voice starts a few frames before we see them.
//   - Never off a punchline: the picture stays on the speaker until the last syllable.
// Only between two moving shots joined by a hard cut, and never inside one take (a
// jump cut in the same framing reads as a glitch if picture and sound slip; a take that
// carries on has no sound edit at all).
// The offsets are measured from the words, not from the sound edit: the sound edit sits
// 0.1 s before a shot's first word and 0.2-0.35 s after its last, so a picture cut a fixed
// few frames from it landed in the silence (frames late for no reason) instead of on the
// line. Each shift is a whole number of frames, and the picture never needs more source
// than the clip has.

import { FPS, sameTake, timelineOf, type Clip, type EditPlan } from "./plan.ts";

type Shot = EditPlan["segments"][number];
const frames = (n: number) => n / FPS;

// Frames the picture cut moves: onto the listener L_CUT frames before the line ends; onto
// the new speaker J_CUT frames after their voice starts.
export const L_CUT = 6;
export const J_CUT = 4;

const wordsIn = (seg: Shot, clip: Clip | undefined) =>
  seg.audio === "keep" && seg.hold === 0
    ? (clip?.transcript ?? []).flatMap((l) => l.words ?? []).filter((w) => w.end > seg.start + 0.02 && w.start < seg.end - 0.02)
    : [];

// For each shot, how far (in timeline seconds) its picture starts before (-) or after (+)
// its sound; the previous shot's picture ends by the same amount, so lengths match.
export function pictureShifts(plan: EditPlan, clips: Clip[]): number[] {
  const byId = new Map(clips.map((c) => [c.id, c]));
  const shifts = plan.segments.map(() => 0);
  for (let i = 1; i < plan.segments.length; i++) {
    const a = plan.segments[i - 1];
    const b = plan.segments[i];
    if (b.transition_in.type !== "cut" || a.hold > 0 || b.hold > 0 || sameTake(a, b)) continue;
    // Same take, same framing: a jump cut, kept straight.
    if (a.clip === b.clip && Math.abs(a.zoom.start - b.zoom.start) < 0.05 && Math.abs(b.start - a.end) < 1.5) continue;
    const aWords = wordsIn(a, byId.get(a.clip));
    const bWords = wordsIn(b, byId.get(b.clip));
    // The air between the sound edit and the words, on the timeline.
    const tail = aWords.length ? (a.end - aWords.at(-1)!.end) / a.speed : Infinity;
    const head = bWords.length ? (bWords[0].start - b.start) / b.speed : Infinity;
    const aSpeaksToEnd = tail < 0.45;
    const bOpensWithWords = head < 0.3;
    const bSilentStart = head > 0.6;

    let shift = 0;
    if (a.beat !== "punchline" && aSpeaksToEnd && (b.beat === "reaction" || bSilentStart)) {
      // L-cut: see the listener during the last words of the line.
      shift = -(tail + frames(L_CUT));
    } else if (bOpensWithWords && a.beat !== "punchline" && b.beat !== "reaction") {
      // J-cut: hear the new speaker just before seeing them.
      shift = head + frames(J_CUT);
    }
    // The picture can't eat more than a third of either shot, and can only reach as far as
    // the source goes: before b's start for an L-cut, after a's end for a J-cut.
    const lenA = (a.end - a.start) / a.speed;
    const lenB = (b.end - b.start) / b.speed;
    const limit = Math.min(lenA, lenB) / 3;
    if (shift < 0) shift = -Math.min(-shift, limit, b.start / b.speed);
    if (shift > 0) shift = Math.min(shift, limit, Math.max(0, ((byId.get(a.clip)?.duration ?? a.end) - a.end) / a.speed));
    // Whole frames, rounded toward no shift so the limits hold.
    shifts[i] = shift === 0 ? 0 : Math.trunc(shift * FPS + Math.sign(shift) * 1e-6) / FPS || 0;
  }
  return shifts;
}

// Where the picture changes on the finished timeline, shot by shot (the first shot's is 0):
// what graphics, transitions and sound effects meant for a cut should be timed to.
export function pictureCuts(plan: EditPlan, clips: Clip[]) {
  const shifts = pictureShifts(plan, clips);
  return timelineOf(plan).shots.map((s, i) => (i === 0 ? s.start : s.start + (s.seg.hold > 0 || plan.segments[i - 1].hold > 0 ? 0 : shifts[i])));
}
