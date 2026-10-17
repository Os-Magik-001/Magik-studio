// The 3D motion layer: templates written in HTML, CSS 3D and three.js (engine/motion),
// rendered frame by frame in headless Chrome. Each frame is set to an exact time
// and screenshotted with a transparent background, so the result is deterministic
// and composites over the edit like any other layer.

import { createReadStream } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright-core";
import { config } from "./config.ts";
import { run } from "./exec.ts";
import type { Clip, EditPlan } from "./plan.ts";
import { personMatte, segmentationAvailable } from "./segment.ts";

const MOTION_DIR = fileURLToPath(new URL("../motion", import.meta.url));
const THREE_DIR = fileURLToPath(new URL("../node_modules/three", import.meta.url));
const FONTS_DIR = fileURLToPath(new URL("../assets/fonts", import.meta.url));

export type MotionLayer = { dir: string; start: number; end: number; frames: number };
type Motion = EditPlan["motion"][number];

const TYPES: Record<string, string> = { ".js": "text/javascript", ".html": "text/html", ".png": "image/png", ".jpg": "image/jpeg", ".ttf": "font/ttf" };

// Serves the templates, three.js, the fonts and this render's images to the page.
function serve(assetsDir: string) {
  const roots: Record<string, string> = { motion: MOTION_DIR, three: THREE_DIR, fonts: FONTS_DIR, assets: assetsDir };
  const server = http.createServer((req, res) => {
    const [, root, ...rest] = decodeURIComponent((req.url ?? "/").split("?")[0]).split("/");
    const base = roots[root];
    const file = base && path.join(base, ...rest);
    if (!file || !file.startsWith(base)) {
      res.writeHead(404).end();
      return;
    }
    const stream = createReadStream(file);
    stream.on("error", () => res.writeHead(404).end());
    stream.on("open", () => {
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
      stream.pipe(res);
    });
  });
  return new Promise<{ url: string; close: () => void }>((resolve) =>
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
    }),
  );
}

// Google Chrome when it's installed (GPU-accelerated on macOS), else Playwright's own Chromium.
async function launch(): Promise<Browser> {
  const args = ["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--force-color-profile=srgb"];
  try {
    return await chromium.launch({ channel: "chrome", args });
  } catch {
    return await chromium.launch({ args });
  }
}

let availability: Promise<boolean> | undefined;
export function motionAvailable() {
  availability ??= launch().then(
    async (b) => {
      await b.close();
      return true;
    },
    () => false,
  );
  return availability;
}

const exists = (f: string) => access(f).then(() => true, () => false);

// A still from a video file, as a PNG.
async function still(file: string, time: number, out: string, filter?: string) {
  await run(config.ffmpeg, ["-v", "error", "-y", "-ss", time.toFixed(3), "-i", file, "-frames:v", "1", ...(filter ? ["-vf", filter] : []), out]);
}

// The person in a PNG, cut out with Apple Vision; the PNG itself when that isn't available.
async function cutout(png: string, w: number, h: number, dir: string, name: string) {
  if (!(await segmentationAvailable())) return png;
  const clip = path.join(dir, `${name}-still.mp4`);
  const mask = path.join(dir, `${name}-mask.mov`);
  const out = path.join(dir, `${name}-cutout.png`);
  await run(config.ffmpeg, ["-v", "error", "-y", "-loop", "1", "-i", png, "-t", "0.2", "-r", "30", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", clip]);
  await personMatte(clip, 0, 0.1, 30, mask);
  // The mask is a video in TV range; stretch it so the background is fully clear.
  await run(config.ffmpeg, [
    "-v", "error", "-y", "-i", png, "-i", mask, "-filter_complex",
    `[1:v]format=gray,scale=${w}:${h},lut=y='clip((val-16)*255/219,0,255)'[m];[0:v]format=rgba,scale=${w}:${h}[f];[f][m]alphamerge`,
    "-frames:v", "1", out,
  ]);
  return out;
}

const even = (n: number) => Math.ceil(n / 2) * 2;
// The ffmpeg filter that fills a w x h box from a clip, centered on a focus point.
const fillBox = (clip: Clip, w: number, h: number, focus: { x: number; y: number }) => {
  const fill = Math.max(w / clip.width, h / clip.height);
  return `scale=${even(clip.width * fill)}:${even(clip.height * fill)},crop=${w}:${h}:x='clip(${focus.x}*iw-${w / 2},0,iw-${w})':y='clip(${focus.y}*ih-${h / 2},0,ih-${h})',setsar=1`;
};

export type MotionInput = { plan: EditPlan; clips: Clip[]; picture: string; W: number; H: number; fps: number; accent: string; workDir: string };

// Renders every motion item into a folder of transparent PNG frames.
export async function renderMotion(input: MotionInput): Promise<MotionLayer[]> {
  const { plan, clips, picture, W, H, fps, workDir } = input;
  if (!plan.motion.length) return [];
  const assetsDir = path.join(workDir, "motion-assets");
  await mkdir(assetsDir, { recursive: true });
  const byId = new Map(clips.map((c) => [c.id, c]));

  // Images first, so the browser only renders.
  let member = 0;
  const specs: { item: Motion; spec: Record<string, unknown> }[] = [];
  for (const [i, item] of plan.motion.entries()) {
    const assets: Record<string, unknown> = {};
    if (item.template === "character_intro") {
      // The frame the edit freezes on, straight from the picture pass, so they match exactly.
      const frame = path.join(assetsDir, `m${i}-frame.png`);
      await still(picture, item.start + 0.5 / fps, frame);
      assets.frame = `/assets/${path.basename(frame)}`;
      assets.cutout = `/assets/${path.basename(await cutout(frame, W, H, assetsDir, `m${i}`))}`;
      member++;
    }
    if (item.template === "cast_lineup") {
      const people: string[] = [];
      for (const [k, p] of item.people.entries()) {
        const clip = byId.get(p.clip);
        if (!clip) continue;
        const png = path.join(assetsDir, `m${i}-p${k}.png`);
        await still(clip.file, p.time, png, fillBox(clip, 800, 1160, p.focus));
        people.push(`/assets/${path.basename(await cutout(png, 800, 1160, assetsDir, `m${i}-p${k}`))}`);
      }
      assets.people = people;
    }
    specs.push({
      item,
      spec: {
        template: item.template, W, H, fps,
        duration: item.end - item.start,
        props: { title: item.title, subtitle: item.subtitle, lines: item.lines, people: item.people.map((p) => ({ name: p.name, role: p.role })), accent: item.accent ?? input.accent, position: item.position, index: member },
        assets,
      },
    });
  }

  const server = await serve(assetsDir);
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await page.goto(`${server.url}/motion/index.html`);
    await page.waitForFunction(() => (window as unknown as { ready?: boolean }).ready === true);
    const layers: MotionLayer[] = [];
    for (const [i, { item, spec }] of specs.entries()) {
      const dir = path.join(workDir, `motion-${i}`);
      await mkdir(dir, { recursive: true });
      await page.evaluate((s) => (window as unknown as { setup: (s: unknown) => Promise<boolean> }).setup(s), spec);
      const frames = Math.round((item.end - item.start) * fps);
      for (let f = 0; f < frames; f++) {
        await page.evaluate((t) => (window as unknown as { renderAt: (t: number) => void }).renderAt(t), f / fps);
        await page.screenshot({ path: path.join(dir, `${String(f).padStart(5, "0")}.png`), omitBackground: true, type: "png" });
      }
      if (!(await exists(path.join(dir, "00000.png")))) continue;
      layers.push({ dir, start: item.start, end: item.end, frames });
    }
    return layers;
  } finally {
    await browser.close();
    server.close();
  }
}
