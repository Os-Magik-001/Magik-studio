// Agent 4, the sound designer. Once the editor has locked the cut, it scores the video:
// searches every library the studio has (its own picks, FreePD, Mixkit, Incompetech and the
// Google Drive libraries) for the music, looks closer at a shortlist (tempo, bars, sections,
// drops, ending), lines the track up with the cut, places sound effects, and picks the
// trending sound to add when posting from what the researcher found. Claude chooses; code
// measures and times (a drop lands on its bar, an effect's peak on its moment).

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { TrackAnalysis } from "./analysis.ts";
import { config } from "./config.ts";
import { MOODS, searchMusic, trackAnalysis, type Track } from "./music.ts";
import { streamMessage, timelineOf, type EditPlan } from "./plan.ts";
import { searchSfx, type SfxEntry } from "./sfx.ts";
import type { Skill } from "./skills.ts";

// ---------------------------------------------------------------- inputs and outputs

// A sound the top reels in the client's niche use (research.ts).
export type TrendAudio = {
  title: string;
  artist: string;
  // A creator's own sound (voice, meme audio) rather than a licensed song.
  original: boolean;
  audioId: string | null;
  link: string | null;
  reels: number;
  creators: number;
  plays: number;
  example: string | null;
  bpm: number | null;
};

export type SoundRequest = {
  clientName: string;
  title: string;
  format: string;
  aspect: string;
  brief: string | null;
  instructions: string | null;
  source: "launch" | "editor_fix" | "client_changes";
  clean: boolean;
  musicMood: string | null;
  styleRules: string | null;
  trend: { audio: TrendAudio[]; notes: string[] } | null;
  // The music of the client's other videos (memory.ts).
  memory: string | null;
  // On a revision: the sound of the version being revised.
  previous: SoundReport | null;
  skills: Skill[];
  catalog: Track[];
  sfx: SfxEntry[];
};

const Volume = z.enum(["low", "medium", "high"]);

export const SoundPlan = z.object({
  concept: z.string().describe("The sound idea of the video in one line."),
  music: z.object({
    track: z.string().nullable().describe("The track id from search_music, or null for no music."),
    align: z.enum(["start", "hit", "end"]).describe("start: the track begins at track_time. hit: the track moment at track_time lands on video_time. end: back-timed, the track's last hit lands on video_time (the last frame when null)."),
    track_time: z.number().nullable().describe("Seconds into the track. start: where to begin (a downbeat or strong section; null = its first downbeat). hit: a drop or section start from track_details. end: null."),
    video_time: z.number().nullable().describe("Seconds on the video's timeline. hit: where the track moment lands. end: where its last hit lands (null = the end). start: null."),
    volume: Volume.describe("Level under speech: low for talk, medium for mixed, high for wordless montage."),
    sections: z
      .array(z.object({ start: z.number(), end: z.number(), volume: Volume }))
      .describe("Where on the timeline the music plays, each with its level; empty = the whole video at `volume`. Leave gaps to let a line or a punchline play alone."),
    duck: z.enum(["light", "normal", "deep"]).describe("How far the music dips under speech: deep for soft voices or a busy track, light for montage."),
  }),
  sfx: z
    .array(
      z.object({
        id: z.string().describe("An effect id from search_sfx (whoosh, pop, hit, riser, click, ding are the built-in ones)."),
        at: z.number().describe("Seconds on the timeline where its peak lands."),
        gain: z.enum(["soft", "normal", "loud"]),
        why: z.string().describe("The moment it marks, in a few words."),
      }),
    )
    .describe("Sound effects, few and purposeful."),
  trend: z
    .object({
      title: z.string().describe("Exactly as the researcher listed it."),
      artist: z.string(),
      use: z.string().describe("How to use it when posting: which part of it, and whether to keep the library track under it (low) or remove it."),
    })
    .nullable()
    .describe("The trending sound to add in the Instagram app when posting, from the researcher's list; null when none fits or there is no list."),
  notes: z.string().describe("Two or three sentences for the editor: the sound idea and the key hits."),
});
export type SoundPlan = z.infer<typeof SoundPlan>;

// What the version records about its sound (versions.sound), for the studio's pages.
export type SoundReport = {
  concept: string;
  notes: string;
  track: { id: string; title: string; artist: string; library: string; license: string; credit: string | null; page: string; bpm: number | null } | null;
  start: number;
  at: number;
  align: "start" | "hit" | "end";
  sfx: { id: string; title: string; library: string; at: number }[];
  trend: { title: string; artist: string; link: string | null; use: string } | null;
  // Lines the post must carry, and licence limits worth knowing.
  credits: string[];
  limits: string[];
  // Where the music's bars start on the timeline, for graphics that move with it.
  bars?: number[];
};

// ---------------------------------------------------------------- the cut, in words

const f = (s: number) => `${s.toFixed(1)}s`;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

export function describeCut(plan: EditPlan, words: { start: number; end: number }[]) {
  const { shots, endCard, length } = timelineOf(plan);
  const lines = shots.map((s) => {
    const seg = s.seg;
    const bits = [
      `${s.index}. ${f(s.start)}–${f(s.end)} ${seg.purpose}`,
      seg.beat && seg.beat !== "other" ? `[${seg.beat}]` : "",
      seg.hold > 0 ? "[freeze frame]" : "",
      s.index > 1 && seg.transition_in.type !== "cut" ? `(enters with a ${seg.transition_in.type})` : "",
      seg.say ? `: "${clip(seg.say, 90)}"` : "",
    ];
    return bits.filter(Boolean).join(" ");
  });
  const spans: { start: number; end: number }[] = [];
  for (const w of words) {
    const last = spans.at(-1);
    if (last && w.start - last.end < 0.7) last.end = Math.max(last.end, w.end);
    else spans.push({ start: w.start, end: w.end });
  }
  const moments = [
    ...plan.on_screen_text.map((t) => ({ at: t.start, text: `text "${clip(t.text, 40)}"` })),
    ...plan.graphics.map((g) => ({ at: g.start, text: `${g.kind} graphic` })),
    ...plan.motion.map((m) => ({ at: m.start, text: `${m.template} until ${f(m.end)}${m.title ? ` ("${clip(m.title, 30)}")` : ""}` })),
  ].sort((a, b) => a.at - b.at);
  return [
    `Length ${f(length)}${endCard ? `, end card from ${f(endCard.start)}` : ""}.`,
    `Shots:\n${lines.join("\n")}`,
    `Speech: ${spans.length ? spans.map((s) => `${f(s.start)}–${f(s.end)}`).join(", ") : "none (wordless)"}`,
    moments.length && `Text, graphics and motion: ${moments.map((m) => `${f(m.at)} ${m.text}`).join("; ")}`,
    `The editor's sound ideas: ${plan.music.track ? `track ${plan.music.track} at ${plan.music.volume}${plan.music.sections.length ? ` in ${plan.music.sections.map((s) => `${f(s.start)}–${f(s.end)}`).join(", ")}` : ""}` : "no music"}${plan.sfx.length ? `; effects ${plan.sfx.map((x) => `${x.kind} at ${f(x.at)}`).join(", ")}` : ""}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ---------------------------------------------------------------- Claude

const SYSTEM = `You are the sound designer at Magik Studio, a studio that makes short videos for brands and creators (Instagram Reels, TikTok, YouTube Shorts). The editor has locked the cut. You design everything the viewer hears besides the dialogue: the music and the sound effects. The engine mixes what you choose: the music dips under speech by itself (you choose how deep), each effect lands with its peak on the time you give, and the mix is normalized for social.

Your libraries:
- studio: the studio's own picks, measured and credit-free.
- freepd: about 290 tracks, CC0 (public domain).
- mixkit: free licence for the web and social media (posts, ads, YouTube); not TV, radio or CDs.
- incompetech: Kevin MacLeod's catalogue, CC BY 4.0, so the post must credit the track.
- the studio's Google Drive libraries, under the licence noted for each. Pixabay libraries hold tracks the studio downloaded from Pixabay: Pixabay Content License, commercial use, no credit.
Sound effects: the engine's six built-in ones (whoosh, pop, hit, riser, click, ding) and recorded ones from mixkit and the Drive libraries.

Work with your tools: run several searches with search_music, look closer at two or three candidates with track_details (its times are seconds into the track), find effects with search_sfx, then call submit_sound_plan once with the complete plan. Only use ids your searches returned.

The trending sounds come from the researcher, who studied the top reels in the client's niche. A licensed song can't go in the exported file: recommend the best fit to add in the Instagram app when posting, and choose the library track to match its tempo and feel so the cut works with either.

Follow the sound skills below. The brand kit, the edit prompt and comments on the video beat them.`;

function buildSystem(skills: Skill[]) {
  if (!skills.length) return SYSTEM;
  return `${SYSTEM}\n\n# Sound skills\n\n${skills.map((s) => `<skill name="${s.name}">\n${s.body.trim()}\n</skill>`).join("\n\n")}`;
}

function describeRequest(req: SoundRequest, cut: string) {
  const prev = req.previous;
  return [
    `Client: ${req.clientName}`,
    `Video: ${req.title} (${req.format}, ${req.aspect})`,
    `Editing style: ${req.clean ? "clean (no sound effects; music only under the intro or cold open, never under dialogue)" : "dynamic"}`,
    req.brief && `Brief:\n${req.brief}`,
    req.instructions && `${req.source === "launch" ? "Notes for this edit" : "What was asked for this revision"}:\n${req.instructions}`,
    (req.musicMood || req.styleRules) && `Brand kit:\n${[req.musicMood && `Music mood: ${req.musicMood}`, req.styleRules && `Style rules: ${req.styleRules}`].filter(Boolean).join("\n")}`,
    `The cut you're scoring:\n${cut}`,
    req.trend?.audio.length
      ? `Trending sounds in the niche (from the researcher, most used first):\n${req.trend.audio
          .map((a) => `- "${a.title}" by ${a.artist} (${a.original ? "original audio" : "licensed song"}): ${a.reels} reel${a.reels > 1 ? "s" : ""} by ${a.creators} account${a.creators > 1 ? "s" : ""}, ${a.plays.toLocaleString("en-US")} plays${a.bpm ? `, about ${Math.round(a.bpm)} BPM` : ""}`)
          .join("\n")}`
      : "Trending sounds: no research for this client yet, so set trend to null.",
    req.trend?.notes.length && `The researcher's notes on audio:\n${req.trend.notes.map((n) => `- ${n}`).join("\n")}`,
    req.memory && `The music of the client's other videos (keep a series consistent):\n${req.memory}`,
    prev &&
      `The sound of the version being revised: ${prev.track ? `"${prev.track.title}" (${prev.track.id}, ${prev.track.library}), ${prev.align === "start" ? `from ${f(prev.start)} into it` : `${prev.align}-aligned`}` : "no music"}; effects: ${prev.sfx.map((x) => `${x.id} at ${f(x.at)}`).join(", ") || "none"}${prev.trend ? `; trend to post with: "${prev.trend.title}"` : ""}. Change what was asked about the sound and keep the rest.`,
    "Design the sound, then submit it with submit_sound_plan.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const SearchMusic = z.object({
  words: z.string().describe("What you're looking for: genre, feel, instruments, energy (e.g. 'playful funk bass guitar')."),
  moods: z.array(z.enum(MOODS)).optional(),
  energy: Volume.optional(),
  bpm_min: z.number().optional(),
  bpm_max: z.number().optional(),
  libraries: z.array(z.string()).optional().describe("Only these libraries: studio, freepd, mixkit, incompetech, or a Drive library's name."),
  credit_ok: z.boolean().optional().describe("false leaves out tracks whose licence needs a credit in the post."),
});
const TrackDetails = z.object({ id: z.string() });
const SearchSfx = z.object({
  words: z.string().describe("The effect you need (e.g. 'fast whoosh transition', 'camera shutter', 'cash register')."),
  kind: z.enum(["whoosh", "pop", "hit", "riser", "click", "ding"]).optional(),
  max_seconds: z.number().optional(),
});

const schema = (s: z.ZodType) => {
  const { $schema: _, ...rest } = z.toJSONSchema(s) as Record<string, unknown>;
  return rest as Anthropic.Beta.BetaTool.InputSchema;
};
const SUBMIT = "submit_sound_plan";
const TOOLS: Anthropic.Beta.BetaToolUnion[] = [
  { name: "search_music", description: "Search every music library. Returns up to 20 tracks, best matches first.", input_schema: schema(SearchMusic), eager_input_streaming: true },
  { name: "track_details", description: "Measure one track: tempo, where its bars start, its sections and their level, its drops and its ending, in seconds into the track.", input_schema: schema(TrackDetails), eager_input_streaming: true },
  { name: "search_sfx", description: "Search the sound effects: the engine's built-in ones and the recorded libraries.", input_schema: schema(SearchSfx), eager_input_streaming: true },
  { name: SUBMIT, description: "Submit the finished sound plan. Call it once, with the complete plan.", input_schema: schema(SoundPlan), eager_input_streaming: true },
];

export function describeTrack(t: Track, a: TrackAnalysis) {
  const bar = (240 / a.bpm).toFixed(2);
  return [
    `"${t.title}" by ${t.artist} (${t.library}, ${t.license}), ${Math.round(a.duration)}s`,
    `Tempo ${a.bpm} BPM, first beat ${a.firstBeat}s, bars start at ${a.downbeat}s and every ${bar}s.`,
    `Energy ${a.energy}. ${a.intro > 1 ? `Intro until ${a.intro}s.` : "No intro: it starts full."}`,
    `Sections: ${a.sections.map((s) => `${s.start}–${s.end}s ${s.level}`).join(", ")}`,
    `Drops: ${a.drops.length ? a.drops.map((d) => `${d}s`).join(", ") : "none"}`,
    `Last hit ${a.lastHit}s; the sound ends at ${a.end}s.`,
  ].join("\n");
}

type Analyze = (t: Track) => Promise<TrackAnalysis>;

// The conversation: Claude searches and measures with the tools, then submits. Returns the
// plan and every track it measured.
export async function designSound(req: SoundRequest, cut: string, analyze: Analyze = trackAnalysis, client = new Anthropic()) {
  const measured = new Map<string, TrackAnalysis>();
  const byId = new Map(req.catalog.map((t) => [t.id, t]));
  const sfxIds = new Set(req.sfx.map((e) => e.id));
  // The system prompt (with the skills) and the brief never change during the conversation:
  // both are cached, so each turn only pays for what's new. Earlier turns are never edited.
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: [{ type: "text", text: describeRequest(req, cut), cache_control: { type: "ephemeral" } }] }];
  const system: Anthropic.Beta.BetaTextBlockParam[] = [{ type: "text", text: buildSystem(req.skills), cache_control: { type: "ephemeral" } }];
  let used = { input: 0, output: 0 };

  const run = async (call: Anthropic.Beta.BetaToolUseBlock): Promise<string> => {
    if (call.name === "search_music") {
      const q = SearchMusic.parse(call.input);
      const found = searchMusic(req.catalog, {
        words: q.words,
        moods: q.moods,
        energy: q.energy,
        bpm: q.bpm_min || q.bpm_max ? [q.bpm_min ?? 40, q.bpm_max ?? 220] : undefined,
        libraries: q.libraries,
        creditOk: q.credit_ok,
      });
      if (!found.length) return "No match. Try other words or fewer filters.";
      return found
        .map(({ track: t }) => `${t.id} | "${t.title}" by ${t.artist} | ${t.library}${t.credit ? " (credit needed)" : ""} | ${t.mood ?? "-"} | ${t.tags.slice(0, 6).join(", ")} | ${t.bpm ? `${Math.round(t.bpm)} BPM` : "tempo not measured"} | ${Math.round(t.duration)}s`)
        .join("\n");
    }
    if (call.name === "track_details") {
      const { id } = TrackDetails.parse(call.input);
      const t = byId.get(id);
      if (!t) return `No track ${id}. Use an id from search_music.`;
      if (measured.size >= 8 && !measured.has(id)) return "You've measured 8 tracks: choose among them.";
      const a = measured.get(id) ?? (await analyze(t));
      measured.set(id, a);
      return describeTrack(t, a);
    }
    if (call.name === "search_sfx") {
      const q = SearchSfx.parse(call.input);
      const found = searchSfx(req.sfx, { words: q.words, kind: q.kind, maxSeconds: q.max_seconds });
      if (!found.length) return "No match. Try other words.";
      return found.map(({ entry: e }) => `${e.id} | "${e.title}" | ${e.library} | ${e.category} | ${e.duration}s`).join("\n");
    }
    return `Unknown tool ${call.name}.`;
  };

  for (let turn = 0; turn < 16; turn++) {
    const message = await streamMessage(client, {
      model: config.model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system,
      tools: TOOLS,
      tool_choice: { type: "auto" },
      messages,
    });
    used = { input: used.input + message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0) + (message.usage.cache_creation_input_tokens ?? 0), output: used.output + message.usage.output_tokens };
    if (message.stop_reason === "refusal") throw new Error("Claude declined to design the sound.");
    if (message.stop_reason === "max_tokens") throw new Error("The sound designer's answer came back incomplete.");

    const calls = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    messages.push({ role: "assistant", content: message.content });
    if (!calls.length) {
      messages.push({ role: "user", content: [{ type: "text", text: `Use the tools, then call ${SUBMIT} with the complete plan.` }] });
      continue;
    }
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const call of calls) {
      if (call.name === SUBMIT) {
        const parsed = SoundPlan.safeParse(call.input);
        const unknown = parsed.success
          ? [
              ...(parsed.data.music.track && !byId.has(parsed.data.music.track) ? [`track ${parsed.data.music.track}`] : []),
              ...parsed.data.sfx.filter((x) => !sfxIds.has(x.id)).map((x) => `effect ${x.id}`),
            ]
          : [];
        if (parsed.success && !unknown.length) {
          return { plan: parsed.data, measured, usage: `${message.model}: ${used.input} in, ${used.output} out (sound, ${turn + 1} turns)` };
        }
        const problem = parsed.success
          ? `These ids don't exist: ${unknown.join(", ")}. Use ids from your searches and call ${SUBMIT} again.`
          : `The plan doesn't match the schema: ${parsed.error.issues.slice(0, 10).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}. Fix it and call ${SUBMIT} again.`;
        results.push({ type: "tool_result", tool_use_id: call.id, is_error: true, content: problem });
        continue;
      }
      try {
        results.push({ type: "tool_result", tool_use_id: call.id, content: await run(call) });
      } catch (err) {
        results.push({ type: "tool_result", tool_use_id: call.id, is_error: true, content: err instanceof z.ZodError ? `Invalid input: ${err.issues.map((i) => i.message).join("; ")}` : `Failed: ${(err as Error).message}` });
      }
    }
    messages.push({ role: "user", content: results });
  }
  throw new Error("The sound designer didn't finish in time.");
}

// ---------------------------------------------------------------- the plan, applied

const round = (v: number) => Math.round(v * 100) / 100;

// Turns the sound plan into the edit plan's music and effects. The track moment is snapped to
// its bar (or beat for a start) from the measurements; a moment before the video starts means
// the music comes in later instead.
export function applySound(plan: EditPlan, sound: SoundPlan, ctx: { catalog: Track[]; sfx: SfxEntry[]; analysis: TrackAnalysis | null; clean: boolean; trend: TrendAudio[] }) {
  const problems: string[] = [];
  const { length } = timelineOf(plan);
  const track = sound.music.track ? ctx.catalog.find((t) => t.id === sound.music.track) ?? null : null;
  const a = ctx.analysis;
  const snap = (t: number, unit: number, origin: number) => (unit > 0 ? origin + Math.round((t - origin) / unit) * unit : t);

  let start = 0;
  let at = 0;
  let align = sound.music.align;
  if (track) {
    const beat = a ? 60 / a.bpm : 0;
    const firstBar = a?.downbeat ?? track.firstBeat ?? 0;
    if (align === "start" || !a) {
      const from = sound.music.track_time ?? firstBar;
      start = Math.max(0, a ? snap(from, beat, a.firstBeat) : from);
      if (!a && align !== "start") {
        problems.push("The track couldn't be measured, so it starts at the given time instead of being lined up.");
        align = "start";
      }
    } else {
      const moment = align === "end" ? a.lastHit : snap(sound.music.track_time ?? a.drops[0] ?? firstBar, 4 * beat, a.downbeat);
      const lands = Math.min(Math.max(0, sound.music.video_time ?? (align === "end" ? length - 0.15 : 0)), length);
      const offset = moment - lands;
      if (offset >= 0) start = offset;
      else at = -offset;
    }
    if (at > length - 1) {
      problems.push(`The music would only come in at ${at.toFixed(1)}s, so it starts at the top instead.`);
      at = 0;
      start = 0;
    }
    const runs = (a?.end ?? track.duration) - start;
    if (runs < length - at - 0.5) problems.push(`The track runs out ${(length - at - runs).toFixed(1)}s before the end.`);
  } else if (sound.music.track) problems.push(`Dropped unknown music track ${sound.music.track}.`);

  const sections: EditPlan["music"]["sections"] = [];
  for (const s of [...sound.music.sections].sort((x, y) => x.start - y.start)) {
    const from = Math.max(round(Math.min(Math.max(s.start, 0), length)), sections.at(-1)?.end ?? 0);
    const to = round(Math.min(Math.max(s.end, 0), length));
    if (to - from >= 0.5) sections.push({ start: from, end: to, volume: s.volume });
  }
  let music: EditPlan["music"] = { track: track?.id ?? null, start: round(start), volume: sound.music.volume, sections, at: round(at), duck: sound.music.duck, align };
  // Clean edits: music only in sections (under the intro), never as a bed, and no effects.
  if (ctx.clean && !sections.length) music = { ...music, track: null };

  const byId = new Map(ctx.sfx.map((e) => [e.id, e]));
  const sfx: EditPlan["sfx"] = ctx.clean
    ? []
    : sound.sfx
        .filter((x) => x.at >= 0 && x.at < length && byId.has(x.id))
        .sort((x, y) => x.at - y.at)
        .slice(0, 24)
        .map((x) => {
          const e = byId.get(x.id)!;
          return e.library === "studio" && e.kind ? { kind: e.kind, at: round(x.at), gain: x.gain } : { kind: e.kind ?? "pop", id: e.id, at: round(x.at), gain: x.gain };
        });
  if (sound.sfx.some((x) => !byId.has(x.id))) problems.push("Dropped effects with unknown ids.");

  // A trend the researcher didn't find isn't a trend.
  const listed = sound.trend ? ctx.trend.find((t) => t.title.toLowerCase() === sound.trend!.title.toLowerCase()) : undefined;
  if (sound.trend && !listed) problems.push(`Dropped the trend "${sound.trend.title}": it isn't in the researcher's list.`);

  const bars: number[] = [];
  if (track && music.track && a) {
    const bar = 240 / a.bpm;
    for (let t = a.downbeat; t < a.end; t += bar) {
      const onTimeline = (music.at ?? 0) + (t - music.start);
      if (onTimeline >= 0 && onTimeline <= length) bars.push(round(onTimeline));
    }
  }
  const report: SoundReport = {
    concept: sound.concept,
    notes: sound.notes,
    track: track && music.track
      ? { id: track.id, title: track.title, artist: track.artist, library: track.library, license: track.license, credit: track.credit ?? null, page: track.page, bpm: a?.bpm ?? track.bpm ?? null }
      : null,
    start: music.start,
    at: music.at ?? 0,
    align,
    sfx: sfx.map((x) => {
      const e = byId.get(x.id ?? x.kind);
      return { id: x.id ?? x.kind, title: e?.title ?? x.kind, library: e?.library ?? "studio", at: x.at };
    }),
    trend: listed && sound.trend ? { title: listed.title, artist: listed.artist, link: listed.link, use: sound.trend.use } : null,
    credits: track && music.track && track.credit ? [track.credit] : [],
    limits: track && music.track && track.library === "mixkit" ? ["Mixkit music: web and social media only, not TV, radio or CDs."] : [],
    bars,
  };
  return { plan: { ...plan, music, sfx }, report, problems };
}

// The whole pass: design, measure the chosen track if it wasn't, apply.
export async function scoreSound(req: SoundRequest, plan: EditPlan, words: { start: number; end: number }[], analyze: Analyze = trackAnalysis, designer = designSound) {
  const { plan: sound, measured, usage } = await designer(req, describeCut(plan, words), analyze);
  const track = sound.music.track ? req.catalog.find((t) => t.id === sound.music.track) : undefined;
  const analysis = track ? (measured.get(track.id) ?? (await analyze(track).catch(() => null))) : null;
  return { ...applySound(plan, sound, { catalog: req.catalog, sfx: req.sfx, analysis, clean: req.clean, trend: req.trend?.audio ?? [] }), usage };
}
