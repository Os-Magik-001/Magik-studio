import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { QUESTIONS, type Answers } from "@/lib/questionnaire";
import type { Charte, Pillar, ShootPlan, TrendFindings } from "@/lib/agent-types";

// Agents 1 and 3 run here, in the app. Agent 2 (trend research) downloads and watches
// videos, so it runs on the edit engine (engine/src/research.ts).

const MODEL = "claude-opus-5-5";

async function ask<T extends z.ZodType>(schema: T, system: string, prompt: string, effort: "medium" | "high") {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 20000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    output_config: { effort, format: betaZodOutputFormat(schema) },
    messages: [{ role: "user", content: prompt }],
  });
  if (response.stop_reason === "refusal") throw new Error("Claude declined this request.");
  if (response.stop_reason === "max_tokens" || !response.parsed_output) throw new Error("Claude's answer came back incomplete. Try again.");
  return response.parsed_output as z.infer<T>;
}

// ---------------------------------------------------------------- Agent 1: brand strategist

const Strategy = z.object({
  niche: z.string().describe("The niche in one line, specific enough to search for (e.g. 'premium barbershop in Montreal')."),
  keywords: z.array(z.string()).describe("4 to 8 Instagram hashtags (without #) where top videos in this niche live, from broad to specific."),
  reference_accounts: z.array(z.string()).describe("0 to 6 Instagram usernames (without @) to study: the ones the client named, plus well-known accounts in the niche you are sure exist."),
  business: z.string().describe("The business in 3 to 5 sentences: what it is, what it sells, what makes it different."),
  audience: z.string().describe("Who the videos speak to, in 2 to 3 sentences."),
  needs: z.array(z.string()).describe("3 to 6 things the content must achieve, concrete and measurable where possible."),
  pillars: z
    .array(z.object({ name: z.string(), description: z.string(), ideas: z.array(z.string()).describe("3 video ideas") }))
    .describe("3 to 5 content pillars."),
  charte: z.object({
    palette: z
      .array(z.object({ name: z.string(), hex: z.string().describe("#RRGGBB"), role: z.enum(["primary", "accent", "secondary", "background", "text"]) }))
      .describe("3 to 6 colors. Use the client's colors when given; otherwise propose ones that fit the niche and personality."),
    fonts: z.object({
      headline: z.string().describe("A headline font (Google Fonts name, or the client's)"),
      body: z.string(),
      notes: z.string(),
    }),
    typography: z.array(z.string()).describe("2 to 4 rules for text on video (case, weight, how big)."),
    captions: z.object({
      preset: z.enum(["bold_pop", "editorial", "karaoke_box", "classic", "minimal", "subtitle"]).describe("The edit engine's caption style that fits best"),
      highlight: z.string().describe("#RRGGBB highlight color for key words"),
      notes: z.string(),
    }),
    motion: z.string().describe("The motion style: energy, transitions and which 3D templates fit (character_intro, cast_lineup, title_3d, stat_card, lower_third_3d)."),
    music_mood: z.string(),
    tone_of_voice: z.string().describe("How the brand talks, with 2 example lines."),
    logo_usage: z.string(),
    dos: z.array(z.string()),
    donts: z.array(z.string()),
  }),
  style_rules: z.string().describe("A compact paragraph of rules the video editor must follow on every edit for this client (colors, captions, motion, music, tone, don'ts)."),
});

export type Strategy = { niche: string; keywords: string[]; reference_accounts: string[]; business: string; audience: string; needs: string[]; pillars: Pillar[]; charte: Charte; style_rules: string };

const STRATEGIST = `You are the brand strategist at Magik Studio, a studio that makes short-form videos (Instagram Reels, TikTok, Shorts) for businesses. From a client's questionnaire you define their niche, their charte graphique (visual identity for video) and a clear description of the business and its needs.

Be specific and practical: everything you write is used directly by a researcher who searches viral videos in the niche, a scriptwriter, and an automatic video editor. Keep the client's own words, colors and constraints when they give them; fill gaps with confident, niche-appropriate choices. Write in English, even when the answers are in French.`;

export async function runStrategist(input: { clientName: string; answers: Answers }): Promise<Strategy> {
  const answers = QUESTIONS.filter((q) => input.answers[q.key])
    .map((q) => `${q.label}: ${input.answers[q.key]}`)
    .join("\n");
  return ask(Strategy, STRATEGIST, `Client: ${input.clientName}\n\nQuestionnaire:\n${answers}`, "high");
}

// ---------------------------------------------------------------- Agent 3: scriptwriter

const Script = z.object({
  concept: z.string().describe("The idea of the video in 1 to 2 sentences."),
  length_seconds: z.number().describe("Target length of the finished video."),
  script: z
    .string()
    .describe("The full script a client can read: numbered beats with rough timing, what we see, exact spoken lines, and on-screen text."),
  scenes: z
    .array(
      z.object({
        name: z.string(),
        location: z.string(),
        setup: z.string().describe("Camera: framing (wide, medium, close-up), angle, height, lens feel, movement or tripod, orientation 9:16."),
        action: z.string().describe("What happens in front of the camera."),
        lines: z.string().describe("Exact lines to say (in the language of the video), or empty."),
        on_screen_text: z.string(),
        seconds: z.number(),
        notes: z.string().describe("Takes to get (e.g. 3 takes, one closer), lighting, sound, anything the videographer must not forget."),
      }),
    )
    .describe("The shoot plan, scene by scene, in the order to film when that is easier."),
  broll: z.array(z.string()).describe("B-roll shots to capture, one per line."),
  props_wardrobe: z.array(z.string()),
  shots: z.array(z.string()).describe("A flat checklist of every shot to capture, one short line each."),
  edit_prompt: z
    .string()
    .describe(
      "Notes for the automatic video editor, written like an experienced editor's brief: structure with timings, hook, pacing (how often something changes), caption preset and highlight words, which motion templates to use where (character_intro, cast_lineup, title_3d, stat_card, lower_third_3d), transitions, music mood and volume, sound effects, ending and call to action, target length.",
    ),
});

export type ScriptDraft = z.infer<typeof Script>;

const SCRIPTWRITER = `You are the head scriptwriter at Magik Studio. You write short-form videos (Reels, TikTok, Shorts) that perform: a hook in the first 2 seconds, constant visual change, a payoff and a call to action.

You receive the client's brand strategy (niche, charte graphique, business and needs), the key points from viral videos in their niche, and the brief for this video. You deliver three things:
1. a script the client can approve,
2. a detailed shoot plan the videographer follows on set, scene by scene, so nothing is missed,
3. an edit prompt for the studio's automatic editor (it cuts the footage, writes captions, adds 3D motion graphics, music and sound effects from these notes).

Use what works in the viral videos (hooks, structures, pacing) but make it fit this client: never copy a video. Spoken lines are in the language of the videos; everything else is in English. Respect the charte graphique and the don'ts.`;

export async function runScriptwriter(input: {
  clientName: string;
  title: string;
  format: string;
  aspect: string;
  brief: string;
  notes?: string;
  strategy: { niche: string | null; business: string | null; audience: string | null; needs: string[]; pillars: unknown; charte: unknown } | null;
  findings: TrendFindings | null;
  styleRules: string | null;
}): Promise<ScriptDraft & { plan: ShootPlan }> {
  const s = input.strategy;
  const prompt = [
    `Client: ${input.clientName}`,
    `Video: ${input.title}`,
    `Format: ${input.format}, aspect ratio ${input.aspect}`,
    `Brief:\n${input.brief}`,
    input.notes && `Notes from the studio:\n${input.notes}`,
    s && `Brand strategy:\nNiche: ${s.niche}\nBusiness: ${s.business}\nAudience: ${s.audience}\nNeeds: ${s.needs.join("; ")}\nContent pillars: ${JSON.stringify(s.pillars)}\nCharte graphique: ${JSON.stringify(s.charte)}`,
    input.styleRules && `Editing style rules for this client:\n${input.styleRules}`,
    input.findings && `What works in viral videos in this niche (from the trend research):\n${JSON.stringify(input.findings)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const draft = await ask(Script, SCRIPTWRITER, prompt, "high");
  return {
    ...draft,
    plan: { concept: draft.concept, length_seconds: draft.length_seconds, scenes: draft.scenes, broll: draft.broll, props_wardrobe: draft.props_wardrobe },
  };
}

// ---------------------------------------------------------------- Agent 3, fast track

const Adapted = z.object({
  concept: z.string().describe("The idea of the video in 1 to 2 sentences, from the script."),
  length_seconds: z.number().describe("Target length of the finished video."),
  shots: z.array(z.string()).describe("The shots the script needs, one short line each (for the checklist)."),
  edit_prompt: Script.shape.edit_prompt,
});

const ADAPTER = `You are the head scriptwriter at Magik Studio. The studio already has a final script for this video and the footage is shot or being shot. Do not rewrite the script, its story or its lines: they are final.

Your job is to brief the studio's automatic video editor so the edit gets the most out of this script: structure with timings that follow the script's beats, the hook, pacing, captions (preset, language, highlight words), which motion templates to use where (character_intro, cast_lineup, title_3d, stat_card, lower_third_3d), transitions, music and sound effects, ending and call to action. Use the brand strategy and the viral research when they are given.`;

export async function adaptScript(input: {
  clientName: string;
  title: string;
  format: string;
  aspect: string;
  brief: string | null;
  script: string;
  notes?: string;
  strategy: { niche: string | null; business: string | null; audience: string | null; needs: string[]; pillars: unknown; charte: unknown } | null;
  findings: TrendFindings | null;
  styleRules: string | null;
}) {
  const s = input.strategy;
  const prompt = [
    `Client: ${input.clientName}`,
    `Video: ${input.title}`,
    `Format: ${input.format}, aspect ratio ${input.aspect}`,
    input.brief && `Brief:\n${input.brief}`,
    `The final script (keep it exactly):\n${input.script}`,
    input.notes && `Notes from the studio:\n${input.notes}`,
    s && `Brand strategy:\nNiche: ${s.niche}\nBusiness: ${s.business}\nAudience: ${s.audience}\nNeeds: ${s.needs.join("; ")}\nCharte graphique: ${JSON.stringify(s.charte)}`,
    input.styleRules && `Editing style rules for this client:\n${input.styleRules}`,
    input.findings && `What works in viral videos in this niche:\n${JSON.stringify(input.findings)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return ask(Adapted, ADAPTER, prompt, "medium");
}
