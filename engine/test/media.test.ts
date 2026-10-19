import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { run } from "../src/exec.ts";
import { fitUnder, probe } from "../src/media.ts";

let dir: string;
let heavy: string;

before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "magik-media-"));
  heavy = path.join(dir, "heavy.mp4");
  // Noise barely compresses: a draft far over a small limit.
  await run("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=540x960:r=30:d=4,noise=alls=40:allf=t", "-f", "lavfi", "-i", "sine=f=440:d=4", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "10", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", heavy]);
});

after(() => rm(dir, { recursive: true, force: true }));

test("a draft over the upload limit is encoded again to fit, with its sound and length", async () => {
  const limit = 1_500_000;
  assert.ok((await stat(heavy)).size > limit * 2, "the test draft starts well over the limit");
  const out = await fitUnder(heavy, path.join(dir, "fit.mp4"), limit);
  const { size } = await stat(out);
  assert.ok(size <= limit, `${size} bytes`);
  assert.ok(size > limit * 0.6, `uses most of the room: ${size} bytes`);
  const p = await probe(out);
  assert.equal(p.hasAudio, true);
  assert.ok(Math.abs(p.duration - 4) < 0.2, `duration ${p.duration}`);
  assert.deepEqual((await readdir(dir)).filter((f) => f.includes("pass")), [], "no two-pass logs left behind");
});

test("a draft too long for the limit says so", async () => {
  await assert.rejects(fitUnder(heavy, path.join(dir, "tiny.mp4"), 100_000), /too long to fit/);
});
