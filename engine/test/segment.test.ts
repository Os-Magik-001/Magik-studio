// Runs only on macOS with swiftc; the real-footage checks also need a cached podcast clip.
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { run } from "../src/exec.ts";
import { personMatte, segmentationAvailable } from "../src/segment.ts";

const ready = await segmentationAvailable();
const CACHE = path.join(os.homedir(), "Library/Application Support/Magik Edit Engine/cache");

// The biggest finished .mp4 in the engine's cache: a 4K vertical clip of a man talking.
async function podcastClip() {
  const names = await readdir(CACHE).catch(() => [] as string[]);
  const files = names.filter((n) => n.endsWith(".mp4") && !/partial|preview/.test(n)).map((n) => path.join(CACHE, n));
  const sized = await Promise.all(files.map(async (f) => ({ f, size: (await stat(f)).size })));
  return sized.sort((a, b) => b.size - a.size)[0]?.f ?? null;
}

async function maskInfo(file: string) {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-count_frames", "-select_streams", "v:0",
    "-show_entries", "stream=width,height,nb_read_frames:format=duration", "-of", "json", file,
  ]);
  const info = JSON.parse(stdout) as { streams: { width: number; height: number; nb_read_frames: string }[]; format: { duration: string } };
  const s = info.streams[0];
  return { width: s.width, height: s.height, frames: Number(s.nb_read_frames), duration: Number(info.format.duration) };
}

// Every frame shrunk to w x h gray pixels, as ffmpeg decodes them (full range 0-255).
async function grayFrames(file: string, w: number, h: number) {
  const raw = `${file}.gray`;
  await run("ffmpeg", ["-v", "error", "-y", "-i", file, "-vf", `scale=${w}:${h}:flags=area,format=gray`, "-f", "rawvideo", raw]);
  const data = await readFile(raw);
  return Array.from({ length: data.length / (w * h) }, (_, i) => data.subarray(i * w * h, (i + 1) * w * h));
}

// Mean of a region given as fractions of the frame, over all frames.
function regionMean(frames: Buffer[], w: number, h: number, x0: number, y0: number, x1: number, y1: number) {
  let sum = 0;
  let n = 0;
  for (const f of frames) {
    for (let y = Math.floor(y0 * h); y < Math.ceil(y1 * h); y++) {
      for (let x = Math.floor(x0 * w); x < Math.ceil(x1 * w); x++) {
        sum += f[y * w + x];
        n++;
      }
    }
  }
  return sum / n;
}

let dir: string;
before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "magik-segment-"));
});
after(() => rm(dir, { recursive: true, force: true }));

test("writes a matte with the requested frames, length and size", { skip: !ready }, async () => {
  const clip = path.join(dir, "testsrc.mp4");
  await run("ffmpeg", [
    "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=1080x1920:rate=30:duration=3",
    "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", clip,
  ]);
  const out = path.join(dir, "testsrc.matte.mov");
  // Both calls share one compile of the Swift tool.
  await Promise.all([personMatte(clip, 0.5, 1.5, 10, out), personMatte(clip, 0, 1, 24, path.join(dir, "second.mov"))]);
  assert.deepEqual(await maskInfo(out), { width: 1080, height: 1920, frames: 15, duration: 1.5 });
  assert.equal((await maskInfo(path.join(dir, "second.mov"))).frames, 24);
});

test("rejects a missing input with a clear error", { skip: !ready }, async () => {
  await assert.rejects(personMatte(path.join(dir, "nope.mp4"), 0, 1, 10, path.join(dir, "nope.mov")), /can't open/);
});

const podcast = ready ? await podcastClip() : null;

test("finds the speaker in real footage", { skip: !podcast }, async () => {
  const out = path.join(dir, "podcast.matte.mov");
  await personMatte(podcast!, 60, 2, 10, out);
  const info = await maskInfo(out);
  assert.equal(info.frames, 20);
  assert.equal(info.duration, 2);
  assert.ok(info.height > info.width, "vertical clip gives a vertical matte");

  const [w, h] = [108, 192];
  const frames = await grayFrames(out, w, h);
  assert.equal(frames.length, 20);
  const body = regionMean(frames, w, h, 0.4, 0.45, 0.6, 0.6);
  const topLeft = regionMean(frames, w, h, 0, 0, 0.1, 0.08);
  const topRight = regionMean(frames, w, h, 0.9, 0, 1, 0.08);
  assert.ok(body > 220, `person region is white, got ${body.toFixed(1)}`);
  assert.ok(topLeft < 20 && topRight < 20, `corners are black, got ${topLeft.toFixed(1)} / ${topRight.toFixed(1)}`);
});

test("follows the rotation ffmpeg applies", { skip: !podcast }, async () => {
  // The same footage stored sideways with a 90° display rotation must give the same, upright matte.
  const upright = path.join(dir, "upright.mp4");
  const sideways = path.join(dir, "sideways-raw.mp4");
  const rotated = path.join(dir, "rotated.mp4");
  const x264 = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-pix_fmt", "yuv420p", "-an"];
  await run("ffmpeg", ["-v", "error", "-y", "-ss", "60", "-t", "1", "-i", podcast!, "-vf", "scale=540:960", ...x264, upright]);
  await run("ffmpeg", ["-v", "error", "-y", "-i", upright, "-vf", "transpose=clock", ...x264, sideways]);
  await run("ffmpeg", ["-v", "error", "-y", "-display_rotation", "90", "-i", sideways, "-c", "copy", rotated]);

  await personMatte(upright, 0, 0.5, 4, path.join(dir, "upright.mov"));
  await personMatte(rotated, 0, 0.5, 4, path.join(dir, "rotated.mov"));
  const info = await maskInfo(path.join(dir, "rotated.mov"));
  assert.deepEqual([info.width, info.height], [540, 960]);

  const a = await grayFrames(path.join(dir, "upright.mov"), 54, 96);
  const b = await grayFrames(path.join(dir, "rotated.mov"), 54, 96);
  let diff = 0;
  for (const [i, f] of a.entries()) for (const [j, v] of f.entries()) diff += Math.abs(v - b[i][j]);
  const meanDiff = diff / (a.length * 54 * 96);
  assert.ok(meanDiff < 8, `rotated matte matches the upright one, mean difference ${meanDiff.toFixed(1)}`);
});
