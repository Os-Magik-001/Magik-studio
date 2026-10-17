import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { run } from "../src/exec.ts";
import { describeLibrary, loadLibrary, MOODS, trackFile } from "../src/music.ts";

test("library.json is complete, commercially licensed and well formed", async () => {
  const tracks = await loadLibrary();
  assert.ok(tracks.length >= 12 && tracks.length <= 80, `${tracks.length} tracks`);
  assert.equal(new Set(tracks.map((t) => t.id)).size, tracks.length, "ids are unique");
  for (const t of tracks) {
    assert.match(t.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `kebab id: ${t.id}`);
    for (const k of ["title", "artist", "url", "page", "license"] as const) assert.ok(t[k]?.trim(), `${t.id}.${k}`);
    assert.ok(MOODS.includes(t.mood), `${t.id} mood ${t.mood}`);
    assert.ok(["low", "medium", "high"].includes(t.energy), `${t.id} energy ${t.energy}`);
    assert.ok(t.bpm >= 70 && t.bpm <= 180, `${t.id} bpm ${t.bpm}`);
    assert.ok(t.duration >= 30 && t.duration <= 300, `${t.id} duration ${t.duration}`);
    assert.ok(t.firstBeat >= 0 && t.firstBeat < Math.min(10, t.duration), `${t.id} firstBeat ${t.firstBeat}`);
    // Web links, or tracks the studio keeps in Google Drive ("drive:<file id>").
    assert.ok(/^(https:\/\/|drive:[\w-]{10,}$)/.test(t.url), `${t.id} url`);
    assert.equal(new URL(t.page).protocol, "https:", `${t.id} page`);
    // Attribution or non-commercial terms would rule a track out for client ads.
    assert.doesNotMatch(t.license, /\bBY\b|\bNC\b/i, `${t.id} license ${t.license}`);
  }
  for (const mood of MOODS) assert.ok(tracks.some((t) => t.mood === mood), `a track for ${mood}`);
  const text = describeLibrary(tracks);
  for (const t of tracks) assert.ok(text.includes(`${t.id}: ${t.mood}, ${t.energy} energy, ${t.bpm} BPM`), t.id);
});

test("downloads, normalizes and caches the smallest track", { timeout: 300_000 }, async (t) => {
  if (process.env.ENGINE_OFFLINE === "1") return t.skip("ENGINE_OFFLINE=1");
  const tracks = await loadLibrary();
  const sizes = await Promise.all(
    tracks.map((track) =>
      fetch(track.url, { method: "HEAD", signal: AbortSignal.timeout(20_000) })
        .then((r) => (r.ok ? Number(r.headers.get("content-length")) || Infinity : Infinity))
        .catch(() => Infinity),
    ),
  );
  if (sizes.every((s) => s === Infinity)) return t.skip("offline");
  const track = tracks[sizes.indexOf(Math.min(...sizes))];

  const dir = await mkdtemp(path.join(os.tmpdir(), "magik-music-"));
  const before = process.env.ENGINE_MUSIC_DIR;
  process.env.ENGINE_MUSIC_DIR = dir;
  try {
    const file = await trackFile(track);
    assert.equal(file, path.join(dir, `${track.id}.m4a`));
    const { stdout } = await run("ffprobe", [
      "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_name,sample_rate,channels:format=duration",
      "-of", "json", file,
    ]);
    const info = JSON.parse(stdout) as { streams: { codec_name: string; sample_rate: string; channels: number }[]; format: { duration: string } };
    assert.equal(info.streams[0].codec_name, "aac");
    assert.equal(Number(info.streams[0].sample_rate), 48000);
    assert.equal(info.streams[0].channels, 2);
    assert.ok(Math.abs(Number(info.format.duration) - track.duration) < 1, `duration ${info.format.duration} vs ${track.duration}`);

    const { stderr } = await run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128", "-f", "null", "-"]);
    const lufs = Number(stderr.match(/Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS/)?.[1]);
    assert.ok(Math.abs(lufs + 16) <= 1.5, `loudness ${lufs} LUFS`);

    const started = Date.now();
    assert.equal(await trackFile(track), file);
    assert.ok(Date.now() - started < 1000, "second call is served from the cache");
  } finally {
    if (before === undefined) delete process.env.ENGINE_MUSIC_DIR;
    else process.env.ENGINE_MUSIC_DIR = before;
    await rm(dir, { recursive: true, force: true });
  }
});
