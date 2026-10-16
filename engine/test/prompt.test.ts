import assert from "node:assert/strict";
import { test } from "node:test";
import { buildContent, type EditPlan, type PlanInput } from "../src/plan.ts";

const plan: EditPlan = {
  summary: "",
  segments: [
    { clip: "C1", start: 0.5, end: 2.5, purpose: "hook" },
    { clip: "C2", start: 0, end: 2, purpose: "barista" },
  ],
  on_screen_text: [],
  end_card: { include: true, headline: "Available now", seconds: 1.5 },
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
