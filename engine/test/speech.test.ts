import assert from "node:assert/strict";
import { test } from "node:test";
import { islands, levelAt, QUIET, quietest, SPEECH, speechMapOf, syllablesOf } from "../src/speech.ts";
import { carryTimes, DTW, placeWords, syllableCount } from "../src/words.ts";
import { voice } from "./fixtures.ts";

test("the speech map sees the words over the room, and the gaps between them", () => {
  const map = speechMapOf(voice(3, [[0.5, 0.9], [1.4, 1.8]]));
  assert.ok(Math.abs(map.duration - 3) < 0.01);
  assert.ok(levelAt(map, 0.7) > SPEECH + 10, `level in a word ${levelAt(map, 0.7)}`);
  assert.ok(levelAt(map, 1.15) < QUIET, `level in the gap ${levelAt(map, 1.15)}`);
  const isl = islands(map);
  assert.equal(isl.length, 2);
  assert.ok(Math.abs(isl[0].start - 0.5) < 0.06 && Math.abs(isl[0].end - 0.9) < 0.06, JSON.stringify(isl[0]));
});

test("a stop's closure stays inside its word, and a final release burst belongs to it", () => {
  // "get-ting": two syllables 60 ms apart; then a 30 ms burst 90 ms after a word, quiet after.
  const map = speechMapOf(voice(3, [[0.5, 0.75], [0.81, 1.0], [1.6, 1.9], [1.99, 2.02]]));
  const isl = islands(map);
  assert.equal(isl.length, 2, JSON.stringify(isl));
  assert.ok(isl[0].end > 0.95, "the closure is bridged");
  assert.ok(isl[1].end > 2.0, "the release burst is the word's");
});

test("syllables: one per vowel, with where each begins and ends", () => {
  const map = speechMapOf(voice(3, [[0.5, 0.7], [0.7, 0.9], [0.9, 1.1], [1.6, 1.9]]));
  const syl = syllablesOf(map);
  assert.equal(syl.length, 4, JSON.stringify(syl));
  assert.ok(syl[3].gapBefore && !syl[1].gapBefore);
  assert.ok(Math.abs(syl[3].on - 1.6) < 0.06 && Math.abs(syl[3].off - 1.9) < 0.06, JSON.stringify(syl[3]));
});

test("a cut goes at the quietest moment near where it was aimed", () => {
  const map = speechMapOf(voice(2, [[0.5, 0.9], [0.98, 1.3]]));
  const t = quietest(map, 0.8, 1.05, 0.85);
  assert.ok(t > 0.9 && t < 0.98, `cut at ${t}`);
});

test("syllable counts from the spelling", () => {
  assert.deepEqual(["horsepower", "jacuzzi", "came", "faire", "GLE", "53", "a"].map(syllableCount), [4, 3, 1, 1, 3, 3, 1]);
});

test("words keep their times when carried over from the timing pass, even with words missing on either side", () => {
  // The transcript's times sit on VAD's stripped timeline (1.5 s early from the third word on).
  const words = [["So", 0.5], ["we", 0.8], ["talked", 1.0], ["about", 1.3], ["it", 1.6]].map(([text, start]) => ({ text: text as string, start: start as number, end: (start as number) + 0.2 }));
  const timing = [["So", 0.52], ["um", 0.7], ["we", 0.85], ["talked", 2.55], ["it", 3.1]].map(([text, start]) => ({ text: text as string, start: start as number, end: (start as number) + 0.2 }));
  const starts = carryTimes(words, timing);
  assert.deepEqual(starts.map((t) => Math.round(t * 100) / 100), [0.52, 0.85, 2.55, 2.85, 3.1]);
});

test("words land on their own syllables when Whisper's starts run late, and end where their sound does", () => {
  // Four one-syllable words; the estimates run 0.2-0.35 s late, as whisper.cpp's DTW does.
  const truth: [number, number][] = [[0.5, 0.75], [0.85, 1.1], [1.5, 1.8], [1.88, 2.15]];
  const map = speechMapOf(voice(3, truth));
  const est = [0.75, 1.15, 1.85, 2.2];
  const placed = placeWords(["one", "two", "three.", "four"].map((text, i) => ({ text, start: est[i], end: est[i] + 0.3 })), map, DTW);
  placed.forEach((w, i) => {
    assert.ok(w.placed, `${w.text} placed`);
    assert.ok(Math.abs(w.start - truth[i][0]) < 0.06, `${w.text} starts ${w.start}, truth ${truth[i][0]}`);
    assert.ok(Math.abs(w.end - truth[i][1]) < 0.06, `${w.text} ends ${w.end}, truth ${truth[i][1]}`);
  });
});
