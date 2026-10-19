import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { analyzeSamples, peakOf } from "../src/analysis.ts";

const RATE = 11025;

// A click on every beat at `bpm` from `first`, a low thump on every bar, and the level
// stepping up 12 dB at `lift` seconds.
function clickTrack(seconds: number, bpm: number, first: number, lift: number) {
  const x = new Float32Array(Math.round(seconds * RATE));
  const beat = 60 / bpm;
  for (let n = 0, t = first; t < seconds - 0.1; n++, t = first + n * beat) {
    const gain = t >= lift ? 0.8 : 0.2;
    const at = Math.round(t * RATE);
    for (let i = 0; i < 0.03 * RATE && at + i < x.length; i++) {
      const s = i / RATE;
      x[at + i] += gain * Math.sin(2 * Math.PI * 1200 * s) * Math.exp(-s * 120);
      if (n % 4 === 0) x[at + i] += gain * Math.sin(2 * Math.PI * 60 * s) * Math.exp(-s * 30);
    }
  }
  // A steady pad under it, so the loudness has sections and not only hits.
  for (let i = 0; i < x.length; i++) x[i] += (i / RATE >= lift ? 0.2 : 0.05) * Math.sin((2 * Math.PI * 220 * i) / RATE);
  return x;
}

test("tempo, beats, bars and the drop come from the audio", () => {
  const a = analyzeSamples(clickTrack(40, 120, 0.2, 16), RATE);
  assert.ok(Math.abs(a.bpm - 120) < 0.6, `bpm ${a.bpm}`);
  const beat = 0.5;
  const off = (((a.firstBeat - 0.2) % beat) + beat) % beat;
  assert.ok(Math.min(off, beat - off) < 0.04, `first beat ${a.firstBeat}`);
  const barOff = (((a.downbeat - 0.2) % 2) + 2) % 2;
  assert.ok(Math.min(barOff, 2 - barOff) < 0.06, `downbeat ${a.downbeat}`);
  assert.ok(a.drops.some((d) => Math.abs(d - 16.2) < 1.1), `drops ${a.drops}`);
  assert.equal(a.sections.at(-1)?.level, "high");
  assert.ok(a.lastHit > 38.5 && a.lastHit <= 40, `last hit ${a.lastHit}`);
  assert.equal(a.duration, 40);
});

test("a slow track folds into the 70-180 BPM range", () => {
  const a = analyzeSamples(clickTrack(40, 75, 0.4, 100), RATE);
  assert.ok(Math.abs(a.bpm - 75) < 0.6 || Math.abs(a.bpm - 150) < 1.2, `bpm ${a.bpm}`);
});

test("an effect's peak is found in its file", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "magik-peak-"));
  try {
    const rate = 48000;
    const n = rate;
    const pcm = Buffer.alloc(44 + n * 2);
    pcm.write("RIFF", 0);
    pcm.writeUInt32LE(36 + n * 2, 4);
    pcm.write("WAVEfmt ", 8);
    pcm.writeUInt32LE(16, 16);
    pcm.writeUInt16LE(1, 20);
    pcm.writeUInt16LE(1, 22);
    pcm.writeUInt32LE(rate, 24);
    pcm.writeUInt32LE(rate * 2, 28);
    pcm.writeUInt16LE(2, 32);
    pcm.writeUInt16LE(16, 34);
    pcm.write("data", 36);
    pcm.writeUInt32LE(n * 2, 40);
    // A riser: getting louder until 0.7 s, then gone.
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      const v = t < 0.7 ? (t / 0.7) ** 2 * Math.sin(2 * Math.PI * 440 * t) * 0.8 : 0;
      pcm.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
    }
    const file = path.join(dir, "riser.wav");
    await writeFile(file, pcm);
    const p = await peakOf(file);
    assert.ok(Math.abs(p.peak - 0.69) < 0.03, `peak ${p.peak}`);
    assert.ok(Math.abs(p.duration - 1) < 0.01, `duration ${p.duration}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
