// Split edits: professional dialogue editing rarely cuts picture and sound at the same
// instant. The sound edit stays where the plan put it (it follows the words); the
// picture cut moves a few frames:
//   - L-cut onto a reaction: the picture goes to the listener while the line finishes,
//     so the reaction lands on the words (Dmytryk: the listener grasps the meaning
//     before the sentence ends).
//   - J-cut into a new speaker: their voice starts a few frames before we see them.
//   - Never off a punchline: the picture stays on the speaker until the last syllable.
// Only between two moving shots joined by a hard cut, and never inside one take (a
// jump cut in the same framing reads as a glitch if picture and sound slip).

import { FPS, type Clip, type EditPlan } from "./plan.ts";

type Shot = EditPlan["segments"][number];
const frames = (n: number) => n / FPS;

// Frames the picture cut moves: L-cut onto a reaction, J-cut into a new line.
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
    if (b.transition_in.type !== "cut" || a.hold > 0 || b.hold > 0) continue;
    // Same take, same framing: a jump cut, kept straight.
    if (a.clip === b.clip && Math.abs(a.zoom.start - b.zoom.start) < 0.05 && Math.abs(b.start - a.end) < 1.5) continue;
    const aWords = wordsIn(a, byId.get(a.clip));
    const bWords = wordsIn(b, byId.get(b.clip));
    const aSpeaksToEnd = aWords.length > 0 && a.end - aWords.at(-1)!.end < 0.25;
    const bOpensWithWords = bWords.length > 0 && bWords[0].start - b.start < 0.2;
    const bSilentStart = !bWords.length || bWords[0].start - b.start > 0.5;

    let shift = 0;
    if (a.beat !== "punchline" && aSpeaksToEnd && (b.beat === "reaction" || bSilentStart)) {
      // L-cut: see the listener during the last words of the line.
      shift = -frames(L_CUT);
    } else if (bOpensWithWords && a.beat !== "punchline" && b.beat !== "reaction") {
      // J-cut: hear the new speaker just before seeing them.
      shift = frames(J_CUT);
    }
    // The picture can only reach back as far as the shot's own source, and can't eat
    // more than a third of either shot.
    const lenA = (a.end - a.start) / a.speed;
    const lenB = (b.end - b.start) / b.speed;
    const limit = Math.min(lenA, lenB) / 3;
    if (shift < 0) shift = -Math.min(-shift, limit, b.start / b.speed);
    if (shift > 0) shift = Math.min(shift, limit);
    shifts[i] = Math.round(shift * FPS) / FPS;
  }
  return shifts;
}
