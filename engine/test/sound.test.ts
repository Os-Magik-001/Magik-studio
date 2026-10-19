import assert from "node:assert/strict";
import { test } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import type { TrackAnalysis } from "../src/analysis.ts";
import { searchMusic, type Track } from "../src/music.ts";
import type { EditPlan } from "../src/plan.ts";
import { BUILT_IN, searchSfx, type SfxEntry } from "../src/sfx.ts";
import { applySound, describeCut, designSound, type SoundPlan, type SoundRequest, type TrendAudio } from "../src/sound.ts";
import { CUT, EXTRAS, shot } from "./fixtures.ts";

const plan: EditPlan = {
  ...EXTRAS,
  summary: "",
  look: "natural",
  segments: [shot("C1", 0, 10, "hook: the claim", { say: "Dans douze mois on est une licorne" }), shot("C2", 0, 10, "reveal: the account", { beat: "punchline" })],
  on_screen_text: [],
  end_card: { include: true, headline: null, seconds: 2, transition: CUT },
  open_questions: [],
};

const track = (id: string, extra: Partial<Track> = {}): Track => ({
  id, title: id.replace(/-/g, " "), artist: "A", library: "freepd", mood: "funky-groovy", tags: ["funk", "bass"], duration: 120,
  url: `https://example.com/${id}.mp3`, page: "https://example.com", license: "CC0 1.0", ...extra,
});
const catalog = [
  track("funk-one", { bpm: 120 }),
  track("piano-calm", { mood: "emotional-piano", tags: ["piano"], bpm: 70 }),
  track("incompetech-hero", { library: "incompetech", mood: "cinematic-epic", tags: ["epic"], license: "CC BY 4.0", credit: '"Hero" Kevin MacLeod (incompetech.com)' }),
  track("mixkit-1", { library: "mixkit", license: "Mixkit Stock Music Free License" }),
];
const analysis: TrackAnalysis = {
  duration: 120, bpm: 120, firstBeat: 0.1, downbeat: 0.1, energy: "medium", intro: 8,
  sections: [{ start: 0, end: 32.1, level: "medium" }, { start: 32.1, end: 120, level: "high" }], drops: [32.1], lastHit: 118, end: 119,
};
const sfx: SfxEntry[] = [...BUILT_IN, { id: "mixkit-sfx-7", title: "Fast whoosh", library: "mixkit", category: "whoosh", tags: ["whoosh", "fast"], kind: "whoosh", duration: 1.1, url: "https://example.com/7.mp3", page: "", license: "Mixkit" }];
const trend: TrendAudio[] = [{ title: "Espresso", artist: "Sabrina Carpenter", original: false, audioId: "1", link: "https://www.instagram.com/reels/audio/1/", reels: 5, creators: 4, plays: 9_000_000, example: null, bpm: 104 }];

const sound = (music: Partial<SoundPlan["music"]>, extra: Partial<SoundPlan> = {}): SoundPlan => ({
  concept: "funk that drops on the reveal",
  music: { track: "funk-one", align: "hit", track_time: 32, video_time: 10, volume: "low", sections: [], duck: "normal", ...music },
  sfx: [],
  trend: null,
  notes: "",
  ...extra,
});
const ctx = { catalog, sfx, analysis, clean: false, trend };

test("a drop lands on the moment: the track moment snaps to its bar", () => {
  const { plan: out, report, problems } = applySound(plan, sound({}), ctx);
  assert.deepEqual(problems, []);
  assert.equal(out.music.track, "funk-one");
  assert.equal(out.music.start, 22.1);
  assert.equal(out.music.at, 0);
  assert.equal(out.music.duck, "normal");
  assert.equal(report.align, "hit");
  assert.equal(report.track?.bpm, 120);
});

test("a moment earlier in the track than in the video makes the music come in later", () => {
  const { plan: out } = applySound(plan, sound({ track_time: 4.1 }), ctx);
  assert.equal(out.music.start, 0);
  assert.equal(out.music.at, 5.9);
});

test("back-timing puts the track's last hit on the last frame", () => {
  const { plan: out } = applySound(plan, sound({ align: "end", track_time: null, video_time: null }), ctx);
  assert.equal(out.music.align, "end");
  assert.equal(out.music.start, 96.15);
  assert.equal(out.music.at, 0);
});

test("a start snaps to the beat; an unmeasured track can only start", () => {
  assert.equal(applySound(plan, sound({ align: "start", track_time: 8.3, video_time: null }), ctx).plan.music.start, 8.1);
  const blind = applySound(plan, sound({}), { ...ctx, analysis: null });
  assert.equal(blind.plan.music.align, "start");
  assert.equal(blind.plan.music.start, 32);
  assert.match(blind.problems.join(" "), /couldn't be measured/);
});

test("effects: built-in kinds stay synthesized, library ones keep their id, unknown ones go", () => {
  const { plan: out, problems } = applySound(
    plan,
    sound({}, { sfx: [{ id: "mixkit-sfx-7", at: 9.8, gain: "normal", why: "into the reveal" }, { id: "hit", at: 10, gain: "loud", why: "reveal" }, { id: "nope", at: 3, gain: "soft", why: "" }] }),
    ctx,
  );
  assert.deepEqual(out.sfx, [
    { kind: "whoosh", id: "mixkit-sfx-7", at: 9.8, gain: "normal" },
    { kind: "hit", at: 10, gain: "loud" },
  ]);
  assert.match(problems.join(" "), /unknown ids/);
});

test("clean edits keep music to sections and drop every effect", () => {
  const bed = applySound(plan, sound({}, { sfx: [{ id: "hit", at: 10, gain: "loud", why: "" }] }), { ...ctx, clean: true });
  assert.equal(bed.plan.music.track, null);
  assert.deepEqual(bed.plan.sfx, []);
  const intro = applySound(plan, sound({ sections: [{ start: 0, end: 4, volume: "medium" }] }), { ...ctx, clean: true });
  assert.equal(intro.plan.music.track, "funk-one");
});

test("only a trend the researcher found is kept, with its link; credits and licence limits follow the track", () => {
  const made = applySound(plan, sound({}, { trend: { title: "Made Up Song", artist: "X", use: "chorus" } }), ctx);
  assert.equal(made.report.trend, null);
  assert.match(made.problems.join(" "), /isn't in the researcher's list/);
  const real = applySound(plan, sound({}, { trend: { title: "espresso", artist: "Sabrina Carpenter", use: "the chorus, bed off" } }), ctx);
  assert.deepEqual(real.report.trend, { title: "Espresso", artist: "Sabrina Carpenter", link: "https://www.instagram.com/reels/audio/1/", use: "the chorus, bed off" });
  assert.deepEqual(applySound(plan, sound({ track: "incompetech-hero" }), ctx).report.credits, ['"Hero" Kevin MacLeod (incompetech.com)']);
  assert.match(applySound(plan, sound({ track: "mixkit-1" }), ctx).report.limits.join(" "), /not TV/);
});

test("search ranks words, mood and tempo, and can leave out tracks that need credit", () => {
  assert.equal(searchMusic(catalog, { words: "funky bass" })[0].track.id, "funk-one");
  assert.equal(searchMusic(catalog, { words: "epic", creditOk: false }).some((m) => m.track.id === "incompetech-hero"), false);
  assert.equal(searchMusic(catalog, { moods: ["emotional-piano"], bpm: [65, 75] })[0].track.id, "piano-calm");
  assert.equal(searchSfx(sfx, { words: "fast whoosh" })[0].entry.id, "mixkit-sfx-7");
});

test("the cut is described with its shots, speech and the editor's ideas", () => {
  const text = describeCut({ ...plan, sfx: [{ kind: "whoosh", at: 9.8 }] }, [{ start: 0.2, end: 1.0 }, { start: 1.3, end: 3.4 }, { start: 12, end: 13 }]);
  assert.match(text, /Length 22\.0s, end card from 20\.0s\./);
  assert.match(text, /2\. 10\.0s–20\.0s reveal: the account \[punchline\]/);
  assert.match(text, /Speech: 0\.2s–3\.4s, 12\.0s–13\.0s/);
  assert.match(text, /effects whoosh at 9\.8s/);
});

test("the sound designer searches and measures with its tools, then submits", async () => {
  const replies: Anthropic.Beta.BetaContentBlock[][] = [
    [{ type: "tool_use", id: "t1", name: "search_music", input: { words: "funk" } } as Anthropic.Beta.BetaContentBlock],
    [{ type: "tool_use", id: "t2", name: "track_details", input: { id: "funk-one" } } as Anthropic.Beta.BetaContentBlock],
    [{ type: "tool_use", id: "t3", name: "submit_sound_plan", input: { ...sound({}), music: { ...sound({}).music, track: "ghost" } } } as Anthropic.Beta.BetaContentBlock],
    [{ type: "tool_use", id: "t4", name: "submit_sound_plan", input: sound({}) } as Anthropic.Beta.BetaContentBlock],
  ];
  const seen: Anthropic.Beta.BetaMessageParam[][] = [];
  const client = {
    beta: {
      messages: {
        stream: (params: { messages: Anthropic.Beta.BetaMessageParam[] }) => {
          seen.push([...params.messages]);
          const content = replies[seen.length - 1];
          return { finalMessage: async () => ({ content, stop_reason: "tool_use", model: "claude-test", usage: { input_tokens: 10, output_tokens: 5 } }) };
        },
      },
    },
  } as unknown as Anthropic;
  const req: SoundRequest = {
    clientName: "QA", title: "Launch", format: "social short", aspect: "9:16", brief: null, instructions: null, source: "launch", clean: false,
    musicMood: "funky", styleRules: null, trend: { audio: trend, notes: [] }, memory: null, previous: null, skills: [], catalog, sfx,
  };
  const out = await designSound(req, "the cut", async () => analysis, client);
  assert.equal(out.plan.music.track, "funk-one");
  assert.ok(out.measured.has("funk-one"));
  const text = (i: number) => JSON.stringify(seen[i].at(-1));
  assert.match(text(1), /funk-one \| \\"funk one\\" by A \| freepd/);
  assert.match(text(2), /Tempo 120 BPM, first beat 0\.1s, bars start at 0\.1s and every 2\.00s/);
  assert.match(text(3), /These ids don't exist: track ghost/);
  assert.match(JSON.stringify(seen[0][0]), /Espresso/);
});
