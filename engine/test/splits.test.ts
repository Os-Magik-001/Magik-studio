import assert from "node:assert/strict";
import { test } from "node:test";
import type { Clip, EditPlan } from "../src/plan.ts";
import { J_CUT, L_CUT, pictureCuts, pictureShifts } from "../src/splits.ts";
import { CUT, EXTRAS, shot } from "./fixtures.ts";

const clip = (id: string, words: [string, number, number][]): Clip => ({
  id, fileName: id, file: id, preview: id, duration: 30, width: 1080, height: 1920, fps: 30, hasAudio: true, sheets: [], interval: 1,
  transcript: words.length ? [{ start: words[0][1], end: words.at(-1)![2], text: words.map((w) => w[0]).join(" "), words: words.map(([text, start, end]) => ({ text, start, end })) }] : [],
});
const plan = (segments: EditPlan["segments"]): EditPlan => ({ ...EXTRAS, look: "natural", summary: "", segments, on_screen_text: [], end_card: { include: false, headline: null, seconds: 0, transition: CUT }, open_questions: [] });
const speaker = clip("C1", [["On", 2.0, 2.2], ["lance", 2.2, 2.6], ["vendredi.", 2.6, 3.4]]);
const listener = clip("C2", []);
const answer = clip("C3", [["Vendredi", 5.0, 5.5], ["?", 5.5, 5.6]]);

test("an L-cut puts the listener's reaction on the end of the line: L_CUT frames before its last word ends", () => {
  // The line's last word ends 0.1 s (3 frames) before the sound edit.
  const shifts = pictureShifts(plan([shot("C1", 1.9, 3.5, "line"), shot("C2", 4, 6, "reaction", { beat: "reaction" })]), [speaker, listener]);
  assert.equal(Math.round(shifts[1] * 30), -(3 + L_CUT));
});

test("a J-cut lets the next speaker be heard just before they're seen: J_CUT frames after their first word", () => {
  // Their first word starts 0.1 s (3 frames) after the sound edit.
  const shifts = pictureShifts(plan([shot("C2", 4, 6, "reaction", { beat: "reaction" }), shot("C3", 4.9, 5.8, "answer")]), [listener, answer]);
  assert.equal(Math.round(shifts[1] * 30), 3 + J_CUT);
});

test("the picture never needs more than the clip has, and the cuts are where the picture changes", () => {
  // The reaction clip ends right where the shot does: no picture to carry on into a J-cut.
  const short = { ...listener, duration: 6 };
  const p = plan([shot("C2", 4, 6, "reaction", { beat: "reaction" }), shot("C3", 4.9, 5.8, "answer")]);
  assert.equal(pictureShifts(p, [short, answer])[1], 0);
  const cuts = pictureCuts(p, [listener, answer]);
  assert.ok(Math.abs(cuts[1] - (2 + (3 + J_CUT) / 30)) < 1e-9, `picture cut at ${cuts[1]}`);
});

test("one take carrying on has no sound edit, so no split", () => {
  const shifts = pictureShifts(plan([shot("C1", 1.9, 2.6, "a"), shot("C1", 2.6, 3.5, "b", { zoom: { start: 1.3, end: 1.3 } })]), [speaker]);
  assert.equal(shifts[1], 0);
});

test("the picture never leaves a punchline early, and jump cuts stay straight", () => {
  const shifts = pictureShifts(plan([shot("C1", 1.9, 3.5, "punch", { beat: "punchline" }), shot("C2", 4, 6, "reaction", { beat: "reaction" })]), [speaker, listener]);
  assert.equal(shifts[1], 0);
  const jump = pictureShifts(plan([shot("C1", 1.9, 2.6, "a"), shot("C1", 2.6, 3.5, "b")]), [speaker]);
  assert.equal(jump[1], 0);
});
