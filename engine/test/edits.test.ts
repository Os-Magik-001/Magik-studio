import assert from "node:assert/strict";
import { test } from "node:test";
import { HEAD, PUNCH, refineEdits, TAIL, TAIL_MAX, type ClipSound } from "../src/edits.ts";
import { FPS, timelineOf, type Clip, type EditPlan } from "../src/plan.ts";
import { speechMapOf } from "../src/speech.ts";
import { CUT, EXTRAS, shot, txt, voice } from "./fixtures.ts";

type W = [string, number, number];
// A take: its sound has a syllable where each word is, and its words are placed there.
const take = (words: W[], seconds = 6): ClipSound => ({
  map: speechMapOf(voice(seconds, words.map(([, a, b]) => [a, b]))),
  sounds: words.map(([text, start, end]) => ({ text, start, end })),
});
const clip = (id: string, seconds = 6): Clip => ({ id, fileName: id, file: id, preview: id, duration: seconds, width: 1080, height: 1920, fps: 30, hasAudio: true, sheets: [], interval: 1, transcript: [] });
const plan = (segments: EditPlan["segments"], extra: Partial<EditPlan> = {}): EditPlan => ({
  ...EXTRAS, look: "natural", summary: "", segments, on_screen_text: [], end_card: { include: false, headline: null, seconds: 0, transition: CUT }, open_questions: [], ...extra,
});
const LINE: W[] = [["one", 0.5, 0.9], ["two", 1.0, 1.4], ["three", 2.4, 2.8], ["four", 2.9, 3.3]];
const inWord = (sounds: ClipSound, t: number) => sounds.sounds.find((s) => s.start + 0.02 < t && s.end - 0.02 > t);

test("a clipped last word is given back whole, with air after it", () => {
  const s = new Map([["C1", take(LINE)]]);
  const { plan: out, notes } = refineEdits(plan([shot("C1", 0.6, 1.25, "line")]), [clip("C1")], s);
  const [seg] = out.segments;
  assert.ok(Math.abs(seg.start - (0.5 - HEAD)) < 0.03, `in ${seg.start}`);
  assert.ok(seg.end - 1.4 >= 0.2 - 1e-6 && seg.end - 1.4 <= TAIL_MAX + 0.02, `out ${seg.end}`);
  assert.ok(!inWord(s.get("C1")!, seg.start) && !inWord(s.get("C1")!, seg.end));
  assert.ok(notes.some((n) => n.includes('"two" was clipped')), notes.join("; "));
});

test("a fragment of the next word is left out, and long air is brought back to the rule", () => {
  const s = new Map([["C1", take(LINE)]]);
  const { plan: out } = refineEdits(plan([shot("C1", 0.4, 2.5, "line")]), [clip("C1")], s);
  const end = out.segments[0].end;
  assert.ok(end < 2.4 && end - 1.4 <= TAIL_MAX + 0.02 && end - 1.4 >= TAIL - 0.06, `out ${end}`);
});

test("in a gap too short for the air, the cut goes in its middle", () => {
  const s = new Map([["C1", take(LINE)]]);
  const { plan: out } = refineEdits(plan([shot("C1", 1.05, 1.8, "second word")]), [clip("C1")], s);
  assert.ok(Math.abs(out.segments[0].start - 0.95) < 0.03, `in ${out.segments[0].start}`);
});

test("two shots of one take that overlap meet at one source time, between words", () => {
  const s = new Map([["C1", take(LINE)]]);
  // The second shot starts inside "two", before the first one ends ("Nor-Normally").
  const { plan: out, notes } = refineEdits(plan([shot("C1", 0.4, 1.2, "a"), shot("C1", 1.1, 3.5, "b", { zoom: { start: 1.3, end: 1.3 } })]), [clip("C1")], s);
  const [a, b] = out.segments;
  assert.equal(a.end, b.start, "one source time");
  assert.ok(!inWord(s.get("C1")!, a.end), `the join at ${a.end} is between words`);
  assert.ok(notes.some((n) => n.includes("overlapped")), notes.join("; "));
});

test("a pause cut that took words with it plays the line through instead", () => {
  const s = new Map([["C1", take(LINE)]]);
  const say = "one two three four";
  const { plan: out, notes } = refineEdits(plan([shot("C1", 0.4, 1.05, "line", { say }), shot("C1", 2.3, 3.6, "line (after a cut pause)", { say, zoom: { start: 1.3, end: 1.3 } })]), [clip("C1")], s);
  const [a, b] = out.segments;
  assert.equal(a.end, b.start);
  assert.ok(a.end > 1.4 - 0.02 || b.start < 1.0 + 0.02, "\"two\" is back");
  assert.ok(notes.some((n) => n.includes('"two"')), notes.join("; "));
});

test("a punch-in on one take changes the size by 0.3 or more", () => {
  const s = new Map([["C1", take(LINE)]]);
  const { plan: out } = refineEdits(plan([shot("C1", 0.4, 1.7, "a"), shot("C1", 1.7, 3.6, "b", { zoom: { start: 1.15, end: 1.15 } })]), [clip("C1")], s);
  assert.ok(Math.abs(out.segments[1].zoom.start - (1 + PUNCH)) < 1e-9, `zoom ${out.segments[1].zoom.start}`);
});

test("every shot lasts a whole number of frames, and titles stay on their moment", () => {
  const s = new Map([["C1", take(LINE)], ["C2", take([["hey", 0.6, 1.0], ["you", 1.1, 1.5]])]]);
  const before = plan([shot("C1", 0.37, 1.61, "a"), shot("C2", 0.33, 1.9, "b")], { on_screen_text: [txt("HEY", 1.4, 2.4, "hero", "top")] });
  const { plan: out } = refineEdits(before, [clip("C1"), clip("C2")], s);
  for (const seg of out.segments) {
    const frames = ((seg.end - seg.start) / seg.speed) * FPS;
    assert.ok(Math.abs(frames - Math.round(frames)) < 1e-6, `${frames} frames`);
  }
  // The title began 1.4 s in, i.e. 0.17 s into shot 2's source; it still does.
  const shot2 = timelineOf(out).shots[1];
  const src = 0.33 + (1.4 - timelineOf(before).shots[1].start);
  assert.ok(Math.abs(out.on_screen_text[0].start - (shot2.start + (src - out.segments[1].start))) < 0.02);
});

test("a reaction keeps its silence; only a cut through a word moves", () => {
  const s = new Map([["C1", take(LINE)]]);
  const { plan: out } = refineEdits(plan([shot("C1", 1.6, 2.2, "reaction", { beat: "reaction" })]), [clip("C1")], s);
  assert.ok(Math.abs(out.segments[0].start - 1.6) < 1e-9);
  assert.ok(Math.abs(out.segments[0].end - 2.2) < 1 / FPS);
});

test("a word said at the end of one shot and again at the start of the next is said once", () => {
  const s = new Map([["C1", take(LINE)], ["C2", take([["two", 0.5, 0.9], ["three", 1.0, 1.4]])]]);
  const { plan: out, notes } = refineEdits(plan([shot("C1", 0.4, 1.6, "a"), shot("C2", 0.4, 1.7, "b")]), [clip("C1"), clip("C2")], s);
  assert.ok(out.segments[1].start > 0.9 && out.segments[1].start < 1.0, `b in ${out.segments[1].start}`);
  assert.ok(notes.some((n) => n.includes("said twice")), notes.join("; "));
});

test("a word whose sound runs past its time isn't cut off at the time", () => {
  // The sound of "two" lasts to 1.4 s, but its placed time says it ends at 1.05: the air
  // after that would still be inside the word.
  const sound = take(LINE);
  sound.sounds[1] = { text: "two", start: 1.0, end: 1.05 };
  const s = new Map([["C1", sound]]);
  const { plan: out, notes } = refineEdits(plan([shot("C1", 0.4, 1.25, "line", { say: "one two" })]), [clip("C1")], s);
  assert.ok(out.segments[0].end > 1.4 + 0.1, `out ${out.segments[0].end}`);
  assert.ok(notes.some((n) => n.includes("runs on past its time")), notes.join("; "));
});
