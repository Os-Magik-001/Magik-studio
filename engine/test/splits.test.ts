import assert from "node:assert/strict";
import { test } from "node:test";
import type { Clip, EditPlan } from "../src/plan.ts";
import { J_CUT, L_CUT, pictureShifts } from "../src/splits.ts";
import { CUT, EXTRAS, shot } from "./fixtures.ts";

const clip = (id: string, words: [string, number, number][]): Clip => ({
  id, fileName: id, file: id, preview: id, duration: 30, width: 1080, height: 1920, fps: 30, hasAudio: true, sheets: [], interval: 1,
  transcript: words.length ? [{ start: words[0][1], end: words.at(-1)![2], text: words.map((w) => w[0]).join(" "), words: words.map(([text, start, end]) => ({ text, start, end })) }] : [],
});
const plan = (segments: EditPlan["segments"]): EditPlan => ({ ...EXTRAS, look: "natural", summary: "", segments, on_screen_text: [], end_card: { include: false, headline: null, seconds: 0, transition: CUT }, open_questions: [] });
const speaker = clip("C1", [["On", 2.0, 2.2], ["lance", 2.2, 2.6], ["vendredi.", 2.6, 3.4]]);
const listener = clip("C2", []);
const answer = clip("C3", [["Vendredi", 5.0, 5.5], ["?", 5.5, 5.6]]);

test("an L-cut puts the listener's reaction on the end of the line", () => {
  const shifts = pictureShifts(plan([shot("C1", 1.9, 3.5, "line"), shot("C2", 4, 6, "reaction", { beat: "reaction" })]), [speaker, listener]);
  assert.equal(Math.round(shifts[1] * 30), -L_CUT);
});

test("a J-cut lets the next speaker be heard just before they're seen", () => {
  const shifts = pictureShifts(plan([shot("C2", 4, 6, "reaction", { beat: "reaction" }), shot("C3", 4.9, 5.8, "answer")]), [listener, answer]);
  assert.equal(Math.round(shifts[1] * 30), J_CUT);
});

test("the picture never leaves a punchline early, and jump cuts stay straight", () => {
  const shifts = pictureShifts(plan([shot("C1", 1.9, 3.5, "punch", { beat: "punchline" }), shot("C2", 4, 6, "reaction", { beat: "reaction" })]), [speaker, listener]);
  assert.equal(shifts[1], 0);
  const jump = pictureShifts(plan([shot("C1", 1.9, 2.6, "a"), shot("C1", 2.6, 3.5, "b")]), [speaker]);
  assert.equal(jump[1], 0);
});
