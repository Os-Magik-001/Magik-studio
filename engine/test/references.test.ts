import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { run } from "../src/exec.ts";
import { probe } from "../src/media.ts";
import { describeReference, publicHost, studyReference, type Breakdown } from "../src/references.ts";
import { withSound } from "../src/research.ts";

const breakdown: Breakdown = {
  summary: "A 15 s motion reel: a 3D phone, then kinetic type on colour fields.",
  hook: "A phone tumbles in on a black field in the first second, the name lands on the beat.",
  structure: [
    { at: "0:00-0:02", beat: "hook", what: "the phone tumbles in" },
    { at: "0:02-0:12", beat: "proof", what: "posts lift off the screen" },
  ],
  pacing: "A change every 0.6 s, faster at the drop.",
  camera: "Locked-off, black ground, soft studio light.",
  text: "Huge condensed white words, one per screen, an italic serif accent.",
  graphics: "3D phone, cards lifting off, hard cuts on the beat.",
  sound: "Dark trap at 140 BPM, every cut on a beat, a riser into the drop.",
  script: "No speech.",
  borrow: ["Open on the product in 3D", "One word per screen on the bars"],
  avoid: ["The creator's purple"],
};

const row = (extra: Record<string, unknown> = {}) => ({
  id: "r1",
  video_id: "v1",
  url: "https://www.instagram.com/reel/DdO63LGPBsn/",
  platform: "instagram",
  focus: [] as string[],
  note: "The way the phone comes in",
  status: "done",
  watched: true,
  title: "Bringing ideas to life",
  owner: "@slateacademy_",
  duration: 15.5,
  stats: { shots: 12, cutsPerSecond: 0.77, medianShot: 1.1, wordsPerMinute: null, speechShare: 0, bpm: 140, plays: 288115, likes: 7408, music: null, watchedSeconds: null },
  analysis: breakdown,
  sheets: ["c/r1/sheet-1.jpg"],
  error: null,
  ...extra,
});

test("the engine never fetches a private address", () => {
  for (const url of ["https://scontent.cdninstagram.com/v.mp4", "https://api.apify.com/v2/key-value-stores/x/records/y", "https://8.8.8.8/a.mp4"]) assert.equal(publicHost(url), true, url);
  for (const url of ["http://localhost:3000/a.mp4", "http://127.0.0.1/a", "http://10.0.0.4/a", "http://192.168.1.20/a", "http://172.20.1.1/a", "http://169.254.169.254/latest", "http://[::1]/a", "http://nas.local/a.mp4", "http://router/a", "not a url"]) assert.equal(publicHost(url), false, url);
});

test("each agent of the edit reads the part of a reference the studio wants", () => {
  const all = describeReference(row(), 1, "/tmp/sheet.jpg");
  assert.equal(all.label, 'Reference 1: instagram · @slateacademy_ · "Bringing ideas to life"');
  assert.match(all.text, /for this video; https:\/\/www.instagram.com\/reel\/DdO63LGPBsn\//);
  assert.match(all.text, /The studio didn't say what it wants from it: take what fits\./);
  assert.match(all.text, /The studio's note: The way the phone comes in/);
  assert.match(all.text, /Measured: 0.77 cuts per second, shots around 1.1 s, music about 140 BPM, 15.5 s long\./);
  assert.match(all.text, /Structure: 0:00-0:02 hook: the phone tumbles in \| 0:02-0:12 proof/);
  assert.match(all.text, /Borrow:\n- Open on the product in 3D\n- One word per screen on the bars/);
  assert.equal(all.sheet, "/tmp/sheet.jpg");
  assert.ok(all.sound?.includes("Dark trap at 140 BPM"));
  assert.ok(all.design?.includes("Huge condensed white words"));

  // Wanted for its hook and pacing: the sound designer gets the pacing, the motion designer nothing.
  const hook = describeReference(row({ focus: ["hook", "pacing"], video_id: null }), 2, null);
  assert.match(hook.text, /for all the client's videos/);
  assert.match(hook.text, /The studio wants from it: the hook, the pacing and the cuts\./);
  assert.ok(hook.sound?.includes("A change every 0.6 s"));
  assert.equal(hook.design, null);
});

test("a reference the engine couldn't watch still carries the studio's note", () => {
  const youtube = describeReference(row({ platform: "youtube", watched: false, analysis: null, stats: null, duration: null, error: "YouTube doesn't allow downloads: the agents get its title and your note." }), 1, null);
  assert.match(youtube.text, /YouTube doesn't allow downloads: the agents get its title and your note\. Work from the note\./);
  assert.doesNotMatch(youtube.text, /Measured|Borrow/);
  const pending = describeReference(row({ status: "queued", analysis: null, stats: null }), 1, null);
  assert.match(pending.text, /The engine hasn't watched it yet\. Work from the note\./);
  const failed = describeReference(row({ status: "failed", analysis: null, stats: null, error: "Instagram didn't return this post" }), 1, null);
  assert.match(failed.text, /The engine couldn't open it \(Instagram didn't return this post\)\./);
});

// fetch, answered locally: the engine's downloads and the oEmbed lookups, without the network.
function mockFetch(routes: Record<string, () => Response>) {
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const route = Object.keys(routes).find((r) => url.startsWith(r));
    if (!route) throw new Error(`unexpected fetch ${url}`);
    return routes[route]();
  }) as typeof fetch;
  return () => (globalThis.fetch = real);
}

test("a direct video link is watched, measured and broken down; a YouTube link gives its title", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "magik-ref-"));
  try {
    // Three flat colours, two seconds each: two cuts.
    const clip = path.join(dir, "ref.mp4");
    await run("ffmpeg", [
      "-v", "error", "-y",
      "-f", "lavfi", "-i", "color=c=red:s=360x640:d=2:r=15", "-f", "lavfi", "-i", "color=c=blue:s=360x640:d=2:r=15", "-f", "lavfi", "-i", "color=c=green:s=360x640:d=2:r=15",
      "-filter_complex", "[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]", "-map", "[v]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", clip,
    ]);
    const bytes = await readFile(clip);
    const restore = mockFetch({
      "https://cdn.example.com/ref.mp4": () => new Response(bytes, { headers: { "content-type": "video/mp4", "content-length": String(bytes.length) } }),
      "https://www.youtube.com/oembed": () => Response.json({ title: "How we edit reels", author_name: "Studio X" }),
    });
    try {
      let seen: { text: string; sheets: number } | null = null;
      const studied = await studyReference(
        { url: "https://cdn.example.com/ref.mp4", platform: "file", focus: ["pacing"], note: "This rhythm", client: "Magik Management", video: { title: "Launch", brief: null } },
        path.join(dir, "work"),
        () => {},
        async (input, f, w) => {
          seen = { text: `${input.note} ${f.title} ${w.sheets.map((s) => s.times.join(",")).join(" | ")}`, sheets: w.sheets.length };
          return breakdown;
        },
      );
      assert.equal(studied.watched, true);
      assert.equal(studied.title, "ref");
      assert.equal(studied.duration, 6);
      assert.equal(studied.stats?.shots, 3);
      assert.equal(studied.stats?.cutsPerSecond, 0.33);
      assert.equal(studied.stats?.medianShot, 2);
      assert.deepEqual(studied.analysis, breakdown);
      assert.equal(studied.sheets.length, 2);
      assert.deepEqual(seen, { text: "This rhythm ref 0,0.5,1,1.5,2,2.5,3,3.5,4 | 4.5,5,5.5", sheets: 2 });

      const youtube = await studyReference({ url: "https://www.youtube.com/watch?v=abcdefgh", platform: "youtube", focus: [], note: null, client: "Magik" }, path.join(dir, "yt"), () => {}, async () => {
        throw new Error("a YouTube link isn't broken down");
      });
      assert.deepEqual(
        { watched: youtube.watched, title: youtube.title, owner: youtube.owner, analysis: youtube.analysis, sheets: youtube.sheets },
        { watched: false, title: "How we edit reels", owner: "Studio X", analysis: null, sheets: [] },
      );
      assert.match(youtube.why ?? "", /YouTube doesn't allow downloads/);
    } finally {
      restore();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("an Instagram reel's silent picture gets its sound back, so it can be heard and timed", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "magik-sound-"));
  try {
    const picture = path.join(dir, "picture.mp4");
    const audio = path.join(dir, "audio.m4a");
    await run("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=red:s=160x284:d=3:r=15", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", picture]);
    await run("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-c:a", "aac", audio]);
    const bytes = await readFile(audio);
    const restore = mockFetch({ "https://cdn.example.com/audio.m4a": () => new Response(bytes) });
    try {
      const joined = await withSound(picture, "https://cdn.example.com/audio.m4a", path.join(dir, "reel.mp4"));
      assert.equal(joined, path.join(dir, "reel.mp4"));
      const p = await probe(joined);
      assert.equal(p.hasVideo && p.hasAudio, true);
      assert.equal(await withSound(picture, undefined, path.join(dir, "none.mp4")), picture);
    } finally {
      restore();
    }
    // A sound that can't be fetched keeps the silent picture.
    const failing = mockFetch({ "https://cdn.example.com/gone.m4a": () => new Response("no", { status: 404 }) });
    try {
      assert.equal(await withSound(picture, "https://cdn.example.com/gone.m4a", path.join(dir, "gone.mp4")), picture);
    } finally {
      failing();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
