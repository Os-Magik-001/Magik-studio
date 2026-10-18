import assert from "node:assert/strict";
import { test } from "node:test";
import { timelineOf, type Clip, type EditPlan } from "../src/plan.ts";
import { tighten } from "../src/tighten.ts";
import { CUT, EXTRAS, shot, txt } from "./fixtures.ts";

const words = (list: [string, number, number][]) => list.map(([text, start, end]) => ({ text, start, end }));
const clip = (id: string, w: ReturnType<typeof words>): Clip => ({
  id, fileName: id, file: id, preview: id, duration: 30, width: 1080, height: 1920, fps: 30, hasAudio: true, sheets: [], interval: 1,
  transcript: [{ start: w[0].start, end: w.at(-1)!.end, text: w.map((x) => x.text).join(" "), words: w }],
});
const plan = (segments: EditPlan["segments"], extra: Partial<EditPlan> = {}): EditPlan => ({
  ...EXTRAS, look: "natural", summary: "", segments, on_screen_text: [], end_card: { include: false, headline: null, seconds: 0, transition: CUT }, open_questions: [], ...extra,
});

test("dead heads and tails are trimmed to a few frames around the speech", () => {
  const c = clip("C1", words([["Je", 1.0, 1.2], ["suis", 1.2, 1.5], ["MI6.", 1.5, 2.0]]));
  const { plan: out, removed } = tighten(plan([shot("C1", 0.2, 3.2, "MI6 intro line")]), [c]);
  // 0.12 s of air before the first word, 0.2 s after the last (measured sitcom timing).
  assert.deepEqual([out.segments[0].start, out.segments[0].end], [0.88, 2.2]);
  assert.ok(Math.abs(removed - 1.68) < 0.04, `removed ${removed}`); // within a frame
});

test("a stuttered first word and a long pause inside a shot are cut out", () => {
  const c = clip("C1", words([["Comment?", 0.5, 0.9], ["Comment?", 1.2, 1.6], ["Je", 1.7, 1.9], ["construis", 1.9, 2.4], ["une", 3.6, 3.8], ["licorne.", 3.8, 4.4]]));
  const { plan: out, notes } = tighten(plan([shot("C1", 0.4, 4.6, "Joy Boy confessional")]), [c]);
  assert.equal(out.segments.length, 2, "split on the 1.2 s pause");
  assert.equal(out.segments[0].start, 1.08, "starts on the second 'Comment?'");
  assert.ok(out.segments[1].zoom.start > out.segments[0].zoom.start, "the second half punches in to hide the jump");
  assert.ok(notes.some((n) => n.includes("repeated")) && notes.some((n) => n.includes("pause")));
});

test("reaction shots keep their silence, and titles move with the cut", () => {
  const c1 = clip("C1", words([["Bonjour.", 2.0, 2.5]]));
  const c2 = clip("C2", words([["oui", 0.1, 0.3]]));
  const before = plan([shot("C1", 0, 3, "greeting"), shot("C2", 0, 3, "deadpan reaction")], { on_screen_text: [txt("WOW", 3.5, 5, "hero", "top")] });
  const { plan: out } = tighten(before, [c1, c2]);
  assert.deepEqual([out.segments[1].start, out.segments[1].end], [0, 3], "the reaction stays whole");
  const shift = timelineOf(before).shots[1].start - timelineOf(out).shots[1].start;
  assert.ok(Math.abs(out.on_screen_text[0].start - (3.5 - shift)) < 0.02, "the title moved with its shot");
});

test("full-frame intros lock onto their freeze, whatever time they were given", async () => {
  const { anchorMotion } = await import("../src/tighten.ts");
  const c = clip("C1", words([["Salut.", 0.2, 0.6]]));
  const p = plan([shot("C1", 0, 2, "line"), shot("C1", 1.9, 2, "freeze", { hold: 2.2 }), shot("C1", 2, 3, "after")], {
    motion: [{ template: "character_intro", start: 1.4, end: 3.6, title: "GHOST", subtitle: "", lines: [], people: [], screen: null, accent: null, position: "center" }],
  });
  const out = anchorMotion(p);
  assert.deepEqual([out.motion[0].start, out.motion[0].end], [2, 4.2]);
  void c;
});

test("an end lineup goes on the end freeze, not on a short comic freeze next to it", async () => {
  const { anchorMotion } = await import("../src/tighten.ts");
  const p = plan([shot("C1", 0, 2, "line"), shot("C1", 1.9, 2, "comic freeze", { hold: 1 }), shot("C1", 1.9, 2, "end freeze", { hold: 2.4 })], {
    motion: [{ template: "cast_lineup", start: 2.6, end: 5.0, title: "THE BOYZ", subtitle: "", lines: [], people: [], screen: null, accent: null, position: "center" }],
  });
  const out = anchorMotion(p);
  assert.deepEqual([out.motion[0].start, out.motion[0].end], [3, 5.4]);
});

test("a punchline keeps the beat before it and the hold after it", () => {
  const c = clip("C1", words([["Un", 2.0, 2.2], ["milliard,", 2.2, 2.8], ["man.", 3.6, 4.0]]));
  const { plan: out } = tighten(plan([shot("C1", 1.0, 5.0, "the ask", { beat: "punchline" })]), [c]);
  assert.equal(out.segments.length, 1, "the pause before 'man.' is the beat: not cut");
  assert.deepEqual([out.segments[0].start, out.segments[0].end], [1.55, 4.3]);
});
