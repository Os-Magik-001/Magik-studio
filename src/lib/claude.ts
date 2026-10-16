import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export const claudeConfigured = () => !!process.env.ANTHROPIC_API_KEY;

const ScriptDraft = z.object({
  script: z
    .string()
    .describe("The full script: hook, beats and call to action, with on-screen text and voiceover lines labelled."),
  shots: z
    .array(z.string())
    .describe("Ordered list of shots the videographer must capture on set, one short line each."),
});

export type ScriptDraft = z.infer<typeof ScriptDraft>;

const SYSTEM = `You are the script writer at Magik Studio, a video studio. You turn a client's brief into a shootable script for a short video, plus the shot list a videographer will follow on set.

Write for the format and aspect ratio given. Open with a hook in the first two seconds. Keep it tight: a social short is usually 20 to 60 seconds of finished video. Label each beat with its rough timing, the visual, any on-screen text, and any voiceover or spoken line.

The shot list must cover every visual the script needs, including b-roll and product close-ups, so nothing is missed on set. Each shot is one line a videographer can act on.

Follow the client's brand kit and style rules exactly when they are provided. If the brief is thin, make sensible choices rather than asking questions; the editor will review your draft before the client sees it.`;

export async function draftScript(input: {
  clientName: string;
  title: string;
  format: string;
  aspect: string;
  brief: string;
  editorNotes?: string;
  brandKit?: {
    colors: string[];
    fonts: string[];
    musicMood: string | null;
    styleRules: string | null;
  } | null;
}): Promise<ScriptDraft> {
  const client = new Anthropic();

  const brand = input.brandKit
    ? [
        input.brandKit.styleRules && `Style rules: ${input.brandKit.styleRules}`,
        input.brandKit.musicMood && `Music mood: ${input.brandKit.musicMood}`,
        input.brandKit.colors.length > 0 && `Brand colors: ${input.brandKit.colors.join(", ")}`,
        input.brandKit.fonts.length > 0 && `Brand fonts: ${input.brandKit.fonts.join(", ")}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const prompt = [
    `Client: ${input.clientName}`,
    `Video: ${input.title}`,
    `Format: ${input.format}, aspect ratio ${input.aspect}`,
    brand && `Brand kit:\n${brand}`,
    `Client brief:\n${input.brief}`,
    input.editorNotes && `Notes from the editor:\n${input.editorNotes}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "medium", format: betaZodOutputFormat(ScriptDraft) },
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Claude declined to draft this script. Edit the brief and try again.");
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new Error("Claude's draft came back incomplete. Try again.");
  }
  return response.parsed_output;
}
