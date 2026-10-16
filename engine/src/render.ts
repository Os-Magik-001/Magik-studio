import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { config } from "./config.ts";
import { run } from "./exec.ts";
import type { Clip, EditPlan } from "./plan.ts";

const SIZES: Record<string, [number, number]> = {
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
  "16:9": [1920, 1080],
};
const FPS = 30;

export type Brand = { colors: string[]; fonts: string[]; logoFile: string | null };

function fontStack(brand: Brand) {
  const families = [...brand.fonts, "Inter", "Helvetica Neue", "Arial", "DejaVu Sans"];
  return families.map((f) => (/\s/.test(f) ? `"${f}"` : f)).join(", ") + ", sans-serif";
}

function isColor(c: string | undefined): c is string {
  return !!c && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim());
}

function wrap(ctx: SKRSContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
  }
  return lines;
}

// Text is drawn to transparent full-frame PNGs and overlaid, so rendering doesn't
// depend on how ffmpeg was built.
async function textOverlay(item: EditPlan["on_screen_text"][number], W: number, H: number, brand: Brand, file: string) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const caption = item.style === "caption";
  const size = Math.round(Math.min(W, H) * (caption ? 0.05 : 0.08));
  ctx.font = `${caption ? 700 : 800} ${size}px ${fontStack(brand)}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = wrap(ctx, item.text, W * 0.82);
  const lineH = size * 1.25;
  const blockH = lines.length * lineH;
  const anchor = item.position === "top" ? H * 0.14 : item.position === "center" ? H * 0.5 : H * (W < H ? 0.76 : 0.84);
  const top = anchor - blockH / 2;

  if (caption) {
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const padX = size * 0.6;
    const padY = size * 0.35;
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    ctx.beginPath();
    ctx.roundRect(W / 2 - widest / 2 - padX, top - padY, widest + padX * 2, blockH + padY * 2, size * 0.35);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
  } else {
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = size * 0.4;
    ctx.fillStyle = "#ffffff";
  }
  lines.forEach((l, i) => ctx.fillText(l, W / 2, top + lineH * (i + 0.5)));
  await writeFile(file, await canvas.encode("png"));
}

async function endCard(plan: EditPlan, W: number, H: number, brand: Brand, file: string) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const bg = brand.colors.find(isColor) ?? "#141413";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Pick black or white text for contrast with the background.
  const hex = bg.replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  const ink = 0.2126 * r + 0.7152 * g + 0.0722 * b > 150 ? "#141413" : "#ffffff";

  let y = H * 0.5;
  if (brand.logoFile) {
    try {
      const logo = await loadImage(brand.logoFile);
      const box = Math.min(W, H) * 0.42;
      const scale = Math.min(box / logo.width, box / logo.height);
      const w = logo.width * scale;
      const h = logo.height * scale;
      ctx.drawImage(logo, (W - w) / 2, H * 0.46 - h / 2, w, h);
      y = H * 0.46 + h / 2 + Math.min(W, H) * 0.09;
    } catch {
      // Unreadable logo: fall back to text only.
    }
  }
  if (plan.end_card.headline) {
    const size = Math.round(Math.min(W, H) * 0.07);
    ctx.font = `800 ${size}px ${fontStack(brand)}`;
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    wrap(ctx, plan.end_card.headline, W * 0.8).forEach((l, i) => ctx.fillText(l, W / 2, y + i * size * 1.2));
  }
  await writeFile(file, await canvas.encode("png"));
}

export async function render(opts: {
  plan: EditPlan;
  clips: Clip[];
  aspect: string;
  brand: Brand;
  workDir: string;
  output: string;
}) {
  const { plan, clips, brand, workDir, output } = opts;
  const [W, H] = SIZES[opts.aspect] ?? SIZES["9:16"];
  const byId = new Map(clips.map((c) => [c.id, c]));

  const args: string[] = ["-v", "error", "-y"];
  const filters: string[] = [];
  const parts: string[] = [];
  let input = 0;

  const addSilence = (seconds: number) => {
    args.push("-f", "lavfi", "-t", seconds.toFixed(3), "-i", "anullsrc=r=48000:cl=stereo");
    return input++;
  };
  const normV = (label: string, out: string) =>
    `[${label}]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${FPS},format=yuv420p,setpts=PTS-STARTPTS[${out}]`;
  const normA = (label: string, out: string) =>
    `[${label}]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,asetpts=PTS-STARTPTS[${out}]`;

  plan.segments.forEach((seg, i) => {
    const clip = byId.get(seg.clip)!;
    const dur = seg.end - seg.start;
    args.push("-ss", seg.start.toFixed(3), "-t", dur.toFixed(3), "-i", clip.file);
    const v = input++;
    const a = clip.hasAudio ? v : addSilence(dur);
    filters.push(normV(`${v}:v`, `v${i}`), normA(`${a}:a`, `a${i}`));
    parts.push(`[v${i}][a${i}]`);
  });

  if (plan.end_card.include) {
    const png = path.join(workDir, "end-card.png");
    await endCard(plan, W, H, brand, png);
    args.push("-loop", "1", "-framerate", String(FPS), "-t", plan.end_card.seconds.toFixed(3), "-i", png);
    const v = input++;
    const a = addSilence(plan.end_card.seconds);
    const i = plan.segments.length;
    filters.push(normV(`${v}:v`, `v${i}`), normA(`${a}:a`, `a${i}`));
    parts.push(`[v${i}][a${i}]`);
  }

  filters.push(`${parts.join("")}concat=n=${parts.length}:v=1:a=1[vc][ac]`);

  let last = "vc";
  for (const [k, item] of plan.on_screen_text.entries()) {
    const png = path.join(workDir, `text-${k}.png`);
    await textOverlay(item, W, H, brand, png);
    args.push("-i", png);
    const o = input++;
    const out = `t${k}`;
    filters.push(`[${last}][${o}:v]overlay=0:0:enable='between(t,${item.start},${item.end})'[${out}]`);
    last = out;
  }
  filters.push(`[ac]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]`);

  const graph = path.join(workDir, "filter.txt");
  await writeFile(graph, filters.join(";\n"));
  args.push(
    "-/filter_complex", graph,
    "-map", `[${last}]`, "-map", "[aout]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "160k",
    "-movflags", "+faststart",
    output,
  );
  await run(config.ffmpeg, args);
}
