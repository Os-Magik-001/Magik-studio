import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { mkdtemp, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { config } from "../src/config.ts";
import { pruneCache, workingCopy } from "../src/drive.ts";
import { run } from "../src/exec.ts";
import { probe } from "../src/media.ts";

let dir: string;
let source: string;
let server: http.Server;
let url: string;
let rangeRequests = 0;

before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "magik-drive-"));
  source = path.join(dir, "camera.mp4");
  // Like a camera file: 4K-ish, 50 fps, the index (moov) at the end, so reading it needs seeks.
  await run("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=1920x1080:r=50:d=3", "-f", "lavfi", "-i", "sine=f=440:d=3", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", source]);
  // A stand-in for Drive's media endpoint: byte ranges only.
  server = http.createServer(async (req, res) => {
    const { size } = await stat(source);
    const m = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
    if (!m) {
      res.writeHead(200, { "content-length": size, "accept-ranges": "bytes", "content-type": "video/mp4" });
      return void createReadStream(source).pipe(res);
    }
    rangeRequests++;
    const start = Number(m[1]);
    const end = m[2] ? Number(m[2]) : size - 1;
    res.writeHead(206, { "content-length": end - start + 1, "content-range": `bytes ${start}-${end}/${size}`, "accept-ranges": "bytes", "content-type": "video/mp4" });
    createReadStream(source, { start, end }).pipe(res);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/media`;
});

after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await rm(dir, { recursive: true, force: true });
});

test("makes a working copy straight from a ranged URL, keeping frame rate and sound", async () => {
  const out = path.join(dir, "copy.mp4");
  const seen: number[] = [];
  await workingCopy(url, out, (f) => seen.push(f));
  const p = await probe(out);
  assert.equal(p.width, 1920);
  assert.ok(Math.abs(p.fps - 50) < 0.5, `fps ${p.fps}`);
  assert.equal(p.hasAudio, true);
  assert.ok(Math.abs(p.duration - 3) < 0.2);
  assert.ok(rangeRequests > 0, "read the source by byte ranges");
  assert.ok(seen.length > 0 && seen.at(-1)! > 0.9, `progress reported: ${seen.at(-1)}`);
  assert.deepEqual((await readdir(dir)).filter((f) => f.includes("partial")), []);
});

test("a failed copy leaves nothing behind", async () => {
  const out = path.join(dir, "broken.mp4");
  await assert.rejects(workingCopy(`${url}-missing`.replace(/:\d+\//, ":1/"), out));
  assert.deepEqual((await readdir(dir)).filter((f) => f.startsWith("broken")), []);
});

test("the cache drops least recently used copies, never ones in use", async () => {
  const cache = config.cacheDir;
  const mk = async (name: string, mb: number, ageMin: number) => {
    const file = path.join(cache, name);
    await writeFile(file, Buffer.alloc(mb * 1024 * 1024));
    const t = new Date(Date.now() - ageMin * 60_000);
    await utimes(file, t, t);
    return file;
  };
  const { mkdir } = await import("node:fs/promises");
  await mkdir(cache, { recursive: true });
  const before = config.cacheBytes;
  config.cacheBytes = 5 * 1024 * 1024;
  try {
    const oldest = await mk("t-oldest.mp4", 3, 30);
    const inUse = await mk("t-inuse.mp4", 3, 20);
    const newest = await mk("t-newest.mp4", 2, 1);
    await pruneCache(new Set([inUse]));
    const left = await readdir(cache);
    assert.ok(!left.includes(path.basename(oldest)));
    assert.ok(left.includes(path.basename(inUse)));
    assert.ok(left.includes(path.basename(newest)));
    await rm(inUse);
    await rm(newest);
  } finally {
    config.cacheBytes = before;
  }
});
