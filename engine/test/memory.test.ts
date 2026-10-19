import assert from "node:assert/strict";
import { test } from "node:test";
import { formatMemory, type Remembered } from "../src/memory.ts";

const video = (n: number, extra: Partial<Remembered> = {}): Remembered => ({
  title: `Episode ${n}`,
  format: "social short",
  createdAt: `2026-10-${String(n).padStart(2, "0")}T12:00:00Z`,
  brief: null,
  concept: `The boys try thing ${n}`,
  script: `Script of episode ${n}`,
  editPrompt: `Cold open, series intro, freeze-frame cards (${n})`,
  cut: null,
  asks: [],
  ...extra,
});

test("the editor remembers each earlier video in full, oldest first", () => {
  const text = formatMemory([video(2, { asks: [{ who: "client", text: "On the edit: music lower" }] }), video(1, { cut: "34s, cold open on the gym" })], "edit")!;
  assert.match(text, /^2 other videos for this client, oldest first\./);
  assert.ok(text.indexOf('"Episode 1"') < text.indexOf('"Episode 2"'));
  assert.match(text, /Script:\nScript of episode 1/);
  assert.match(text, /Edit prompt:\nCold open, series intro/);
  assert.match(text, /The last cut: 34s, cold open on the gym/);
  assert.match(text, /- Client: On the edit: music lower/);
});

test("past the budget the oldest videos shrink to a line, the newest stay in full", () => {
  const long = "x".repeat(2400);
  const videos = Array.from({ length: 30 }, (_, i) => video(i + 1, { script: long, editPrompt: long }));
  const text = formatMemory(videos, "edit")!;
  assert.ok(text.length < 40_000);
  assert.match(text, /^30 other videos/);
  assert.match(text, /Older ones, in short:\n- "Episode 1" \(social short, 2026-10-01\): The boys try thing 1/);
  assert.match(text, /### "Episode 30"/);
  assert.doesNotMatch(text, /### "Episode 1"/);
});

test("the researcher gets one line per video", () => {
  const text = formatMemory([video(1), video(2, { concept: null, brief: "Gym\nday" })], "brief")!;
  assert.equal(text, '2 other videos for this client, oldest first.\n- "Episode 1" (social short, 2026-10-01): The boys try thing 1\n- "Episode 2" (social short, 2026-10-02): Gym day');
});

test("no earlier videos, no memory", () => {
  assert.equal(formatMemory([], "edit"), null);
});
