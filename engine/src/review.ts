// The self-review pass: the engine watches its own render the way an editor plays
// back a cut, and writes timecoded notes for what a viewer would notice: dead air,
// words said twice, freezes that drag, flash cuts. Claude then revises the plan from
// those notes and the render's frames.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { contactSheets } from "./media.ts";
import { timelineOf, type EditPlan } from "./plan.ts";
import { transcribe, transcriptionAvailable } from "./transcribe.ts";

export type ReviewNote = { timecodeMs: number; body: string; fromClient: false };

const bare = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
const at = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
const QUIET_OK = /react|glance|look|stare|deadpan|beat|freeze|hold|b-roll|broll|cutaway|insert|establish|intro|logo|title|end card|ending|tag/i;

export async function reviewRender(output: string, plan: EditPlan, dir: string) {
  await mkdir(dir, { recursive: true });
  const notes: ReviewNote[] = [];
  const add = (t: number, body: string) => notes.push({ timecodeMs: Math.round(t * 1000), body, fromClient: false });
  const { shots, length } = timelineOf(plan);
  const shotAt = (t: number) => shots.find((s) => t >= s.start && t < s.end);
  // Moments a motion graphic or a title deliberately holds the screen.
  const covered = (t: number) => plan.motion.some((m) => t >= m.start && t <= m.end);

  if (await transcriptionAvailable()) {
    const lines = (await transcribe(output, dir)) ?? [];
    const words = lines.flatMap((l) => l.words ?? []).sort((a, b) => a.start - b.start);
    for (let k = 1; k < words.length; k++) {
      const gap = words[k].start - words[k - 1].end;
      const mid = words[k - 1].end + gap / 2;
      const shot = shotAt(mid);
      if (gap > 0.45 && !covered(mid) && !(shot && (shot.seg.hold > 0 || QUIET_OK.test(shot.seg.purpose)))) {
        add(words[k - 1].end, `Dead air: ${gap.toFixed(1)}s with nothing said between "${words[k - 1].text}" and "${words[k].text}". Tighten it unless it's a deliberate beat.`);
      }
      const a = bare(words[k - 1].text);
      if (a && a.length > 1 && a === bare(words[k].text)) add(words[k - 1].start, `"${words[k].text}" is said twice in a row (a stutter or a retake left in). Keep one.`);
      // The same three words twice within a few seconds: a line from two takes.
      if (k >= 5) {
        const tri = (i: number) => words.slice(i, i + 3).map((w) => bare(w.text)).join(" ");
        for (let j = Math.max(0, k - 12); j < k - 3; j++) {
          if (tri(j).length > 8 && tri(j) === tri(k - 2) && words[k].start - words[j].start < 8) {
            add(words[j].start, `"${words.slice(j, j + 3).map((w) => w.text).join(" ")}" is said twice: two takes of the same line are both in. Keep the better one.`);
            break;
          }
        }
      }
    }
  }
  for (const s of shots) {
    if (s.seg.hold > 2.9) add(s.start, `This freeze lasts ${s.seg.hold.toFixed(1)}s: it drags. 2.2 to 2.8s is enough for an intro, about 1s for a comic beat.`);
    if (s.seg.hold === 0 && s.end - s.start < 0.35 && !/flash|whip|snap/i.test(s.seg.purpose)) add(s.start, `A ${(s.end - s.start).toFixed(2)}s flash cut: it reads as a glitch. Merge it or hold it longer.`);
  }

  // One frame per second of the render, so Claude can watch it.
  const interval = length > 90 ? 2 : 1;
  const files = await contactSheets(output, path.join(dir, "review-sheets"), interval);
  // Several notes about the same moment read as one.
  const unique = notes.filter((n, i) => notes.findIndex((m) => Math.abs(m.timecodeMs - n.timecodeMs) < 300 && m.body.slice(0, 12) === n.body.slice(0, 12)) === i);
  return { notes: unique.sort((a, b) => a.timecodeMs - b.timecodeMs), sheets: { files, interval }, summary: unique.map((n) => `${at(n.timecodeMs / 1000)} ${n.body}`) };
}
