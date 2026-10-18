// The design pass: Claude designs every graphic of a video (captions, titles, cards,
// full-frame motion-design scenes, the end card) as one HTML composition written for
// that video, the way a motion designer would, instead of filling in fixed templates.
// The composition is rendered frame by frame in headless Chrome over the finished cut.
// Before it ships, Claude looks at frames of it over the picture and fixes what looks
// wrong (up to two rounds).

import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { config } from "./config.ts";
import { run } from "./exec.ts";
import { probe } from "./media.ts";
import { launch, serve } from "./motion.ts";

const DESIGN_DIR = fileURLToPath(new URL("../design", import.meta.url));
const FONTS_DIR = fileURLToPath(new URL("../assets/fonts", import.meta.url));
const SUB = 4;
const SHUTTER = 0.5;
const BATCH = 30;

type Word = { text: string; start: number; end: number };
export type DesignAsset = { name: string; file: string; kind: "video" | "image"; description: string };
export type DesignInput = {
  video: string;
  words: Word[];
  subtitles?: Word[];
  shots: { start: number; end: number; beat: string; purpose: string; hold: number }[];
  brief: string;
  brand: { colors: string[]; fonts: string[] };
  assets: DesignAsset[];
  workDir: string;
  output: string;
  onStep?: (s: string) => unknown;
  // A composition saved by an earlier run (comp-N.json): reviewed and rendered without designing again.
  from?: string;
};

const Code = {
  concept: z.string().describe("The one idea that ties the graphics together, in a sentence"),
  system: z.string().describe("The design system: typefaces and weights, accent, type scale in px, margins, motion curves"),
  checkpoints: z.array(z.number()).describe("6 to 10 timeline times (seconds) where the design matters most: titles, scenes, busy moments, captions over faces"),
  css: z.string(),
  html: z.string(),
  js: z.string().describe("Defines window.render = (t) => {...} and optionally async window.init()"),
};
const Composition = z.object(Code);
const Review = z.object({
  issues: z.array(z.string()).describe("Every problem seen in the frames, specific (time, element, what is wrong)"),
  verdict: z.enum(["ship", "revise"]).describe("ship only when there is nothing left a top studio would fix"),
  ...Code,
});
type Comp = z.infer<typeof Composition>;

const anthropic = new Anthropic();
// The JSON schema sent to Claude: closed objects, no keys structured outputs doesn't take.
const jsonSchema = (schema: z.ZodType) => {
  const { $schema: _, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return JSON.parse(JSON.stringify(rest, (k, v) => (k === "default" ? undefined : v?.type === "object" ? { ...v, additionalProperties: false } : v)));
};
async function ask<T>(schema: z.ZodType<T>, system: string, messages: Anthropic.Beta.BetaMessageParam[]): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const message = await anthropic.beta.messages
        .stream({ model: config.model, max_tokens: 64000, thinking: { type: "adaptive" }, output_config: { effort: "high", format: { type: "json_schema", schema: jsonSchema(schema) } }, system, messages })
        .finalMessage();
      if (message.stop_reason === "max_tokens") throw new Error("Claude's composition came back incomplete.");
      return schema.parse(JSON.parse(message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("")));
    } catch (err) {
      const retry = err instanceof Anthropic.APIConnectionError || err instanceof z.ZodError || err instanceof SyntaxError || (err instanceof Anthropic.AnthropicError && !(err instanceof Anthropic.APIError) && /terminated|ECONNRESET|socket/i.test(err.message));
      if (!retry || attempt >= 3) throw err;
    }
  }
}

// Frames of a video asset as JPEGs the page can show, and images as they are.
async function prepareAssets(assets: DesignAsset[], dir: string, fps: number) {
  const out = [];
  for (const a of assets) {
    if (a.kind === "video") {
      const d = path.join(dir, a.name);
      await mkdir(d, { recursive: true });
      await run(config.ffmpeg, ["-v", "error", "-y", "-i", a.file, "-vf", `fps=${fps},scale='min(1170,iw)':-2`, "-q:v", "3", "-start_number", "0", path.join(d, "%05d.jpg")]);
      const frames = (await readdir(d)).length;
      out.push({ name: a.name, kind: a.kind, url: `/assets/${a.name}`, fps, frames, duration: frames / fps, description: a.description });
    } else {
      const f = path.join(dir, `${a.name}${path.extname(a.file)}`);
      await copyFile(a.file, f);
      out.push({ name: a.name, kind: a.kind, url: `/assets/${path.basename(f)}`, fps: 0, frames: 0, duration: 0, description: a.description });
    }
  }
  return out;
}

// Opens the composition in the browser; `shoot` renders and screenshots one time.
async function openComposition(comp: Comp, data: unknown, assetsDir: string, W: number, H: number) {
  const server = await serve({ design: DESIGN_DIR, fonts: FONTS_DIR, assets: assetsDir });
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.goto(`${server.url}/design/host.html`);
  await page.waitForFunction(() => (window as unknown as { ready?: boolean }).ready === true);
  errors.push(...(await page.evaluate((s) => (window as unknown as { setup: (s: unknown) => Promise<string[]> }).setup(s), { W, H, css: comp.css, html: comp.html, js: comp.js, data })));
  return {
    errors,
    async shoot(t: number, file: string) {
      await page.evaluate((t) => (window as unknown as { renderAt: (t: number) => Promise<number> }).renderAt(t), t);
      await page.screenshot({ path: file, omitBackground: true, type: "png" });
      errors.push(...(await page.evaluate(() => (window as unknown as { __errors: string[] }).__errors.splice(0))));
    },
    async close() {
      await browser.close();
      server.close();
    },
  };
}

// Frames of the composition over the picture, for Claude to look at.
async function reviewFrames(comp: Comp, data: { length: number }, assetsDir: string, video: string, dir: string, W: number, H: number) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const times = [...new Set([...comp.checkpoints, ...[0.15, 0.5, 0.85].map((p) => p * data.length)].map((t) => Math.round(Math.min(data.length - 0.05, Math.max(0, t)) * 10) / 10))].sort((a, b) => a - b).slice(0, 12);
  const page = await openComposition(comp, data, assetsDir, W, H);
  const frames: { t: number; file: string }[] = [];
  try {
    for (const t of times) {
      const overlay = path.join(dir, `o-${t}.png`);
      await page.shoot(t, overlay);
      const file = path.join(dir, `f-${t}.jpg`);
      await run(config.ffmpeg, ["-v", "error", "-y", "-ss", t.toFixed(3), "-i", video, "-i", overlay, "-filter_complex", "[0:v][1:v]overlay=format=auto,scale=720:-2", "-frames:v", "1", "-q:v", "3", file]);
      frames.push({ t, file });
    }
  } finally {
    await page.close();
  }
  return { frames, errors: [...new Set(page.errors)].slice(0, 12) };
}

const image = async (file: string): Promise<Anthropic.Beta.BetaContentBlockParam> => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: (await readFile(file)).toString("base64") } });

const RUBRIC = `Review these frames of your composition over the video like the creative director of a top studio. For each frame, check:
- Readability at phone size: is every text big and heavy enough, with enough contrast on this exact background?
- Faces and subjects: does any text or element cover a face, a head or the action? Move it.
- Hierarchy: one clear focal point per frame; at most 2 text blocks; sizes clearly different.
- Layout: margins (90 px sides), platform UI zones (top 210 px, bottom 480 px, right 150 px in the lower half), alignment, nothing cut off or overflowing.
- The design system: the same typefaces, accent use, curves and spacing everywhere; nothing that looks like a different template.
- Banned things (glows, flares, particles, shine sweeps, drip fonts, rainbow gradients, blobs, bouncy motion, corner text, tiny text).
- Full-frame scenes: are devices and cards big enough to read, is the frame balanced, is it beautiful?
- Captions: right words at the right time, phrases not single jumping words, never over faces.
Be harsh: list every issue. Then return the complete revised composition (all css, html and js, not a diff), or verdict ship with the same code if nothing is left to fix.`;

export async function designPass(input: DesignInput) {
  const step = input.onStep ?? (() => {});
  const { video, workDir } = input;
  await mkdir(workDir, { recursive: true });
  const p = await probe(video);
  const W = p.width;
  const H = p.height;
  const fps = 30;
  const assetsDir = path.join(workDir, "assets");
  await mkdir(assetsDir, { recursive: true });
  const data = {
    W, H, length: p.duration, fps,
    words: input.words.map((w) => ({ text: w.text, start: +w.start.toFixed(2), end: +w.end.toFixed(2) })),
    subtitles: input.subtitles?.map((w) => ({ text: w.text, start: +w.start.toFixed(2), end: +w.end.toFixed(2) })) ?? [],
    shots: input.shots.map((s) => ({ ...s, start: +s.start.toFixed(2), end: +s.end.toFixed(2) })),
    brand: input.brand,
    assets: await prepareAssets(input.assets, assetsDir, fps),
  };

  // What the designer sees of the cut: 16 frames across it.
  const sheet = path.join(workDir, "cut-sheet.jpg");
  await run(config.ffmpeg, ["-v", "error", "-y", "-i", video, "-vf", `fps=16/${p.duration.toFixed(3)},scale=270:480,tile=8x2`, "-frames:v", "1", "-q:v", "3", sheet]);
  const system = await readFile(path.join(DESIGN_DIR, "brief.md"), "utf8");
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: [
        { type: "text", text: `${input.brief}\n\nThe cut is ${p.duration.toFixed(1)} s. Sixteen frames across it, left to right, top to bottom:` },
        await image(sheet),
        {
          type: "text",
          text: `DATA (also available as window.DATA in the page):\n${JSON.stringify(data)}${data.subtitles.length ? "\n\nDATA.subtitles holds the English subtitle lines with their times: caption with those (not DATA.words, which are in the spoken language)." : ""}\n\nDesign the graphics for this video: decide the concept and the system, then write the composition.`,
        },
      ],
    },
  ];
  // Every version is kept on disk, so a failed call never loses the design.
  const keep = (n: number, c: Comp) => writeFile(path.join(workDir, `comp-${n}.json`), JSON.stringify(c, null, 1));
  let comp: Comp;
  if (input.from) comp = Composition.parse(JSON.parse(await readFile(input.from, "utf8")));
  else {
    await step("Claude is designing the graphics");
    comp = await ask(Composition, system, messages);
  }
  await keep(0, comp);
  const log: string[] = [`concept: ${comp.concept}`];

  for (let round = 1; round <= 3; round++) {
    await step(`Checking the design (round ${round})`);
    const { frames, errors } = await reviewFrames(comp, data, assetsDir, video, path.join(workDir, `review-${round}`), W, H);
    if (round === 3) {
      log.push(`round 3: ${errors.length} error(s)`);
      break;
    }
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (errors.length) content.push({ type: "text", text: `The composition threw errors (fix them first):\n${errors.join("\n")}` });
    for (const f of frames) content.push({ type: "text", text: `t = ${f.t}s` }, await image(f.file));
    content.push({ type: "text", text: RUBRIC });
    messages.push({ role: "assistant", content: JSON.stringify(comp) }, { role: "user", content });
    // A review that can't run (no credit, an outage) leaves the latest version to ship.
    const review = await ask(Review, system, messages).catch((err) => {
      log.push(`round ${round}: review failed (${err instanceof Error ? err.message.slice(0, 160) : err}), shipping the latest version`);
      return null;
    });
    if (!review) break;
    log.push(`round ${round}: ${review.verdict}, ${review.issues.length} issue(s): ${review.issues.slice(0, 6).join(" | ")}`);
    if (review.verdict === "ship" && !errors.length) break;
    const { issues: _, verdict: __, ...next } = review;
    comp = next;
    await keep(round, comp);
  }

  // The final render: every frame, with motion blur, laid over the cut.
  await step("Rendering the graphics");
  const framesDir = path.join(workDir, "frames");
  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });
  const total = Math.round(p.duration * fps);
  const page = await openComposition(comp, data, assetsDir, W, H);
  try {
    const sub = path.join(workDir, "sub");
    for (let from = 0; from < total; from += BATCH) {
      await mkdir(sub, { recursive: true });
      const to = Math.min(total, from + BATCH);
      for (let f = from; f < to; f++) {
        for (let k = 0; k < SUB; k++) {
          const t = Math.max(0, (f + ((k - (SUB - 1) / 2) * SHUTTER) / SUB) / fps);
          await page.shoot(t, path.join(sub, `${String((f - from) * SUB + k).padStart(5, "0")}.png`));
        }
      }
      await run(config.ffmpeg, [
        "-v", "error", "-y", "-framerate", String(fps * SUB), "-i", path.join(sub, "%05d.png"),
        "-vf", `format=rgba,premultiply=inplace=1,tmix=frames=${SUB},unpremultiply=inplace=1,select='eq(mod(n\\,${SUB})\\,${SUB - 1})'`,
        "-fps_mode", "passthrough", "-start_number", String(from), path.join(framesDir, "%05d.png"),
      ]);
      await rm(sub, { recursive: true, force: true });
    }
  } finally {
    await page.close();
  }
  await run(config.ffmpeg, [
    "-v", "error", "-y", "-i", video, "-framerate", String(fps), "-i", path.join(framesDir, "%05d.png"),
    "-filter_complex", "[1:v]format=rgba[g];[0:v][g]overlay=eof_action=pass:format=auto,format=yuv420p[v]",
    "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-c:a", "copy", "-movflags", "+faststart", input.output,
  ]);
  await rm(framesDir, { recursive: true, force: true });
  return { comp, log };
}
