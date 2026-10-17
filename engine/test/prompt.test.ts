import assert from "node:assert/strict";
import { test } from "node:test";
import { annotate, buildContent, buildSystem, parseStoredPlan, type EditPlan, type PlanInput } from "../src/plan.ts";
import { CUT, EXTRAS, shot, txt } from "./fixtures.ts";

const plan: EditPlan = {
  ...EXTRAS,
  look: "natural",
  summary: "",
  segments: [
    shot("C1", 0.5, 2.5, "hook"),
    shot("C2", 0, 2, "barista"),
  ],
  on_screen_text: [],
  end_card: { include: true, headline: "Available now", seconds: 1.5, transition: CUT },
  open_questions: [],
};

const input: PlanInput = {
  clientName: "QA Coffee",
  title: "Launch",
  format: "social short",
  aspect: "9:16",
  brief: "30s short",
  script: "Hook on the pour.",
  shots: ["Pour"],
  brandKit: { colors: ["#111111"], fonts: [], musicMood: null, styleRules: "Captions always on.", hasLogo: true },
  instructions: "Client note: warmer",
  source: "client_changes",
  skills: [],
  clips: [],
  previous: {
    number: 1,
    plan,
    comments: [
      { timecodeMs: 2500, body: "Longer barista shot", fromClient: true },
      { timecodeMs: 4200, body: "Bigger logo", fromClient: false },
      { timecodeMs: null, body: "Love the hook", fromClient: true },
    ],
  },
};

test("revision prompt pins each comment to the shot it falls on", async () => {
  const blocks = await buildContent(input);
  const text = blocks.map((b) => (b.type === "text" ? b.text : "")).join("\n");
  assert.match(text, /Client at 2\.5s → shot 2 \(C2 at 0\.5s\): Longer barista shot/);
  assert.match(text, /Editor at 4\.2s → the end card: Bigger logo/);
  assert.match(text, /Client, general: Love the hook/);
  assert.match(text, /End card: 4\.0s–5\.5s/);
  assert.match(text, /Style rules: Captions always on\./);
  assert.match(text, /What was asked for this revision:\nClient note: warmer/);
  assert.match(text, /Address every open comment/);
});

test("the timeline accounts for speed and transitions when pinning comments", async () => {
  const moved: EditPlan = {
    ...plan,
    segments: [
      shot("C1", 0, 1, "slow hook", { speed: 0.5 }),
      shot("C2", 0, 2, "barista", { transition_in: { type: "crossfade", seconds: 0.5 } }),
    ],
    end_card: { include: true, headline: null, seconds: 1, transition: { type: "dip_to_black", seconds: 0.5 } },
  };
  const blocks = await buildContent({
    ...input,
    previous: { number: 2, plan: moved, comments: [{ timecodeMs: 1000, body: "a", fromClient: true }, { timecodeMs: 3000, body: "b", fromClient: true }, { timecodeMs: 3600, body: "c", fromClient: true }] },
  });
  const text = blocks.map((b) => (b.type === "text" ? b.text : "")).join("\n");
  assert.match(text, /1\. 0\.0s–2\.0s on the timeline = C1 0\.0s–1\.0s at 0\.5x/);
  assert.match(text, /2\. 1\.5s–3\.5s on the timeline/);
  assert.match(text, /at 1\.0s → shot 1 \(C1 at 0\.5s\): a/);
  assert.match(text, /at 3\.0s → shot 2 \(C2 at 1\.5s\): b/);
  assert.match(text, /at 3\.6s → the end card: c/);
  assert.match(text, /End card: 3\.0s–4\.0s/);
});

test("older saved plans read as plain hard cuts", () => {
  const old = { summary: "", segments: [{ clip: "C1", start: 0, end: 2, purpose: "hook" }], on_screen_text: [], end_card: { include: false, headline: null, seconds: 0 }, open_questions: [] };
  const parsed = parseStoredPlan(old);
  assert.equal(parsed?.look, "natural");
  assert.equal(parsed?.segments[0].speed, 1);
  assert.deepEqual(parsed?.end_card.transition, CUT);
  assert.equal(parseStoredPlan({ nonsense: true }), null);
});

test("skills are added to Claude's instructions", () => {
  assert.doesNotMatch(buildSystem([]), /Editing skills/);
  const system = buildSystem([{ name: "hooks", description: "d", formats: "all", enabled: true, body: "Open on the pour." }]);
  assert.match(system, /# Editing skills\n\n<skill name="hooks">\nOpen on the pour\.\n<\/skill>/);
});

test("each clip says how far it can be punched in before it goes soft", async () => {
  const clip = (id: string, width: number, height: number) => ({ id, fileName: `${id}.mp4`, file: "", preview: "", duration: 5, width, height, fps: 30, hasAudio: false, sheets: [], interval: 1, transcript: null });
  const blocks = await buildContent({ ...input, aspect: "9:16", previous: null, clips: [clip("C1", 2160, 3840), clip("C2", 1080, 1920), clip("C3", 1920, 1080)] });
  const text = blocks.map((b) => (b.type === "text" ? b.text : "")).join("\n");
  assert.match(text, /Clip C1 .*stays sharp up to zoom 2\.00/);
  assert.match(text, /Clip C2 .*fills the frame at its own resolution/);
  assert.match(text, /Clip C3 .*already enlarged 1\.8x to fill 9:16/);
});

test("transcripts mark fillers, stutters and pauses for the cut", () => {
  const line = { start: 0, end: 3, text: "euh on en en parle", words: [
    { text: "euh", start: 0, end: 0.2 }, { text: "on", start: 0.3, end: 0.4 }, { text: "en", start: 0.45, end: 0.5 },
    { text: "en", start: 0.55, end: 0.6 }, { text: "parle", start: 1.2, end: 1.6 },
  ] };
  const out = annotate(line);
  assert.match(out, /\[filler "euh" 0\.00–0\.20\]/);
  assert.match(out, /\[repeat "en" 0\.55–0\.60\]/);
  assert.match(out, /\[pause 0\.6s\]/);
});
