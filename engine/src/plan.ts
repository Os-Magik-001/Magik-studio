import { readFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { config } from "./config.ts";
import { SHEET_COLS, SHEET_ROWS } from "./media.ts";
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

const OnScreenText = z.object({
  text: z.string().describe("Exactly what appears on screen. Keep captions short: one or two lines."),
  start: z.number().describe("Seconds on the finished video's timeline"),
  end: z.number().describe("Seconds on the finished video's timeline"),
  style: z.enum(["caption", "title"]).describe("caption = subtitle-style line; title = large headline text"),
  position: z.enum(["top", "center", "bottom"]),
});

export const EditPlan = z.object({
  summary: z.string().describe("Two or three sentences for the editor: the story of the cut and the key choices."),
  look: z.enum(LOOKS).describe("Color grade over every shot (not the end card). natural = untouched."),
  segments: z.array(Segment).describe("The shots in playback order."),
  on_screen_text: z.array(OnScreenText),
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

// Reads a plan saved on a version, filling in moves that older plans don't have.
export function parseStoredPlan(raw: unknown): EditPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown> & { segments?: unknown; end_card?: Record<string, unknown> };
  const upgraded = {
    look: "natural",
    ...p,
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

Your tools, beyond choosing shots: transitions between shots, speed changes, punch-ins and slow pushes, reframing with the focus point, per-shot exposure and color fixes, and an overall look. A hard cut with no moves is the default; every move should have a reason you could tell the editor. The editing skills below are the studio's house techniques: apply them unless the script, the brand kit or the editor's notes say otherwise.

When you're revising a previous cut, change what the comments ask for and keep everything else that already worked. Comments are pinned to the previous cut's timeline; each one tells you which shot it falls on.`;

function fmt(s: number) {
  return `${s.toFixed(1)}s`;
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
        kit.musicMood && `Music mood: ${kit.musicMood} (no music library yet: keep the clips' own sound)`,
        kit.colors.length && `Colors: ${kit.colors.join(", ")}`,
        kit.fonts.length && `Fonts: ${kit.fonts.join(", ")}`,
        `Logo available for the end card: ${kit.hasLogo ? "yes" : "no"}`,
      ]
        .filter(Boolean)
        .join("\n")}`,
    input.source === "launch" && input.instructions && `Editor's notes for this edit:\n${input.instructions}`,
    input.previous && describePrevious(input.previous),
    input.source !== "launch" && input.instructions && `What was asked for this revision:\n${input.instructions}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [{ type: "text", text: brief }, { type: "text", text: "Footage:" }];

  for (const clip of input.clips) {
    const transcript = clip.transcript?.length
      ? `\nTranscript:\n${clip.transcript.map((l) => `  ${fmt(l.start)}–${fmt(l.end)}: ${l.text}`).join("\n")}`
      : clip.transcript
        ? "\nTranscript: no speech detected."
        : "";
    blocks.push({
      type: "text",
      text: `Clip ${clip.id} ("${clip.fileName}"): ${fmt(clip.duration)} long, ${clip.width}x${clip.height} at ${Math.round(clip.fps)} fps, ${clip.hasAudio ? "has sound" : "no sound"}.${transcript}`,
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
        ? "Plan the edit."
        : "Plan the revised edit. Address every open comment, and keep what already worked.",
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

async function requestPlan(client: Anthropic, system: string, content: Anthropic.Beta.BetaContentBlockParam[]) {
  const message = await client.beta.messages
    .stream({
      model: config.model,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: betaZodOutputFormat(EditPlan) },
      system,
      messages: [{ role: "user", content }],
    })
    .finalMessage();

  if (message.stop_reason === "refusal") throw new Error("Claude declined to plan this edit.");
  if (message.stop_reason === "max_tokens" || !message.parsed_output) {
    throw new Error("Claude's edit plan came back incomplete.");
  }
  const u = message.usage;
  return {
    plan: message.parsed_output,
    usage: `${message.model}: ${u.input_tokens} in, ${u.output_tokens} out`,
  };
}

// ---------------------------------------------------------------- validation

export const MAX_DURATION = 180;

// Keeps the plan inside the real footage, whatever comes back.
export function validatePlan(plan: EditPlan, clips: Clip[]) {
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
    const start = clamp(seg.start, 0, clip.duration);
    const end = clamp(seg.end, 0, clip.duration);
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
  const on_screen_text = plan.on_screen_text
    .map((t) => ({ ...t, text: t.text.trim(), start: round(Math.max(0, t.start)), end: round(Math.min(length, t.end)) }))
    .filter((t) => t.text && t.end - t.start >= 0.2);

  return {
    plan: { ...fixed, on_screen_text } satisfies EditPlan,
    problems,
    length: round(length),
  };
}

const round = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, min: number, max: number, fallback = min) => (Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback);
