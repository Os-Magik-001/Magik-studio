import assert from "node:assert/strict";
import { test } from "node:test";
import { cutStats, locate, takeAgreement, wordOverlap } from "../src/evaluate.ts";

test("locate finds a recording inside a longer one", () => {
  let seed = 7;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const hay = Float32Array.from({ length: 6000 }, noise);
  const needle = hay.slice(2345, 2345 + 1500).map((v) => v * 0.5 + noise() * 0.05);
  const { offset, score } = locate(needle, hay);
  assert.equal(offset, 2345);
  assert.ok(score > 0.9);
});

test("cut stats measure the air around cuts and the gaps between lines", () => {
  const w = (start: number, end: number) => ({ start, end, text: "mot" });
  const s = cutStats([w(0.2, 0.6), w(0.7, 1.0), w(1.5, 2.0), w(2.4, 3.0)], [1.2], 4);
  assert.equal(s.cuts, 1);
  assert.ok(Math.abs(s.headAir - 0.3) < 1e-9 && Math.abs(s.tailAir - 0.2) < 1e-9);
  assert.ok(Math.abs(s.gap - 0.45) < 1e-9, `gap ${s.gap}`);
  assert.equal(s.medianShot, 2.0);
});

test("word overlap and take agreement compare two edits", () => {
  assert.equal(wordOverlap("on lance l'app vendredi", "on lance l'app vendredi"), 1);
  assert.ok(wordOverlap("on lance l'app vendredi", "bonjour tout le monde") < 0.2);
  const ref = [{ text: "L'équipe c'est une idée de malade", at: 0, clip: "C5", sourceTime: 0.3, score: 0.9 }, { text: "Racine tu peux le faire", at: 3, clip: "C5", sourceTime: 5.7, score: 0.9 }];
  const out = [{ text: "L'équipe, c'est une idée de malade.", at: 0, clip: "C5", sourceTime: 0.35, score: 0.9 }, { text: "Racine, tu peux le faire ?", at: 2, clip: "C4", sourceTime: 8.9, score: 0.9 }];
  const a = takeAgreement(ref, out);
  assert.deepEqual([a.same, a.other, a.missing], [1, 1, 0]);
});
