import { readFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { config } from "./config.ts";
import { SHEET_COLS, SHEET_ROWS } from "./media.ts";
import type { TranscriptLine } from "./transcribe.ts";

// ---------------------------------------------------------------- the edit decision list

const Segment = z.object({
  clip: z.string().describe("Clip id from the footage list, e.g. C2"),
  start: z.number().describe("Seconds into that clip where this shot starts"),
  end: z.number().describe("Seconds into that clip where this shot ends"),
  purpose: z.string().describe("Why this shot is here, in a few words (e.g. 'hook: pour close-up')"),
});

const OnScreenText = z.object({
  text: z.string().describe("Exactly what appears on screen. Keep captions short: one or two lines."),
  start: z.number().describe("Seconds on the finished video's timeline"),
  end: z.number().describe("Seconds on the finished video's timeline"),
  style: z.enum(["caption", "title"]).describe("caption = subtitle-style line; title = large headline text"),
  position: z.enum(["top", "center", "bottom"]),
});

export const EditPlan = z.object({
  summary: z.string().describe("Two or three sentences for the editor: the story of the cut and the key choices."),
  segments: z.array(Segment).describe("The shots in playback order."),
  on_screen_text: z.array(OnScreenText),
  end_card: z.object({
    include: z.boolean(),
    headline: z.string().nullable().describe("Short line under the logo, e.g. 'Available now'"),
    seconds: z.number(),
  }),
  open_questions: z
    .array(z.string())
    .describe("Anything you were unsure about that the editor should check. Empty if none."),
});

export type EditPlan = z.infer<typeof EditPlan>;

// ---------------------------------------------------------------- inputs

export type Clip = {
  id: string;
  fileName: string;
  file: string;
  duration: number;
  width: number;
  height: number;
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
- The video will be cropped to fill the target aspect ratio from the center, so prefer shots whose subject sits near the middle.
- Follow the client's brand kit and style rules exactly (captions, end card, tone).
- Only use clip ids and time ranges that exist in the footage list.
- Captions and titles use the finished video's timeline (the end card comes after the last shot).

When you're revising a previous cut, change what the comments ask for and keep everything else that already worked. Comments are pinned to the previous cut's timeline; each one tells you which shot it falls on.`;

function fmt(s: number) {
  return `${s.toFixed(1)}s`;
}

function timelineOf(plan: EditPlan) {
  let t = 0;
  return plan.segments.map((seg, i) => {
    const start = t;
    t += seg.end - seg.start;
    return { index: i + 1, seg, start, end: t };
  });
}

function describePrevious(prev: NonNullable<PlanInput["previous"]>) {
  const timeline = timelineOf(prev.plan);
  const shots = timeline
    .map((s) => `  ${s.index}. ${fmt(s.start)}–${fmt(s.end)} on the timeline = ${s.seg.clip} ${fmt(s.seg.start)}–${fmt(s.seg.end)} (${s.seg.purpose})`)
    .join("\n");
  const total = timeline.at(-1)?.end ?? 0;
  const comments = prev.comments
    .map((c) => {
      const who = c.fromClient ? "Client" : "Editor";
      if (c.timecodeMs === null) return `- ${who}, general: ${c.body}`;
      const t = c.timecodeMs / 1000;
      const hit = timeline.find((s) => t >= s.start && t < s.end);
      const where = hit ? `shot ${hit.index} (${hit.seg.clip} at ${fmt(hit.seg.start + (t - hit.start))})` : t >= total ? "the end card" : "unknown";
      return `- ${who} at ${fmt(t)} → ${where}: ${c.body}`;
    })
    .join("\n");
  return `Previous cut (v${prev.number}):\n${shots}${prev.plan.end_card.include ? `\n  End card: ${fmt(total)}–${fmt(total + prev.plan.end_card.seconds)}` : ""}

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
      text: `Clip ${clip.id} ("${clip.fileName}"): ${fmt(clip.duration)} long, ${clip.width}x${clip.height}, ${clip.hasAudio ? "has sound" : "no sound"}.${transcript}`,
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
    return await requestPlan(client, content);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error("Claude rejected the engine's API key. Check ANTHROPIC_API_KEY.");
    if (err instanceof Anthropic.RateLimitError) throw new Error("Claude is busy right now (rate limited). Retry in a minute.");
    if (err instanceof Anthropic.APIConnectionError) throw new Error("The engine couldn't reach Claude. Check its network connection, then retry.");
    if (err instanceof Anthropic.APIError) throw new Error(`Claude returned an error (${err.status}): ${err.message}`);
    throw err;
  }
}

async function requestPlan(client: Anthropic, content: Anthropic.Beta.BetaContentBlockParam[]) {
  const message = await client.beta.messages
    .stream({
      model: config.model,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: betaZodOutputFormat(EditPlan) },
      system: SYSTEM,
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
    const start = Math.max(0, Math.min(seg.start, clip.duration));
    const end = Math.max(0, Math.min(seg.end, clip.duration));
    if (end - start < 0.3) {
      problems.push(`Dropped a ${(end - start).toFixed(2)}s shot from ${clip.id}.`);
      continue;
    }
    if (total + (end - start) > MAX_DURATION) {
      problems.push(`Stopped at ${MAX_DURATION}s.`);
      break;
    }
    segments.push({ ...seg, clip: clip.id, start: round(start), end: round(end) });
    total += end - start;
  }
  if (segments.length === 0) throw new Error("Claude's plan had no usable shots.");

  const endCard = {
    include: plan.end_card.include,
    headline: plan.end_card.headline?.trim() || null,
    seconds: plan.end_card.include ? Math.min(5, Math.max(1, plan.end_card.seconds || 2)) : 0,
  };
  const length = total + endCard.seconds;
  const on_screen_text = plan.on_screen_text
    .map((t) => ({ ...t, text: t.text.trim(), start: round(Math.max(0, t.start)), end: round(Math.min(length, t.end)) }))
    .filter((t) => t.text && t.end - t.start >= 0.2);

  return {
    plan: { ...plan, segments, on_screen_text, end_card: endCard } satisfies EditPlan,
    problems,
    length: round(length),
  };
}

const round = (n: number) => Math.round(n * 100) / 100;
