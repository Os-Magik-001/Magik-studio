import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { run } from "../src/exec.ts";
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

test("the editor is told the client's other videos when there are some", async () => {
  const text = async (memory: string | null) => (await buildContent({ ...input, memory })).map((b) => (b.type === "text" ? b.text : "")).join("\n");
  assert.match(await text('1 other video for this client, oldest first.\n\n### "Episode 1"'), /The client's other videos \(the studio's memory[^\n]*\n1 other video for this client/);
  assert.doesNotMatch(await text(null), /the studio's memory/);
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
  const system = buildSystem([{ name: "hooks", description: "d", formats: "all", enabled: true, style: "any", when: [], agents: ["editor"], body: "Open on the pour." }]);
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

test("cut times come from the words Claude quotes, not from its seconds", async () => {
  const { findWords } = await import("../src/plan.ts");
  const words = [
    { text: "Les", start: 1.0, end: 1.2 }, { text: "boys,", start: 1.2, end: 1.6 }, { text: "on", start: 1.7, end: 1.8 }, { text: "lance", start: 1.8, end: 2.2 }, { text: "l'app.", start: 2.2, end: 2.8 },
    { text: "Les", start: 9.0, end: 9.2 }, { text: "boys,", start: 9.2, end: 9.6 }, { text: "on", start: 9.7, end: 9.8 }, { text: "lance", start: 9.8, end: 10.2 }, { text: "l'app.", start: 10.2, end: 10.8 },
  ];
  // Two takes of the line: the one near where Claude placed the shot wins.
  assert.deepEqual(findWords("Les boys, on lance l'app.", words, 8.5), { start: 9.0, end: 10.8 });
  // Accents, punctuation and a dropped middle word don't break the match.
  assert.deepEqual(findWords("les boys on lance l'app", words, 0.5), { start: 1.0, end: 2.8 });
  assert.deepEqual(findWords("Les boys, lance l'app", words, 0.5), { start: 1.0, end: 2.8 });
  assert.equal(findWords("Bonjour tout le monde", words, 0), null);
});

test("retakes of a line are grouped and director cues are flagged", async () => {
  const { markTakes } = await import("../src/plan.ts");
  const clip = (id: string, lines: [number, string][]) => ({
    id, fileName: id, file: id, preview: id, duration: 60, width: 1080, height: 1920, fps: 30, hasAudio: true, sheets: [], interval: 1,
    transcript: lines.map(([start, text]) => ({ start, end: start + 2, text, words: [] })),
  });
  const notes = markTakes([
    clip("C4", [[0.5, "Tu fais 3, 2, 1"], [3, "L'équipe c'est une idée de malade et elle dépend vraiment de toi Rassim"], [9, "Non attends, refais"]]),
    clip("C5", [[1, "L'équipe, c'est une idée de malade et vraiment cette idée elle dépend de Rassim."]]),
  ]);
  assert.match(notes.get("C4:1") ?? "", /take 1 of 2.*last take is C5 1\.0s/);
  assert.match(notes.get("C5:0") ?? "", /take 2 of 2/);
  assert.match(notes.get("C4:2") ?? "", /director cue/);
});

test("validatePlan sets a speech shot's cut from its quoted words", async () => {
  const { validatePlan } = await import("../src/plan.ts");
  const { CUT, EXTRAS, shot } = await import("./fixtures.ts");
  const words = [["Racine,", 5.7, 6.1], ["tu", 6.15, 6.3], ["peux", 6.3, 6.5], ["le", 6.5, 6.6], ["faire", 6.6, 7.0]] as const;
  const clip = {
    id: "C5", fileName: "c5", file: "c5", preview: "c5", duration: 20, width: 1080, height: 1920, fps: 30, hasAudio: true, sheets: [], interval: 1,
    transcript: [{ start: 5.7, end: 7.0, text: "Racine, tu peux le faire ?", words: words.map(([text, start, end]) => ({ text, start, end })) }],
  };
  const plan = { ...EXTRAS, look: "natural" as const, summary: "", on_screen_text: [], end_card: { include: false, headline: null, seconds: 0, transition: CUT }, open_questions: [],
    segments: [shot("C5", 4.9, 7.9, "the ask", { say: "Racine, tu peux le faire ?" })] };
  const { plan: out } = validatePlan(plan, [clip]);
  // Claude's 4.9-7.9 was a second off; the words put the cut at 5.58-7.2.
  assert.ok(Math.abs(out.segments[0].start - 5.58) < 0.035, `start ${out.segments[0].start}`);
  assert.ok(Math.abs(out.segments[0].end - 7.2) < 0.035, `end ${out.segments[0].end}`);
});

test("the editor sees the studio's references, with their frames, before the footage", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "magik-prompt-"));
  try {
    const sheet = path.join(dir, "sheet.jpg");
    await run("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=navy:s=64x64", "-frames:v", "1", sheet]);
    const blocks = await buildContent({
      ...input,
      references: [
        { text: "Reference 1: instagram · @slateacademy_ (for this video)\nThe studio wants from it: the hook.", sheet },
        { text: "Reference 2: youtube (for all the client's videos)\nYouTube doesn't allow downloads. Work from the note.", sheet: null },
      ],
    });
    const kinds = blocks.map((b) => (b.type === "text" ? b.text.split("\n")[0].slice(0, 40) : b.type));
    const at = kinds.findIndex((k) => k.startsWith("Reference videos the studio chose"));
    assert.ok(at > 0, kinds.join(" | "));
    assert.deepEqual(kinds.slice(at + 1, at + 5), ["Reference 1: instagram · @slateacademy_ ", "Frames from it, left to right, top to bo", "image", "Reference 2: youtube (for all the client"]);
    assert.ok(kinds.indexOf("Footage:") > at + 4);
    const without = await buildContent(input);
    assert.ok(!without.some((b) => b.type === "text" && b.text.startsWith("Reference videos")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
