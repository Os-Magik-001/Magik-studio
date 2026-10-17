import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { contactSheets, probe } from "../src/media.ts";
import { validatePlan, type Clip, type EditPlan } from "../src/plan.ts";
import { render } from "../src/render.ts";
import { CUT, makeClip, makeLogo, shot } from "./fixtures.ts";

let dir: string;
let clips: Clip[];
let logo: string;

before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "magik-render-"));
  const specs = [
    { label: "LATTE POUR", w: 1280, h: 720, seconds: 6, tone: 440, color: "#8B5A2B" },
    { label: "BARISTA SMILE", w: 720, h: 1280, seconds: 5, tone: null, color: "#2E6BD8" },
    { label: "CAFE WIDE", w: 1280, h: 720, seconds: 4, tone: 660, color: "#2F7D4F" },
  ];
  clips = [];
  for (const [i, s] of specs.entries()) {
    const file = path.join(dir, `clip${i + 1}.mp4`);
    await makeClip({ ...s, file });
    const p = await probe(file);
    clips.push({ id: `C${i + 1}`, fileName: path.basename(file), file, duration: p.duration, width: p.width, height: p.height, fps: p.fps, hasAudio: p.hasAudio, sheets: [], interval: 1, transcript: null });
  }
  logo = path.join(dir, "logo.png");
  await makeLogo(logo);
});

after(() => rm(dir, { recursive: true, force: true }));

test("probe reads size, length and sound", () => {
  assert.equal(clips[0].width, 1280);
  assert.equal(clips[1].height, 1280);
  assert.ok(Math.abs(clips[0].duration - 6) < 0.2);
  assert.equal(clips[0].hasAudio, true);
  assert.equal(clips[1].hasAudio, false);
});

test("contact sheets sample every clip", async () => {
  const sheets = await contactSheets(clips[0].file, path.join(dir, "sheets"), 1);
  assert.equal(sheets.length, 1); // 6 frames fit in one 3x3 sheet
});

test("validatePlan keeps shots inside the footage", () => {
  const plan: EditPlan = {
    look: "natural",
    summary: "",
    segments: [
      shot("c1", -2, 2, "hook"),
      shot("C9", 0, 2, "unknown clip"),
      shot("C2", 4.9, 99, "runs past the end"),
      shot("C3", 1, 1.1, "too short"),
    ],
    on_screen_text: [{ text: "  ", start: 0, end: 1, style: "caption", position: "bottom" }],
    end_card: { include: true, headline: " ", seconds: 30, transition: CUT },
    open_questions: [],
  };
  const { plan: fixed, problems, length } = validatePlan(plan, clips);
  assert.deepEqual(
    fixed.segments.map((s) => [s.clip, s.start]),
    [["C1", 0]],
  );
  assert.equal(problems.length, 3);
  assert.equal(fixed.end_card.seconds, 5);
  assert.equal(fixed.end_card.headline, null);
  assert.equal(fixed.on_screen_text.length, 0);
  assert.ok(Math.abs(length - 7) < 0.01);
});

test("renders a vertical cut with captions, a title and a branded end card", async () => {
  const plan: EditPlan = {
    look: "natural",
    summary: "test",
    segments: [
      shot("C1", 1, 3.5, "hook"),
      shot("C2", 0.5, 3, "barista, no sound"),
      shot("C3", 0, 2, "wide"),
    ],
    on_screen_text: [
      { text: "Pumpkin latte is back", start: 0, end: 2.5, style: "title", position: "top" },
      { text: "Made fresh every morning, with real pumpkin and a little cinnamon", start: 2.5, end: 7, style: "caption", position: "bottom" },
    ],
    end_card: { include: true, headline: "Available now", seconds: 2, transition: CUT },
    open_questions: [],
  };
  const { plan: valid, length } = validatePlan(plan, clips);
  const output = path.join(dir, "cut.mp4");
  await render({ plan: valid, clips, aspect: "9:16", brand: { colors: ["#1E1D1B", "#F2C14E"], fonts: ["Inter"], logoFile: logo }, workDir: dir, output });

  const out = await probe(output);
  assert.equal(out.width, 1080);
  assert.equal(out.height, 1920);
  assert.equal(out.hasAudio, true);
  assert.ok(Math.abs(out.duration - length) < 0.25, `duration ${out.duration} vs planned ${length}`);
  if (process.env.KEEP_RENDER) {
    const { copyFile } = await import("node:fs/promises");
    await copyFile(output, process.env.KEEP_RENDER);
  }
});

test("renders every move: transitions, speed, punch-ins, reframing, fixes and a look", async () => {
  const plan: EditPlan = {
    look: "warm",
    summary: "moves",
    segments: [
      shot("C1", 0, 2, "hook, slow push in", { zoom: { start: 1, end: 1.4 }, focus: { x: 0.3, y: 0.6 } }),
      shot("C2", 0, 2, "slow motion, muted", { speed: 0.5, audio: "mute", transition_in: { type: "crossfade", seconds: 0.5 } }),
      shot("C3", 0, 3, "sped up, static punch-in", { speed: 2, zoom: { start: 1.3, end: 1.3 }, adjust: { brightness: 0.05, contrast: 1.1, saturation: 1.2 }, transition_in: { type: "slide_left", seconds: 0.3 } }),
      shot("C1", 3, 5, "hard cut back"),
    ],
    on_screen_text: [{ text: "Moves", start: 0, end: 2, style: "title", position: "center" }],
    end_card: { include: true, headline: "The end", seconds: 1.5, transition: { type: "dip_to_black", seconds: 0.4 } },
    open_questions: [],
  };
  const { plan: valid, length, problems } = validatePlan(plan, clips);
  assert.deepEqual(problems, []);
  // 2 + 4 + 1.5 + 2 + 1.5 seconds of pieces, minus 0.5 + 0.3 + 0.4 of overlaps.
  assert.ok(Math.abs(length - 9.8) < 0.01, `length ${length}`);
  const output = path.join(dir, "moves.mp4");
  await render({ plan: valid, clips, aspect: "9:16", brand: { colors: ["#1E1D1B"], fonts: [], logoFile: logo }, workDir: dir, output });

  const out = await probe(output);
  assert.equal(out.width, 1080);
  assert.equal(out.height, 1920);
  assert.ok(Math.abs(out.duration - length) < 0.25, `duration ${out.duration} vs planned ${length}`);
  if (process.env.KEEP_RENDER) {
    const { copyFile } = await import("node:fs/promises");
    await copyFile(output, process.env.KEEP_RENDER.replace(/(\.mp4)?$/, "-moves.mp4"));
  }
});

test("validatePlan reins in moves", () => {
  const plan: EditPlan = {
    look: "natural",
    summary: "",
    segments: [
      shot("C1", 0, 2, "first shot can't transition in", { transition_in: { type: "crossfade", seconds: 1 } }),
      shot("C2", 0, 4, "wild values", { speed: 9, zoom: { start: 0.2, end: 7 }, focus: { x: -1, y: 2 }, adjust: { brightness: 1, contrast: 0, saturation: 5 }, transition_in: { type: "crossfade", seconds: 5 } }),
      shot("C3", 0, 0.5, "too short once slowed? no: 0.5s at 0.25x is 2s", { speed: 0.1 }),
    ],
    on_screen_text: [],
    end_card: { include: false, headline: null, seconds: 0, transition: { type: "zoom_in", seconds: 1 } },
    open_questions: [],
  };
  const { plan: fixed } = validatePlan(plan, clips);
  const [a, b, c] = fixed.segments;
  assert.deepEqual(a.transition_in, CUT);
  assert.equal(b.speed, 4);
  assert.deepEqual(b.zoom, { start: 1, end: 2.5 });
  assert.deepEqual(b.focus, { x: 0, y: 1 });
  assert.deepEqual(b.adjust, { brightness: 0.3, contrast: 0.7, saturation: 2 });
  // Capped at 40% of the shorter neighbour: shot 2 lasts 4s / 4 = 1s.
  assert.deepEqual(b.transition_in, { type: "crossfade", seconds: 0.4 });
  assert.equal(c.speed, 0.25);
  assert.deepEqual(fixed.end_card.transition, CUT);
});
