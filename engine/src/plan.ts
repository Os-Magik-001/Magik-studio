import { readFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { config } from "./config.ts";
import { frameSize, SHEET_COLS, SHEET_ROWS } from "./media.ts";
import type { Skill } from "./skills.ts";
import type { TranscriptLine } from "./transcribe.ts";

// ---------------------------------------------------------------- the edit decision list

export const TRANSITIONS = ["cut", "crossfade", "dip_to_black", "dip_to_white", "slide_left", "slide_up", "wipe_left", "zoom_in", "circle_open"] as const;
export const LOOKS = ["natural", "warm", "cool", "punchy", "cinematic", "black_and_white", "vintage"] as const;

const Transition = z.object({
  type: z.enum(TRANSITIONS),
  seconds: z.number().describe("How long the transition takes, usually 0.2 to 0.6. 0 for a cut."),
});

const Segment = z.object({
  clip: z.string().describe("Clip id from the footage list, e.g. C2"),
  start: z.number().describe("Seconds into that clip where this shot starts"),
  end: z.number().describe("Seconds into that clip where this shot ends"),
  purpose: z.string().describe("Why this shot is here, in a few words (e.g. 'hook: pour close-up')"),
  speed: z
    .number()
    .describe("Playback speed: 1 = normal, 0.5 = half-speed slow motion, 2 = twice as fast. 0.25 to 4. Slow motion only looks smooth on footage shot at 50 fps or more."),
  audio: z
    .enum(["keep", "mute"])
    .describe("keep = the clip's own sound (pitch-corrected when the speed changes); mute = silence, e.g. for slow motion or distracting noise"),
  zoom: z
    .object({ start: z.number(), end: z.number() })
    .describe("Punch-in at the start and end of the shot: 1 = full frame, 1.3 = 30% closer. Equal values hold a static punch-in; different values make a slow push in or pull out. Stay at or under 1.6: closer looks soft."),
  focus: z
    .object({ x: z.number(), y: z.number() })
    .describe("Where the subject sits in the source frame, 0 to 1 from the left and from the top (0.5, 0.5 = center). The crop to the target aspect ratio, and any zoom, centers on this point."),
  adjust: z
    .object({ brightness: z.number(), contrast: z.number(), saturation: z.number() })
    .describe("Corrections for this shot only. Neutral is brightness 0, contrast 1, saturation 1. Brightness -0.3 to 0.3, contrast 0.7 to 1.4, saturation 0 to 2."),
  transition_in: Transition.describe("How this shot comes in from the previous one. Ignored on the first shot."),
});

type Shot = z.infer<typeof Segment>;

// A shot with no moves: what older plans, saved before the moves existed, mean.
export const PLAIN_SHOT = {
  speed: 1,
  audio: "keep",
  zoom: { start: 1, end: 1 },
  focus: { x: 0.5, y: 0.5 },
  adjust: { brightness: 0, contrast: 1, saturation: 1 },
  transition_in: { type: "cut", seconds: 0 },
} satisfies Omit<Shot, "clip" | "start" | "end" | "purpose">;

export const TEXT_STYLES = ["caption", "title", "hero", "serif", "stacked", "boxed", "label"] as const;
export const TEXT_ANIMATIONS = ["none", "pop", "fade", "slide_up", "typewriter"] as const;
export const CAPTION_PRESETS = ["bold_pop", "editorial", "karaoke_box", "classic", "minimal"] as const;
export const GRAPHICS = ["comment_cta", "follow_pill", "progress_bar", "counter", "emoji", "circle"] as const;
export const SFX = ["whoosh", "pop", "hit", "riser", "click", "ding"] as const;

const Hex = z.string().describe("A hex color like #FFD84D");

const OnScreenText = z.object({
  text: z.string().describe("Exactly what appears on screen. Short: 1 to 6 words for titles."),
  start: z.number().describe("Seconds on the finished video's timeline"),
  end: z.number().describe("Seconds on the finished video's timeline"),
  style: z
    .enum(TEXT_STYLES)
    .describe(
      "caption = subtitle line (only when captions.mode is manual); title = large bold headline; hero = huge 1 to 3 word keyword, the reel's big idea of the moment; serif = big elegant italic serif; stacked = 2 to 3 line headline built line by line (use \\n between lines); boxed = pinned header in a solid box (e.g. a call to action); label = small aside or kicker text",
    ),
  position: z.enum(["top", "center", "bottom"]),
  animation: z.enum(TEXT_ANIMATIONS).describe("How it comes in. pop = scales in with a bounce (energetic); slide_up; fade (calm); typewriter (letters appear); none."),
  color: Hex.nullable().describe("Text color; null = white (or the brand's first light color)"),
  accent: z
    .string()
    .nullable()
    .describe("One word or short phrase from `text` drawn in the highlight color and italic serif, e.g. 'did.' in 'Claude did.'; null for none"),
  behind_subject: z
    .boolean()
    .describe("Draw it behind the person, so the head overlaps the letters (the premium creator look). Only for hero/title/serif at top or center while a person fills the frame; keep at least 70% of each letter visible."),
});

const Captions = z.object({
  mode: z
    .enum(["auto", "manual", "off"])
    .describe("auto = the engine captions every kept spoken word, timed exactly from the audio (use whenever there is speech); manual = only the caption items you write; off = none"),
  preset: z
    .enum(CAPTION_PRESETS)
    .describe("bold_pop = heavy white sans, words pop in one by one, keywords in the highlight color (energetic creator reels); editorial = clean white sans with italic serif keywords (premium, brand); karaoke_box = serif in a dark box, spoken words light up (calm, readable); classic = boxed white subtitle lines; minimal = small white text with a soft shadow"),
  words_per_screen: z.number().describe("1 to 4 words on screen at a time; 2 to 3 for vertical social"),
  case: z.enum(["as_spoken", "lower", "upper"]),
  position: z.enum(["top", "center", "bottom"]).describe("center = chest height, the creator-reel standard"),
  size: z.enum(["small", "medium", "large"]),
  color: Hex,
  highlight_color: Hex.describe("Color for highlight words and the word being spoken"),
  highlight_words: z.array(z.string()).describe("Keywords to emphasize whenever they're spoken (product, numbers, payoffs), as spoken"),
});

const Graphic = z.object({
  kind: z
    .enum(GRAPHICS)
    .describe("comment_cta = an Instagram comment bubble typing the keyword (call to action); follow_pill = a Follow button that turns into Following; progress_bar = thin bar across the top that fills over its time; counter = a number or time counting from a to b (proof: views, raw vs final length); emoji = one emoji popping in; circle = a hand-drawn circle drawing itself around a point (show what you say)"),
  start: z.number().describe("Seconds on the finished timeline"),
  end: z.number(),
  text: z
    .string()
    .describe("comment_cta: the keyword; follow_pill: the @handle or empty; counter: 'from|to' like '1:16|0:55' or '0|351000'; emoji: one emoji; circle/progress_bar: empty"),
  x: z.number().describe("Horizontal center, 0 to 1"),
  y: z.number().describe("Vertical center, 0 to 1 (keep 0.12 to 0.75 on vertical video)"),
  size: z.number().describe("Scale, 0.5 to 2 (1 = standard)"),
});

const Overlay = z.object({
  kind: z
    .enum(["cutaway", "card"])
    .describe("cutaway = another clip fills the frame while the main shot's sound continues (B-roll over the voice, J/L cut); card = a clip or still floats in a rounded card over the shot (proof, screenshots, examples)"),
  clip: z.string().describe("Clip id of the overlay footage"),
  start: z.number().describe("Seconds into that clip"),
  end: z.number().describe("Seconds into that clip (ignored for stills except for length)"),
  at: z.number().describe("Seconds on the finished timeline where it appears"),
  still: z.boolean().describe("Freeze on the frame at `start` (a screenshot) instead of playing"),
  focus: z.object({ x: z.number(), y: z.number() }).describe("What to keep in frame from the overlay clip, 0 to 1"),
  x: z.number().describe("card: horizontal center 0 to 1"),
  y: z.number().describe("card: vertical center 0 to 1"),
  width: z.number().describe("card: width as a fraction of the frame, 0.25 to 0.9"),
  tilt: z.number().describe("card: rotation in degrees, -10 to 10 (a few degrees looks hand-placed)"),
});

const Music = z.object({
  track: z.string().nullable().describe("Track id from the music library, or null for no music"),
  start: z.number().describe("Seconds into the track to start from (a strong section or the first beat)"),
  volume: z.enum(["low", "medium", "high"]).describe("Bed level under speech: low for talking, medium for mixed, high for montage with little speech. It dips automatically under speech."),
});

const Sfx = z.object({
  kind: z.enum(SFX).describe("whoosh = transitions and fast moves; pop = text or graphics appearing; hit = a big reveal or punchline; riser = builds into a drop (put it 1.5 to 2 s before); click = UI and typing; ding = a positive result"),
  at: z.number().describe("Seconds on the finished timeline"),
});

export const EditPlan = z.object({
  summary: z.string().describe("Two or three sentences for the editor: the story of the cut and the key choices."),
  look: z.enum(LOOKS).describe("Color grade over every shot (not the end card). natural = untouched."),
  segments: z.array(Segment).describe("The shots in playback order."),
  captions: Captions,
  on_screen_text: z.array(OnScreenText).describe("Titles and other text you place. In captions auto mode, don't add caption items: the engine writes those."),
  graphics: z.array(Graphic),
  overlays: z.array(Overlay),
  music: Music,
  sfx: z.array(Sfx).describe("Sound effects, sparingly: a few per video, on the moments that deserve them"),
  end_card: z.object({
    include: z.boolean(),
    headline: z.string().nullable().describe("Short line under the logo, e.g. 'Available now'"),
    seconds: z.number(),
    transition: Transition.describe("How the end card comes in after the last shot."),
  }),
  open_questions: z
    .array(z.string())
    .describe("Anything you were unsure about that the editor should check. Empty if none."),
});

export type EditPlan = z.infer<typeof EditPlan>;

// What older plans, saved before automatic captions existed, mean: their captions were written by hand.
export const DEFAULT_CAPTIONS = {
  mode: "manual",
  preset: "classic",
  words_per_screen: 3,
  case: "as_spoken",
  position: "bottom",
  size: "medium",
  color: "#FFFFFF",
  highlight_color: "#FFD84D",
  highlight_words: [],
} satisfies z.infer<typeof Captions>;

// Reads a plan saved on a version, filling in moves that older plans don't have.
export function parseStoredPlan(raw: unknown): EditPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown> & { segments?: unknown; end_card?: Record<string, unknown> };
  const upgraded = {
    look: "natural",
    captions: DEFAULT_CAPTIONS,
    graphics: [],
    overlays: [],
    music: { track: null, start: 0, volume: "low" },
    sfx: [],
    ...p,
    on_screen_text: Array.isArray(p.on_screen_text)
      ? p.on_screen_text.map((t) => ({ animation: "none", color: null, accent: null, behind_subject: false, ...t }))
      : p.on_screen_text,
    segments: Array.isArray(p.segments) ? p.segments.map((s) => ({ ...PLAIN_SHOT, ...s })) : p.segments,
    end_card: p.end_card && { transition: PLAIN_SHOT.transition_in, ...p.end_card },
  };
  const parsed = EditPlan.safeParse(upgraded);
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------- the timeline

export const shotLength = (seg: Pick<Shot, "start" | "end" | "speed">) => (seg.end - seg.start) / seg.speed;
export const overlapOf = (t: Shot["transition_in"]) => (t.type === "cut" ? 0 : t.seconds);

// Where everything sits on the finished video: speed changes stretch shots, and
// each transition overlaps the two shots it joins by its length.
export function timelineOf(plan: EditPlan) {
  let t = 0;
  const shots = plan.segments.map((seg, i) => {
    const start = i === 0 ? 0 : t - overlapOf(seg.transition_in);
    t = start + shotLength(seg);
    return { index: i + 1, seg, start, end: t };
  });
  const endCard = plan.end_card.include
    ? { start: t - overlapOf(plan.end_card.transition), end: t - overlapOf(plan.end_card.transition) + plan.end_card.seconds }
    : null;
  return { shots, endCard, length: endCard?.end ?? t };
}

// ---------------------------------------------------------------- inputs

export type Clip = {
  id: string;
  fileName: string;
  file: string;
  // A small copy for watching and listening (contact sheets, transcription); the file itself otherwise.
  preview: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  sheets: string[];
  interval: number;
  transcript: TranscriptLine[] | null;
};

export type BrandKit = {
  colors: string[];
  fonts: string[];
  musicMood: string | null;
  styleRules: string | null;
  hasLogo: boolean;
};

export type PlanInput = {
  clientName: string;
  title: string;
  format: string;
  aspect: string;
  brief: string | null;
  script: string;
  shots: string[];
  brandKit: BrandKit | null;
  instructions: string | null;
  source: "launch" | "editor_fix" | "client_changes";
  skills: Skill[];
  clips: Clip[];
  previous: { number: number; plan: EditPlan; comments: { timecodeMs: number | null; body: string; fromClient: boolean }[] } | null;
  // The music library, described for planning; empty when there is none.
  music?: string;
};

const SYSTEM = `You are the editor at Magik Studio, a video studio that makes short videos for brands. You cut raw footage into a finished video that a human editor will check before the client sees it.

You see the footage as contact sheets: each image is a grid of ${SHEET_COLS}x${SHEET_ROWS} frames sampled at a fixed interval, read left to right, top to bottom, with the exact time of each frame listed before the image. Transcripts, when present, tell you what is said and when.

How to cut:
- Open with the strongest hook in the first two seconds. Follow the approved script's beats and cover its shot list.
- Choose in and out points from the frames you can see: cut on action, avoid frames that look blurry, shaky, badly framed or empty, and don't cut mid-word when there is a transcript.
- Shots are usually 1 to 4 seconds in a social short. Hold longer only when someone is speaking.
- Hit the target length from the script, the editor's notes or the format. A social short is typically 15 to 45 seconds.
- The video is cropped to fill the target aspect ratio around each shot's focus point, so set focus on the subject.
- Follow the client's brand kit and style rules exactly (captions, end card, tone).
- Only use clip ids and time ranges that exist in the footage list.
- Captions and titles use the finished video's timeline: a shot lasts (end - start) / speed, each transition overlaps the two shots it joins by its length, and the end card comes after the last shot.

Your tools, beyond choosing shots:
- Picture: transitions, speed changes, punch-ins and slow pushes, reframing with the focus point, per-shot exposure and color fixes, an overall look.
- Captions: in auto mode the engine captions every kept spoken word with exact word timing; you choose the style, size, position, colors and the keywords to highlight.
- Text you place: titles, hero words, serif accents, stacked headlines, boxed headers and labels, each with an entrance animation, an optional accent word, and optionally drawn behind the person.
- Graphics: comment call-to-action bubbles, follow buttons, progress bars, counters, emojis, hand-drawn circles.
- Overlays: B-roll that covers the picture while the voice continues (cutaway), and floating cards of other clips or stills.
- Sound: a music bed from the library that dips under speech, and sound effects on key moments.
A hard cut with no moves is the default; every move, graphic and sound should have a reason you could tell the editor.

Transcripts mark fillers like [filler "euh" 12.4–12.6] and pauses like [pause 0.8s] with their times: cut around them by splitting shots. Shot in and out points are snapped to the nearest word edge automatically, so place them at the gaps between words. The editing skills below are the studio's house techniques: apply them unless the script, the brand kit or the editor's notes say otherwise.

When you're revising a previous cut, change what the comments ask for and keep everything else that already worked. Comments are pinned to the previous cut's timeline; each one tells you which shot it falls on.`;

function fmt(s: number) {
  return `${s.toFixed(1)}s`;
}

const FILLERS = new Set(["um", "umm", "uh", "uhm", "er", "erm", "ah", "eh", "ehm", "hmm", "mm", "euh", "heu", "hum", "bah", "ben", "beh", "este", "eee", "äh", "ähm"]);
const bare = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

// A transcript line with its fillers and pauses marked, so the cut can remove them.
export function annotate(line: TranscriptLine) {
  if (!line.words?.length) return line.text;
  return line.words
    .map((w, i) => {
      const next = line.words[i + 1];
      const gap = next ? next.start - w.end : 0;
      const word = FILLERS.has(bare(w.text)) ? `[filler "${w.text.replace(/[,.]$/, "")}" ${w.start.toFixed(2)}–${w.end.toFixed(2)}]` : w.text;
      return gap >= 0.35 ? `${word} [pause ${gap.toFixed(1)}s]` : word;
    })
    .join(" ");
}

export function buildSystem(skills: Skill[]) {
  if (!skills.length) return SYSTEM;
  return `${SYSTEM}\n\n# Editing skills\n\n${skills.map((s) => `<skill name="${s.name}">\n${s.body.trim()}\n</skill>`).join("\n\n")}`;
}

function describePrevious(prev: NonNullable<PlanInput["previous"]>) {
  const { shots: timeline, endCard } = timelineOf(prev.plan);
  const shots = timeline
    .map((s) => `  ${s.index}. ${fmt(s.start)}–${fmt(s.end)} on the timeline = ${s.seg.clip} ${fmt(s.seg.start)}–${fmt(s.seg.end)}${s.seg.speed !== 1 ? ` at ${s.seg.speed}x` : ""} (${s.seg.purpose})`)
    .join("\n");
  const comments = prev.comments
    .map((c) => {
      const who = c.fromClient ? "Client" : "Editor";
      if (c.timecodeMs === null) return `- ${who}, general: ${c.body}`;
      const t = c.timecodeMs / 1000;
      const hit = timeline.find((s) => t >= s.start && t < s.end);
      const where = hit
        ? `shot ${hit.index} (${hit.seg.clip} at ${fmt(hit.seg.start + (t - hit.start) * hit.seg.speed)})`
        : endCard && t >= endCard.start ? "the end card" : "unknown";
      return `- ${who} at ${fmt(t)} → ${where}: ${c.body}`;
    })
    .join("\n");
  return `Previous cut (v${prev.number}):\n${shots}${endCard ? `\n  End card: ${fmt(endCard.start)}–${fmt(endCard.end)}` : ""}

Full previous plan (JSON):
${JSON.stringify(prev.plan)}

Open comments on v${prev.number}:
${comments || "- none"}`;
}

export async function buildContent(input: PlanInput): Promise<Anthropic.Beta.BetaContentBlockParam[]> {
  const kit = input.brandKit;
  const brief = [
    `Client: ${input.clientName}`,
    `Video: ${input.title}`,
    `Format: ${input.format}, aspect ratio ${input.aspect}`,
    input.brief && `Client brief:\n${input.brief}`,
    `Approved script:\n${input.script || "(no script text)"}`,
    input.shots.length && `Shot list:\n${input.shots.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
    kit &&
      `Brand kit:\n${[
        kit.styleRules && `Style rules: ${kit.styleRules}`,
        kit.musicMood && `Music mood: ${kit.musicMood}`,
        kit.colors.length && `Colors: ${kit.colors.join(", ")}`,
        kit.fonts.length && `Fonts: ${kit.fonts.join(", ")}`,
        `Logo available for the end card: ${kit.hasLogo ? "yes" : "no"}`,
      ]
        .filter(Boolean)
        .join("\n")}`,
    input.source === "launch" && input.instructions && `Editor's notes for this edit:\n${input.instructions}`,
    input.previous && describePrevious(input.previous),
    input.source !== "launch" && input.instructions && `What was asked for this revision:\n${input.instructions}`,
    input.music ? `Music library (choose a track id, or null):\n${input.music}` : "Music library: none available, so set music.track to null.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [{ type: "text", text: brief }, { type: "text", text: "Footage:" }];

  const [W, H] = frameSize(input.aspect);
  for (const clip of input.clips) {
    // How far a punch-in can go before the frame is enlarged past the source's own pixels.
    const sharp = Math.min(clip.width / W, clip.height / H);
    const zoomNote =
      sharp >= 1.05
        ? `stays sharp up to zoom ${(Math.floor(sharp * 20) / 20).toFixed(2)}`
        : sharp >= 0.95
          ? "fills the frame at its own resolution, so any punch-in softens it"
          : `already enlarged ${(1 / sharp).toFixed(1)}x to fill ${input.aspect}, so it will look soft and any punch-in softens it further`;
    const transcript = clip.transcript?.length
      ? `\nTranscript:\n${clip.transcript.map((l) => `  ${fmt(l.start)}–${fmt(l.end)}: ${annotate(l)}`).join("\n")}`
      : clip.transcript
        ? "\nTranscript: no speech detected."
        : "";
    blocks.push({
      type: "text",
      text: `Clip ${clip.id} ("${clip.fileName}"): ${fmt(clip.duration)} long, ${clip.width}x${clip.height} at ${Math.round(clip.fps)} fps, ${clip.hasAudio ? "has sound" : "no sound"}, ${zoomNote}.${transcript}`,
    });
    const perSheet = SHEET_COLS * SHEET_ROWS;
    for (let s = 0; s < clip.sheets.length; s++) {
      const times = Array.from({ length: perSheet }, (_, k) => (s * perSheet + k) * clip.interval).filter(
        (t) => t < clip.duration,
      );
      blocks.push({ type: "text", text: `${clip.id} sheet ${s + 1}, frames at ${times.map(fmt).join(", ")}:` });
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: (await readFile(clip.sheets[s])).toString("base64") },
      });
    }
  }
  blocks.push({
    type: "text",
    text:
      input.source === "launch"
        ? `Plan the edit, then submit it with ${SUBMIT}.`
        : `Plan the revised edit. Address every open comment, and keep what already worked. Submit it with ${SUBMIT}.`,
  });
  return blocks;
}

export async function planEdit(input: PlanInput): Promise<{ plan: EditPlan; usage: string }> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new Error("Claude isn't connected: the edit engine has no ANTHROPIC_API_KEY.");
  }
  const client = new Anthropic();
  const content = await buildContent(input);
  try {
    return await requestPlan(client, buildSystem(input.skills), content);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error("Claude rejected the engine's API key. Check ANTHROPIC_API_KEY.");
    if (err instanceof Anthropic.RateLimitError) throw new Error("Claude is busy right now (rate limited). Retry in a minute.");
    if (err instanceof Anthropic.APIConnectionError) throw new Error("The engine couldn't reach Claude. Check its network connection, then retry.");
    if (err instanceof Anthropic.APIError) throw new Error(`Claude returned an error (${err.status}): ${err.message}`);
    throw err;
  }
}

// The plan comes back as the input of one tool call. The schema is too big to compile
// into a strict grammar, so it isn't enforced by the API: the engine checks it, and a
// plan that doesn't fit goes back to Claude once with what was wrong.
const SUBMIT = "submit_edit_plan";
const planSchema = (() => {
  const { $schema: _, ...schema } = z.toJSONSchema(EditPlan) as Record<string, unknown>;
  return schema as Anthropic.Beta.BetaTool.InputSchema;
})();

async function requestPlan(client: Anthropic, system: string, content: Anthropic.Beta.BetaContentBlockParam[]) {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content }];
  let used = { input: 0, output: 0 };
  for (let attempt = 0; attempt < 2; attempt++) {
    const message = await client.beta.messages
      .stream({
        model: config.model,
        max_tokens: 64000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "high" },
        system,
        tools: [{ name: SUBMIT, description: "Submit the finished edit plan. Call it exactly once, with the complete plan.", input_schema: planSchema, eager_input_streaming: true }],
        tool_choice: { type: "auto" },
        messages,
      })
      .finalMessage();
    used = { input: used.input + message.usage.input_tokens, output: used.output + message.usage.output_tokens };

    if (message.stop_reason === "refusal") throw new Error("Claude declined to plan this edit.");
    if (message.stop_reason === "max_tokens") throw new Error("Claude's edit plan came back incomplete.");
    const call = message.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === SUBMIT);
    const parsed = EditPlan.safeParse(call?.input);
    if (parsed.success) return { plan: parsed.data, usage: `${message.model}: ${used.input} in, ${used.output} out${attempt ? " (2 tries)" : ""}` };

    // Second try: the same conversation, with what was wrong (the turn so far is kept as is).
    const problem = call
      ? `The plan doesn't match the schema: ${parsed.error.issues.slice(0, 12).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}. Fix these and call ${SUBMIT} again with the complete plan.`
      : `Call ${SUBMIT} with the complete plan; don't write it as text.`;
    messages.push({ role: "assistant", content: message.content });
    messages.push({
      role: "user",
      content: call ? [{ type: "tool_result", tool_use_id: call.id, is_error: true, content: problem }] : [{ type: "text", text: problem }],
    });
  }
  throw new Error("Claude's edit plan didn't match the format twice.");
}

// ---------------------------------------------------------------- validation

export const MAX_DURATION = 180;

// Keeps the plan inside the real footage, whatever comes back.
// Moves a cut point that lands inside a spoken word to that word's nearer edge, so
// shots never clip a syllable. In and out points snap the same way, so two shots
// that meet in the middle of a word still meet without repeating a sound.
export function snapToWords(t: number, words: { start: number; end: number }[]) {
  const w = words.find((x) => t > x.start && t < x.end);
  if (!w) return t;
  return t - w.start <= w.end - t ? w.start : w.end;
}

export function validatePlan(plan: EditPlan, clips: Clip[], tracks: string[] = []) {
  const byId = new Map(clips.map((c) => [c.id.toUpperCase(), c]));
  const problems: string[] = [];
  const segments: EditPlan["segments"] = [];
  let total = 0;

  for (const seg of plan.segments) {
    const clip = byId.get(seg.clip.trim().toUpperCase());
    if (!clip) {
      problems.push(`Dropped a shot from unknown clip ${seg.clip}.`);
      continue;
    }
    const words = seg.audio === "keep" ? (clip.transcript ?? []).flatMap((l) => l.words ?? []) : [];
    const start = clamp(snapToWords(seg.start, words), 0, clip.duration);
    const end = clamp(snapToWords(seg.end, words), 0, clip.duration);
    const speed = clamp(seg.speed, 0.25, 4, 1);
    const length = (end - start) / speed;
    if (length < 0.3) {
      problems.push(`Dropped a ${length.toFixed(2)}s shot from ${clip.id}.`);
      continue;
    }
    if (total + length > MAX_DURATION) {
      problems.push(`Stopped at ${MAX_DURATION}s.`);
      break;
    }
    segments.push({
      ...seg,
      clip: clip.id,
      start: round(start),
      end: round(end),
      speed: round(speed),
      zoom: { start: round(clamp(seg.zoom.start, 1, 2.5, 1)), end: round(clamp(seg.zoom.end, 1, 2.5, 1)) },
      focus: { x: round(clamp(seg.focus.x, 0, 1, 0.5)), y: round(clamp(seg.focus.y, 0, 1, 0.5)) },
      adjust: {
        brightness: round(clamp(seg.adjust.brightness, -0.3, 0.3, 0)),
        contrast: round(clamp(seg.adjust.contrast, 0.7, 1.4, 1)),
        saturation: round(clamp(seg.adjust.saturation, 0, 2, 1)),
      },
    });
    total += length;
  }
  if (segments.length === 0) throw new Error("Claude's plan had no usable shots.");

  // A transition overlaps the shots it joins, so it can't eat more than part of either.
  const fitTransition = (t: EditPlan["end_card"]["transition"], before: number, after: number) => {
    const seconds = Math.min(clamp(t.seconds, 0, 2), before * 0.4, after * 0.4);
    return t.type === "cut" || seconds < 0.1 ? { type: "cut" as const, seconds: 0 } : { type: t.type, seconds: round(seconds) };
  };
  segments.forEach((seg, i) => {
    seg.transition_in = i === 0 ? { type: "cut", seconds: 0 } : fitTransition(seg.transition_in, shotLength(segments[i - 1]), shotLength(seg));
  });

  const cardSeconds = plan.end_card.include ? clamp(plan.end_card.seconds || 2, 1, 5) : 0;
  const endCard = {
    include: plan.end_card.include,
    headline: plan.end_card.headline?.trim() || null,
    seconds: cardSeconds,
    transition: plan.end_card.include ? fitTransition(plan.end_card.transition, shotLength(segments.at(-1)!), cardSeconds) : { type: "cut" as const, seconds: 0 },
  };
  const fixed = { ...plan, look: LOOKS.includes(plan.look) ? plan.look : "natural", segments, end_card: endCard } satisfies EditPlan;
  const { length } = timelineOf(fixed);
  const span = <T extends { start: number; end: number }>(x: T) => ({ ...x, start: round(clamp(x.start, 0, length)), end: round(clamp(x.end, 0, length)) });

  const c = plan.captions;
  const captions = {
    ...c,
    words_per_screen: Math.round(clamp(c.words_per_screen, 1, 4, 3)),
    color: hex(c.color) ?? "#FFFFFF",
    highlight_color: hex(c.highlight_color) ?? "#FFD84D",
    highlight_words: c.highlight_words.map((w) => w.trim()).filter(Boolean).slice(0, 40),
  };
  const BEHIND = new Set(["hero", "title", "serif", "stacked"]);
  const on_screen_text = plan.on_screen_text
    .map((t) => ({
      ...span(t),
      text: t.text.trim(),
      color: hex(t.color),
      accent: t.accent && t.text.includes(t.accent.trim()) ? t.accent.trim() : null,
      behind_subject: t.behind_subject && BEHIND.has(t.style),
    }))
    // In auto mode the engine writes the captions; hand-written ones would double them.
    .filter((t) => t.text && t.end - t.start >= 0.2 && !(captions.mode === "auto" && t.style === "caption"));

  const graphics = plan.graphics
    .map((g) => ({ ...span(g), text: g.text.trim(), x: round(clamp(g.x, 0.05, 0.95, 0.5)), y: round(clamp(g.y, 0.05, 0.95, 0.5)), size: round(clamp(g.size, 0.5, 2, 1)) }))
    .filter((g) => g.end - g.start >= 0.3 && (g.kind !== "emoji" || g.text) && (g.kind !== "counter" || g.text.includes("|")));

  const overlays: EditPlan["overlays"] = [];
  for (const o of plan.overlays) {
    const clip = byId.get(o.clip.trim().toUpperCase());
    if (!clip) {
      problems.push(`Dropped an overlay from unknown clip ${o.clip}.`);
      continue;
    }
    const start = clamp(o.start, 0, clip.duration);
    const wanted = o.still ? (o.end > o.start ? o.end - o.start : 2) : clamp(o.end, 0, clip.duration) - start;
    const at = clamp(o.at, 0, length);
    const seconds = Math.min(wanted, length - at);
    if (seconds < 0.3) continue;
    overlays.push({
      ...o,
      clip: clip.id,
      start: round(start),
      // For a still, end - start is how long the screenshot stays up.
      end: round(start + seconds),
      at: round(at),
      focus: { x: round(clamp(o.focus.x, 0, 1, 0.5)), y: round(clamp(o.focus.y, 0, 1, 0.5)) },
      x: round(clamp(o.x, 0.1, 0.9, 0.5)),
      y: round(clamp(o.y, 0.1, 0.9, 0.5)),
      width: round(clamp(o.width, 0.25, 0.9, 0.6)),
      tilt: round(clamp(o.tilt, -12, 12, 0)),
    });
  }

  const music = {
    track: plan.music.track && tracks.includes(plan.music.track) ? plan.music.track : null,
    start: round(Math.max(0, plan.music.start || 0)),
    volume: plan.music.volume,
  };
  if (plan.music.track && !music.track) problems.push(`Dropped unknown music track ${plan.music.track}.`);
  const sfx = plan.sfx.filter((x) => x.at >= 0 && x.at < length).slice(0, 24).map((x) => ({ ...x, at: round(x.at) }));

  return {
    plan: { ...fixed, captions, on_screen_text, graphics, overlays, music, sfx } satisfies EditPlan,
    problems,
    length: round(length),
  };
}

// Every kept spoken word on the finished timeline: what automatic captions show.
export function timelineWords(plan: EditPlan, clips: Clip[]) {
  const byId = new Map(clips.map((c) => [c.id, c]));
  const out: { text: string; start: number; end: number }[] = [];
  for (const shot of timelineOf(plan).shots) {
    const { seg } = shot;
    if (seg.audio !== "keep") continue;
    for (const line of byId.get(seg.clip)?.transcript ?? []) {
      for (const w of line.words ?? []) {
        if (w.start < seg.start - 0.02 || w.start >= seg.end) continue;
        out.push({
          text: w.text,
          start: shot.start + (Math.max(w.start, seg.start) - seg.start) / seg.speed,
          end: shot.start + (Math.min(w.end, seg.end) - seg.start) / seg.speed,
        });
      }
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

const hex = (c: string | null | undefined) => (c && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim()) ? c.trim() : null);

const round = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, min: number, max: number, fallback = min) => (Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback);
