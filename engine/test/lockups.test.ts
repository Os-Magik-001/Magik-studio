import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { loadImage, createCanvas } from "@napi-rs/canvas";
import { frameSpans } from "../src/design.ts";
import { heroBoxes, renderLayer, type GraphicsInput } from "../src/graphics.ts";
import { chooseHero, lockupPalette, lockupScreens, shiftHue } from "../src/lockups.ts";
import type { EditPlan } from "../src/plan.ts";
import { EXTRAS } from "./fixtures.ts";

let dir: string;
before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "magik-lockups-"));
});
after(async () => {
  await rm(dir, { recursive: true, force: true });
});

// Words spoken one after another, 0.3 s each, a little longer after a sentence ends.
function spoken(text: string) {
  let t = 0;
  return text.split(" ").map((w) => {
    const word = { text: w, start: t, end: t + 0.28 };
    t += /[.?!]$/.test(w) ? 0.6 : 0.3;
    return word;
  });
}
const heroOf = (l: { words: { text: string }[]; hero: [number, number] | null }) => (l.hero ? l.words.slice(l.hero[0], l.hero[1] + 1).map((w) => w.text).join(" ") : null);

test("phrases become lockups around one key word, highlight words first", () => {
  const ls = lockupScreens(spoken("And make major decisions today. Houses appreciate. We do the lash lift."), ["lash lift"]);
  assert.deepEqual(ls.map((l) => l.words.map((w) => w.text).join(" ")), ["And make major decisions today.", "Houses appreciate.", "We do the lash lift."]);
  assert.deepEqual(ls.map(heroOf), ["decisions", "appreciate.", "lash lift."]);
  // A one-word opener over its key word gets the script lead-in.
  assert.equal(ls[1].look, "script");
  // Each lockup holds until the next.
  assert.equal(ls[0].end, ls[1].start);
});

test("French elisions go to the lead-in and highlight words match without them", () => {
  const [l] = lockupScreens(spoken("Tu n'as pas besoin d'extension."), ["extension"]);
  assert.deepEqual(l.words.map((w) => w.text), ["Tu", "n'as", "pas", "besoin", "d'", "extension."]);
  assert.equal(heroOf(l), "extension.");
});

test("numbers stay whole and keep their unit; weak phrases are plain lines", () => {
  const ls = lockupScreens(spoken("Just 12 hours after. And it was 10 ,000 dollars. and it went"), []);
  assert.equal(heroOf(ls[0]), "12 hours");
  assert.equal(ls[0].look, "wide");
  assert.equal(heroOf(ls[1]), "10,000 dollars.");
  assert.equal(ls[2].hero, null);
  assert.equal(ls[2].look, "line");
});

test("a word that was just the key word counts less the next time", () => {
  const words = spoken("pas besoin de rien");
  assert.deepEqual(chooseHero(words, []), [1, 1]);
  assert.equal(chooseHero(words, [], ["besoin"]), null);
});

test("lockup colours: the brand's second colour, else a neighbouring hue", () => {
  const c = { ...EXTRAS.captions, color: "#FFFFFF", highlight_color: "#F06AC8" } as EditPlan["captions"];
  assert.equal(lockupPalette(c, { colors: ["#FFFFFF", "#F06AC8", "#2B6CB0"] }).second, "#2B6CB0");
  const own = lockupPalette(c, { colors: [] });
  assert.notEqual(own.second, own.hi);
  assert.equal(shiftHue("#FF0000", 120).toUpperCase(), "#00FF00");
});

async function alphaCount(list: string) {
  const files = [...(await readFile(list, "utf8")).matchAll(/file '([^']+)'/g)].map((m) => m[1]);
  let n = 0;
  for (const f of new Set(files)) {
    const img = await loadImage(f);
    const c = createCanvas(img.width, img.height);
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, img.width, img.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++;
  }
  return n;
}

test("mixed_type draws the key word on the behind layer, or in front when the person would cover it", async () => {
  const plan = {
    ...EXTRAS,
    captions: { ...EXTRAS.captions, mode: "auto", preset: "mixed_type", position: "center", size: "medium", case: "as_spoken", color: "#FFFFFF", highlight_color: "#3AA7E8", highlight_words: [] },
    on_screen_text: [],
  } as unknown as EditPlan;
  const words = spoken("I positioned this home strategically.");
  const input: GraphicsInput = { plan, words, W: 270, H: 480, length: 2, fps: 10, brand: { colors: [], fonts: [] }, behindCaptions: true };
  const boxes = heroBoxes(input);
  assert.equal(boxes.length, 2, "two lockups: the phrase is over 34 characters");
  for (const b of boxes) assert.ok(b.box.w > 270 * 0.5 && b.box.w <= 270 * 0.9, "the key word fills most of the width");
  const behind = await alphaCount((await renderLayer(input, "behind", path.join(dir, "b"))).list);
  const front = await alphaCount((await renderLayer(input, "front", path.join(dir, "f"))).list);
  assert.ok(behind > 0, "the key word is drawn behind");
  const moved = { ...input, heroFront: new Set(boxes.map((b) => b.index)) };
  const frontAll = await alphaCount((await renderLayer(moved, "front", path.join(dir, "f2"))).list);
  const behindNone = await alphaCount((await renderLayer(moved, "behind", path.join(dir, "b2"))).list);
  assert.equal(behindNone, 0);
  assert.ok(frontAll > front, "the covered key word moves to the front layer");
});

test("design pass: frames with text behind the person become padded, joined ranges", () => {
  assert.deepEqual(frameSpans([10, 11, 12, 15, 40], 100), [[8, 18], [38, 43]]);
  assert.deepEqual(frameSpans([0, 99], 100), [[0, 3], [97, 100]]);
});
