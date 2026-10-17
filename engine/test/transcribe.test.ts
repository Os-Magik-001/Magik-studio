// Runs only where whisper.cpp is set up (WHISPER_CPP_MODEL) and macOS `say` can voice a test line.
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { exists, run } from "../src/exec.ts";
import { namesIn, transcribe, transcriptionAvailable } from "../src/transcribe.ts";

const ready = (await transcriptionAvailable()) && (await exists("say"));

test("transcribes speech into timed phrases", { skip: !ready }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "magik-stt-"));
  try {
    await run("say", ["-o", path.join(dir, "a.aiff"), "This is our pumpkin spice latte. [[slnc 1500]] Come try it before it's gone."]);
    const file = path.join(dir, "speech.mp4");
    await run("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=black:s=320x240:r=15", "-i", path.join(dir, "a.aiff"), "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", file]);
    const lines = await transcribe(file, dir, "Pumpkin spice latte.");
    const text = (lines ?? []).map((l) => l.text).join(" ").toLowerCase();
    assert.match(text, /pumpkin spice latte/);
    assert.match(text, /before it's gone/);
    const last = lines!.at(-1)!;
    assert.ok(last.start > 2, `second line starts after the pause, got ${last.start}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("only names and terms from the hint prime Whisper, never sentences", () => {
  assert.equal(namesIn("Magik test. Series episode test. A short episode of our web series, from a talk between two founders."), "Magik, Series");
  assert.equal(namesIn("IG Patrimoine. Les placements de Jean-Marc Tremblay chez Desjardins en 2026, avec iPhone et @magik."), "IG, Patrimoine, Jean-Marc, Tremblay, Desjardins, 2026, iPhone, @magik");
  assert.equal(namesIn(""), "");
});
