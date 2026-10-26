import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import { loadImage } from "@napi-rs/canvas";
import { renderLayer, type GraphicsInput } from "../src/graphics.ts";
import type { EditPlan } from "../src/plan.ts";
import { canvasFont, motionFaces, parseTypography, readableOn, TYPEFACES, type FontRole, type Typography } from "../src/typefaces.ts";
import { COLOR_ROLES, FONT_ROLES, TYPE_FONTS, TYPE_PRESETS } from "../../src/lib/typography.ts";
import { EXTRAS, txt } from "./fixtures.ts";

const FONTS = fileURLToPath(new URL("../assets/fonts", import.meta.url));
const OCEAN = TYPE_PRESETS[0].typography as Typography;

let dir: string;
before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "magik-type-"));
});
after(async () => {
  await rm(dir, { recursive: true, force: true });
});

test("every font the app offers is one the engine has, with its files", async () => {
  for (const role of FONT_ROLES.map((r) => r.id) as FontRole[]) {
    const engine = TYPEFACES[role] as Record<string, { file: string; weight: number; heavy?: string }>;
    for (const f of TYPE_FONTS[role]) {
      assert.ok(engine[f.id], `${role} ${f.id} is missing in the engine`);
      assert.equal(engine[f.id].weight, f.weight, `${role} ${f.id} weight`);
      await access(path.join(FONTS, engine[f.id].file));
      if (engine[f.id].heavy) await access(path.join(FONTS, engine[f.id].heavy!));
    }
    assert.deepEqual(Object.keys(engine).sort(), TYPE_FONTS[role].map((f) => f.id).sort(), `${role}: same fonts in the app and the engine`);
  }
  for (const p of TYPE_PRESETS) assert.ok(parseTypography(p.typography), p.name);
});

test("a saved choice is read back; unknown fonts fall back, broken ones are ignored", () => {
  assert.equal(parseTypography(null), null);
  const warned: string[] = [];
  assert.equal(parseTypography({ fonts: { title: "anton" } }, (m) => warned.push(m)), null);
  assert.equal(warned.length, 1);
  const t = parseTypography({ ...OCEAN, fonts: { ...OCEAN.fonts, title: "druk" } }, (m) => warned.push(m));
  assert.equal(t?.fonts.title, "anton");
  assert.match(warned[1], /druk/);
  assert.deepEqual(Object.keys(t!.colors), [...COLOR_ROLES.map((r) => r.id)]);
});

test("the motion templates' families point at the chosen files", () => {
  const css = motionFaces(OCEAN);
  for (const family of ["Magik Heavy", "Magik Display", "Magik Sans", "Magik Serif", "Magik Elegant"]) assert.ok(css.includes(`"${family}"`), family);
  assert.ok(css.includes("Anton-Regular.ttf"));
  assert.ok(css.includes("BodoniModa-SemiBoldItalic.ttf"));
  assert.ok(css.includes('"Magik Sans"; src: url("/fonts/Montserrat-SemiBold.ttf"); font-weight: 600;'));
  assert.ok(css.includes('"Magik Sans"; src: url("/fonts/Anton-Regular.ttf"); font-weight: 800;'));
  assert.match(canvasFont(OCEAN, "text", 60, true), /Magik text montserrat heavy/);
});

test("text on a box stays readable", () => {
  assert.equal(readableOn("#103C62", "#F8F7F2"), "#F8F7F2");
  assert.equal(readableOn("#F8F7F2", "#FFFFFF"), "#141413");
  assert.equal(readableOn("#111111", "#141413"), "#FFFFFF");
});

// The color of the most common non-transparent pixel in a frame.
async function inkOf(file: string) {
  const img = await loadImage(await readFile(file));
  const { createCanvas } = await import("@napi-rs/canvas");
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, img.width, img.height).data;
  const counts = new Map<string, number>();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 255) continue;
    const k = `#${[d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

test("titles and captions are drawn in the chosen colors", async () => {
  const plan = {
    ...EXTRAS,
    captions: { ...EXTRAS.captions, mode: "off" },
    on_screen_text: [txt("Comment j'ai ouvert ma clinique", 0, 1, "title", "center", { accent: "ouvert", color: "#FF0000" })],
  } as unknown as EditPlan;
  const input: GraphicsInput = { plan, words: [], W: 540, H: 960, length: 1, fps: 30, brand: { colors: [], fonts: [], typography: OCEAN } };
  const layer = await renderLayer(input, "front", path.join(dir, "title"));
  const first = (await readFile(layer.list, "utf8")).match(/file '([^']+)'/)![1];
  // The title color wins over the plan's red.
  assert.equal(await inkOf(first), OCEAN.colors.title);
});
