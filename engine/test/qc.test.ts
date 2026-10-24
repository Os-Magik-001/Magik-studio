import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { ClipSound } from "../src/edits.ts";
import { exists, run } from "../src/exec.ts";
import type { Clip, EditPlan } from "../src/plan.ts";
import { checkCut, compareWords, listen, snippet } from "../src/qc.ts";
import { islands, pcmOf, speechMapOf } from "../src/speech.ts";
import { transcriptionAvailable } from "../src/transcribe.ts";
import { CUT, EXTRAS, shot, voice } from "./fixtures.ts";

test("what was heard against what should be: lost, clipped and extra words at the edges", () => {
  assert.deepEqual(compareWords("No, but it does have 430 horsepower.", "No, but it does have 430 horses.").missingEnd, ["horsepower"]);
  assert.deepEqual(compareWords("a valet service.", "A valet servant.").extraEnd, ["servant"]);
  assert.deepEqual(compareWords("We're looking for something", "Looking for something").missingStart, ["were"]);
  const fragment = compareWords("Can you believe it", "Yo can you believe it");
  assert.deepEqual(fragment.extraStart, ["yo"]);
  assert.equal(fragment.ok, false);
  // Whisper adds a lone "so" or "but" before a sentence: not held against the cut.
  assert.equal(compareWords("we don't have much time", "So we don't have much time.").ok, true);
  // Spelling isn't a clipped word.
  assert.equal(compareWords("faire du cache", "faire du cash").ok, true);
});

test("without Whisper, the check still finds an edge inside a word", async () => {
  const sound: ClipSound = {
    map: speechMapOf(voice(4, [[0.5, 0.9], [1.0, 1.4]])),
    sounds: [{ text: "one", start: 0.5, end: 0.9 }, { text: "two", start: 1.0, end: 1.4 }],
  };
  const clip: Clip = { id: "C1", fileName: "C1", file: "C1", preview: "C1", duration: 4, width: 1080, height: 1920, fps: 30, hasAudio: true, sheets: [], interval: 1, transcript: [] };
  const plan: EditPlan = { ...EXTRAS, look: "natural", summary: "", segments: [shot("C1", 0.4, 1.2, "line")], on_screen_text: [], end_card: { include: false, headline: null, seconds: 0, transition: CUT }, open_questions: [] };
  const dir = await mkdtemp(path.join(os.tmpdir(), "magik-qc-"));
  try {
    const listening = await transcriptionAvailable();
    if (listening) return; // covered by the listening test below
    const check = await checkCut({ plan, clips: [clip], sounds: new Map([["C1", sound]]), workDir: dir });
    assert.ok(check.flags.some((f) => f.includes('inside "two"')), check.flags.join("; "));
    assert.equal(check.repaired, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// Runs only where whisper.cpp is set up (WHISPER_CPP_MODEL) and macOS `say` can voice a line.
const ready = (await transcriptionAvailable()) && (await exists("say"));

test("listening to a shot on its own hears a clipped last word", { skip: !ready }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "magik-listen-"));
  try {
    const aiff = path.join(dir, "line.aiff");
    await run("say", ["-o", aiff, "Come and try our pumpkin spice latte."]);
    const wav = path.join(dir, "line.wav");
    await run("ffmpeg", ["-v", "error", "-y", "-i", aiff, "-ac", "1", "-ar", "48000", wav]);
    const map = speechMapOf(await pcmOf(wav));
    const end = islands(map).at(-1)!.end;
    await snippet(wav, 0, end + 0.2, path.join(dir, "whole.wav"));
    await snippet(wav, 0, end - 0.3, path.join(dir, "clipped.wav"));
    const [whole, clipped] = await listen([path.join(dir, "whole.wav"), path.join(dir, "clipped.wav")], "en");
    assert.equal(compareWords("Come and try our pumpkin spice latte.", whole).ok, true, `whole: "${whole}"`);
    const h = compareWords("Come and try our pumpkin spice latte.", clipped);
    assert.equal(h.ok, false, `clipped: "${clipped}"`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
