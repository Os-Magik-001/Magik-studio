import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { contactSheets, probe } from "../src/media.ts";
import { timelineWords, validatePlan, type Clip, type EditPlan } from "../src/plan.ts";
import { render } from "../src/render.ts";
import { translatedScreens } from "../src/graphics.ts";
import { CUT, EXTRAS, makeClip, makeLogo, shot, txt } from "./fixtures.ts";

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
    clips.push({ id: `C${i + 1}`, fileName: path.basename(file), file, preview: file, duration: p.duration, width: p.width, height: p.height, fps: p.fps, hasAudio: p.hasAudio, sheets: [], interval: 1, transcript: null });
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
    ...EXTRAS,
    look: "natural",
    summary: "",
    segments: [
      shot("c1", -2, 2, "hook"),
      shot("C9", 0, 2, "unknown clip"),
      shot("C2", 4.9, 99, "runs past the end"),
      shot("C3", 1, 1.1, "too short"),
    ],
    on_screen_text: [txt("  ", 0, 1, "caption", "bottom")],
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
    ...EXTRAS,
    look: "natural",
    summary: "test",
    segments: [
      shot("C1", 1, 3.5, "hook"),
      shot("C2", 0.5, 3, "barista, no sound"),
      shot("C3", 0, 2, "wide"),
    ],
    on_screen_text: [
      txt("Pumpkin latte is back", 0, 2.5, "title", "top"),
      txt("Made fresh every morning, with real pumpkin and a little cinnamon", 2.5, 7, "caption", "bottom"),
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
    ...EXTRAS,
    look: "warm",
    summary: "moves",
    segments: [
      shot("C1", 0, 2, "hook, slow push in", { zoom: { start: 1, end: 1.4 }, focus: { x: 0.3, y: 0.6 } }),
      shot("C2", 0, 2, "slow motion, muted", { speed: 0.5, audio: "mute", transition_in: { type: "crossfade", seconds: 0.5 } }),
      shot("C3", 0, 3, "sped up, static punch-in", { speed: 2, zoom: { start: 1.3, end: 1.3 }, adjust: { brightness: 0.05, contrast: 1.1, saturation: 1.2 }, transition_in: { type: "slide_left", seconds: 0.3 } }),
      shot("C1", 3, 5, "hard cut back"),
    ],
    on_screen_text: [txt("Moves", 0, 2, "title", "center")],
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
    ...EXTRAS,
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

test("finishing pass: auto captions, animated text, graphics, overlays and sound effects", async () => {
  const words = [
    { text: "Pumpkin", start: 0.2, end: 0.6 },
    { text: "latte", start: 0.6, end: 1.0 },
    { text: "is", start: 1.1, end: 1.3 },
    { text: "back.", start: 1.3, end: 1.8 },
  ];
  const withWords = clips.map((c) => (c.id === "C1" ? { ...c, transcript: [{ start: 0.2, end: 1.8, text: "Pumpkin latte is back.", words }] } : c));
  const plan: EditPlan = {
    ...EXTRAS,
    look: "warm",
    summary: "everything",
    segments: [shot("C1", 0, 3, "hook"), shot("C2", 0, 2, "barista"), shot("C3", 0, 2, "wide", { transition_in: { type: "slide_left", seconds: 0.3 } })],
    captions: { ...EXTRAS.captions, mode: "auto", preset: "bold_pop", position: "center", highlight_words: ["latte"] },
    on_screen_text: [
      txt("Claude did.", 0, 1.5, "title", "top", { animation: "pop", accent: "did." }),
      txt("BACK", 1.4, 2.6, "hero", "top", { behind_subject: true }),
      txt("we roast it\nevery morning", 3.0, 5.0, "stacked", "top", { animation: "slide_up" }),
      txt("Comment LATTE", 5.2, 6.7, "boxed", "top", { animation: "typewriter" }),
    ],
    graphics: [
      { kind: "progress_bar", start: 0, end: 6.7, text: "", x: 0.5, y: 0.02, size: 1 },
      { kind: "counter", start: 3.0, end: 4.5, text: "0|351000", x: 0.5, y: 0.5, size: 1 },
      { kind: "comment_cta", start: 5.2, end: 6.7, text: "latte", x: 0.5, y: 0.65, size: 1 },
      { kind: "circle", start: 1.0, end: 2.0, text: "", x: 0.5, y: 0.45, size: 1 },
    ],
    overlays: [
      { kind: "card", clip: "C3", start: 1, end: 2.5, at: 3.2, still: true, focus: { x: 0.5, y: 0.5 }, x: 0.5, y: 0.3, width: 0.5, tilt: -4 },
      { kind: "cutaway", clip: "C2", start: 2, end: 3, at: 1.9, still: false, focus: { x: 0.5, y: 0.5 }, x: 0.5, y: 0.5, width: 1, tilt: 0 },
    ],
    sfx: [{ kind: "whoosh", at: 5 }, { kind: "pop", at: 1.4 }, { kind: "hit", at: 3 }],
    end_card: { include: false, headline: null, seconds: 0, transition: CUT },
    open_questions: [],
  };
  const { plan: valid, length, problems } = validatePlan(plan, withWords);
  assert.deepEqual(problems, []);
  assert.equal(valid.on_screen_text.length, 4);
  const output = path.join(dir, "finish.mp4");
  await render({ plan: valid, clips: withWords, aspect: "9:16", brand: { colors: ["#1E1D1B"], fonts: [], logoFile: null }, workDir: path.join(dir, "finish"), output, words: timelineWords(valid, withWords) });
  const out = await probe(output);
  assert.equal(out.width, 1080);
  assert.equal(out.hasAudio, true);
  assert.ok(Math.abs(out.duration - length) < 0.25, `duration ${out.duration} vs planned ${length}`);
  if (process.env.KEEP_RENDER) {
    const { copyFile } = await import("node:fs/promises");
    await copyFile(output, process.env.KEEP_RENDER.replace(/(\.mp4)?$/, "-finish.mp4"));
  }
});

test("series episode: translated subtitles, a dripping logo and a glitch transition", async () => {
  // French speech, English subtitles: the translated words build up over the French ones.
  const words = [
    { text: "Les", start: 0.2, end: 0.4 },
    { text: "gars,", start: 0.4, end: 0.8 },
    { text: "on", start: 0.9, end: 1.0 },
    { text: "lance", start: 1.0, end: 1.4 },
    { text: "l'app.", start: 1.4, end: 1.9 },
  ];
  const withWords = clips.map((c) => (c.id === "C1" ? { ...c, transcript: [{ start: 0.2, end: 1.9, text: "Les gars, on lance l'app.", words }] } : c));
  const plan: EditPlan = {
    ...EXTRAS,
    look: "natural",
    summary: "episode",
    segments: [shot("C1", 0, 2.5, "dialogue"), shot("C3", 0, 2, "new character", { transition_in: { type: "glitch", seconds: 0.6 } })],
    captions: { ...EXTRAS.captions, mode: "translate", preset: "subtitle", words_per_screen: 12, position: "bottom", size: "medium" },
    on_screen_text: [
      txt("Guys, we're launching the app.", 0.2, 2.1, "caption", "bottom"),
      txt("THE BOYZ\nEPISODE 14", 0, 2.0, "drip", "top", { behind_subject: true }),
      txt("ERU", 2.6, 4.0, "hero", "center", { animation: "pop" }),
    ],
    end_card: { include: false, headline: null, seconds: 0, transition: CUT },
    open_questions: [],
  };
  const { plan: valid, length, problems } = validatePlan(plan, withWords);
  assert.deepEqual(problems, []);
  assert.equal(valid.captions.words_per_screen, 8);
  assert.deepEqual(valid.segments[1].transition_in, { type: "glitch", seconds: 0.35 });
  assert.equal(valid.on_screen_text.filter((t) => t.style === "caption").length, 1, "translate mode keeps the written subtitles");
  assert.equal(valid.on_screen_text.find((t) => t.style === "drip")?.behind_subject, true);

  const screens = translatedScreens(valid.on_screen_text.filter((t) => t.style === "caption"), timelineWords(valid, withWords));
  assert.equal(screens.length, 1);
  assert.deepEqual(screens[0].words.map((w) => w.start), [0.2, 0.4, 0.9, 1.0, 1.4], "five English words spread over five French ones");

  const output = path.join(dir, "episode.mp4");
  await render({ plan: valid, clips: withWords, aspect: "9:16", brand: { colors: [], fonts: [], logoFile: null }, workDir: path.join(dir, "episode"), output, words: timelineWords(valid, withWords) });
  const out = await probe(output);
  assert.equal(out.height, 1920);
  assert.ok(Math.abs(out.duration - length) < 0.25, `duration ${out.duration} vs planned ${length}`);
  if (process.env.KEEP_RENDER) {
    const { copyFile } = await import("node:fs/promises");
    await copyFile(output, process.env.KEEP_RENDER.replace(/(\.mp4)?$/, "-episode.mp4"));
  }
});

test("freeze frames hold a still and motion graphics render over it", async (t) => {
  const { motionAvailable } = await import("../src/motion.ts");
  const plan: EditPlan = {
    ...EXTRAS,
    look: "natural",
    summary: "motion",
    on_screen_text: [],
    segments: [shot("C1", 0, 1.5, "talk"), shot("C1", 1.4, 1.5, "freeze", { hold: 2 }), shot("C3", 0, 1.5, "after")],
    motion: [
      { template: "character_intro", start: 1.5, end: 3.5, title: "GHOST", subtitle: "the ads guy", lines: ["ADS|96", "SLEEP|8"], people: [], accent: "#E0222B", position: "center" },
      { template: "title_3d", start: 3.5, end: 5, title: "EPISODE 2", subtitle: "tomorrow", lines: [], people: [], accent: null, position: "top" },
    ],
    end_card: { include: false, headline: null, seconds: 0, transition: CUT },
    open_questions: [],
  };
  const { plan: valid, length } = validatePlan(plan, clips);
  assert.equal(valid.segments[1].hold, 2);
  assert.ok(Math.abs(valid.segments[1].end - valid.segments[1].start - 0.1) < 0.001, "a freeze only needs one frame");
  assert.ok(Math.abs(length - 5) < 0.01, `length ${length}`);
  assert.equal(valid.motion.length, 2);
  if (!(await motionAvailable())) return t.skip("no Chrome to render motion graphics");
  const output = path.join(dir, "motion.mp4");
  await render({ plan: valid, clips, aspect: "9:16", brand: { colors: [], fonts: [], logoFile: null }, workDir: path.join(dir, "motion"), output });
  const out = await probe(output);
  assert.ok(Math.abs(out.duration - length) < 0.25, `duration ${out.duration} vs planned ${length}`);
  if (process.env.KEEP_RENDER) {
    const { copyFile } = await import("node:fs/promises");
    await copyFile(output, process.env.KEEP_RENDER.replace(/(\.mp4)?$/, "-motion.mp4"));
  }
});

test("timeline words follow the cut, speed and muting", () => {
  const words = [{ text: "a", start: 1.0, end: 1.2 }, { text: "b", start: 2.0, end: 2.2 }, { text: "c", start: 3.5, end: 3.7 }];
  const withWords = clips.map((c) => (c.id === "C1" ? { ...c, transcript: [{ start: 1, end: 3.7, text: "a b c", words }] } : c));
  const plan: EditPlan = { ...EXTRAS, look: "natural", summary: "", segments: [shot("C1", 1.5, 3, "slow", { speed: 0.5 }), shot("C1", 3.4, 4, "muted", { audio: "mute" })], on_screen_text: [], end_card: { include: false, headline: null, seconds: 0, transition: CUT }, open_questions: [] };
  const tw = timelineWords(plan, withWords);
  assert.deepEqual(tw.map((w) => w.text), ["b"]);
  assert.ok(Math.abs(tw[0].start - 1.0) < 0.01, `b at ${tw[0].start}`); // (2.0 - 1.5) / 0.5
});
