import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { contactSheets, probe } from "../src/media.ts";
import { validatePlan, type Clip, type EditPlan } from "../src/plan.ts";
import { render } from "../src/render.ts";
import { makeClip, makeLogo } from "./fixtures.ts";

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
    clips.push({ id: `C${i + 1}`, fileName: path.basename(file), file, duration: p.duration, width: p.width, height: p.height, hasAudio: p.hasAudio, sheets: [], interval: 1, transcript: null });
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
    summary: "",
    segments: [
      { clip: "c1", start: -2, end: 2, purpose: "hook" },
      { clip: "C9", start: 0, end: 2, purpose: "unknown clip" },
      { clip: "C2", start: 4.9, end: 99, purpose: "runs past the end" },
      { clip: "C3", start: 1, end: 1.1, purpose: "too short" },
    ],
    on_screen_text: [{ text: "  ", start: 0, end: 1, style: "caption", position: "bottom" }],
    end_card: { include: true, headline: " ", seconds: 30 },
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
    summary: "test",
    segments: [
      { clip: "C1", start: 1, end: 3.5, purpose: "hook" },
      { clip: "C2", start: 0.5, end: 3, purpose: "barista, no sound" },
      { clip: "C3", start: 0, end: 2, purpose: "wide" },
    ],
    on_screen_text: [
      { text: "Pumpkin latte is back", start: 0, end: 2.5, style: "title", position: "top" },
      { text: "Made fresh every morning, with real pumpkin and a little cinnamon", start: 2.5, end: 7, style: "caption", position: "bottom" },
    ],
    end_card: { include: true, headline: "Available now", seconds: 2 },
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
