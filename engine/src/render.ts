import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { config } from "./config.ts";
import { run } from "./exec.ts";
import { frameSize } from "./media.ts";
import { overlapOf, shotLength, type Clip, type EditPlan } from "./plan.ts";

const FPS = 30;

type Shot = EditPlan["segments"][number];

const XFADE: Record<Shot["transition_in"]["type"], string> = {
  cut: "fade",
  crossfade: "fade",
  dip_to_black: "fadeblack",
  dip_to_white: "fadewhite",
  slide_left: "slideleft",
  slide_up: "slideup",
  wipe_left: "wipeleft",
  zoom_in: "zoomin",
  circle_open: "circleopen",
};

const LOOK_FILTERS: Record<EditPlan["look"], string | null> = {
  natural: null,
  warm: "colorbalance=rs=0.06:gs=0.01:bs=-0.06:rm=0.05:bm=-0.05,eq=saturation=1.08",
  cool: "colorbalance=rs=-0.05:bs=0.06:rm=-0.04:bm=0.05,eq=saturation=1.02",
  punchy: "eq=contrast=1.12:saturation=1.25,unsharp=5:5:0.4",
  cinematic: "colorbalance=rs=-0.04:bs=0.06:rh=0.06:bh=-0.05,curves=preset=medium_contrast,eq=saturation=0.92",
  black_and_white: "hue=s=0,eq=contrast=1.1",
  vintage: "curves=preset=vintage,eq=saturation=0.85",
};

const even = (n: number) => Math.ceil(n / 2) * 2;

// One shot's picture: retime, fill the frame around the focus point with any
// punch-in or push, then exposure fixes and the video's look.
function shotVideo(seg: Shot, clip: Clip, W: number, H: number, look: EditPlan["look"]) {
  const fill = Math.max(W / clip.width, H / clip.height);
  const [fw, fh] = [clip.width * fill, clip.height * fill];
  const { start: z0, end: z1 } = seg.zoom;
  const scale =
    z0 === z1
      ? `scale=${even(fw * z0)}:${even(fh * z0)}`
      : (() => {
          // Eased so a push starts and lands gently.
          const p = `min(t/${shotLength(seg).toFixed(3)},1)`;
          const z = `(${z0}+${(z1 - z0).toFixed(4)}*(3*pow(${p},2)-2*pow(${p},3)))`;
          return `scale=w='2*ceil(${fw.toFixed(1)}*${z}/2)':h='2*ceil(${fh.toFixed(1)}*${z}/2)':eval=frame`;
        })();
  const steps = [
    `setpts=(PTS-STARTPTS)/${seg.speed}`,
    `fps=${FPS}`,
    scale,
    `crop=${W}:${H}:x='clip(${seg.focus.x}*iw-${W / 2},0,iw-${W})':y='clip(${seg.focus.y}*ih-${H / 2},0,ih-${H})'`,
    "setsar=1",
  ];
  const { brightness, contrast, saturation } = seg.adjust;
  if (brightness !== 0 || contrast !== 1 || saturation !== 1) {
    steps.push(`eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`);
  }
  if (LOOK_FILTERS[look]) steps.push(LOOK_FILTERS[look]);
  steps.push("format=yuv420p");
  return steps.join(",");
}

// atempo handles 0.5x to 100x per instance, so slower speeds chain several.
function atempo(speed: number) {
  if (speed === 1) return "";
  const parts: number[] = [];
  let s = speed;
  while (s < 0.5) {
    parts.push(0.5);
    s /= 0.5;
  }
  parts.push(s);
  return parts.map((p) => `atempo=${p.toFixed(4)},`).join("");
}

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
  const lines = wrap(ctx, item.text, W * 0.8);
  const lineH = size * 1.25;
  const blockH = lines.length * lineH;
  const anchor = item.position === "top" ? H * 0.14 : item.position === "center" ? H * 0.5 : H * (W < H ? 0.72 : 0.84);
  // Vertical video plays under the app's own UI (Reels, TikTok, Shorts): the header
  // covers the top ~220px and the caption, audio row and buttons everything below
  // y 1470, so text is kept between them.
  const [safeTop, safeBottom] = W < H ? [H * 0.125, H * 0.765] : [H * 0.06, H * 0.94];
  const pad = caption ? size * 0.35 : 0;
  const top = Math.min(Math.max(anchor - blockH / 2, safeTop + pad), safeBottom - pad - blockH);

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
  const [W, H] = frameSize(opts.aspect);
  const byId = new Map(clips.map((c) => [c.id, c]));

  const args: string[] = ["-v", "error", "-y"];
  const filters: string[] = [];
  let input = 0;

  const addSilence = (seconds: number) => {
    args.push("-f", "lavfi", "-t", seconds.toFixed(3), "-i", "anullsrc=r=48000:cl=stereo");
    return input++;
  };
  // Every piece's sound is padded or trimmed to exactly its picture's length, so
  // transitions line up.
  const normA = (label: string, out: string, seconds: number, tempo = "") =>
    `[${label}]asetpts=PTS-STARTPTS,${tempo}aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad=whole_dur=${seconds.toFixed(3)},atrim=end=${seconds.toFixed(3)}[${out}]`;

  const pieces: { seconds: number; transition: EditPlan["end_card"]["transition"] }[] = [];
  plan.segments.forEach((seg, i) => {
    const clip = byId.get(seg.clip)!;
    const seconds = shotLength(seg);
    args.push("-ss", seg.start.toFixed(3), "-t", (seg.end - seg.start).toFixed(3), "-i", clip.file);
    const v = input++;
    filters.push(`[${v}:v]${shotVideo(seg, clip, W, H, plan.look)}[v${i}]`);
    if (clip.hasAudio && seg.audio === "keep") filters.push(normA(`${v}:a`, `a${i}`, seconds, atempo(seg.speed)));
    else filters.push(normA(`${addSilence(seconds)}:a`, `a${i}`, seconds));
    pieces.push({ seconds, transition: seg.transition_in });
  });

  if (plan.end_card.include) {
    const png = path.join(workDir, "end-card.png");
    await endCard(plan, W, H, brand, png);
    args.push("-loop", "1", "-framerate", String(FPS), "-t", plan.end_card.seconds.toFixed(3), "-i", png);
    const v = input++;
    const i = pieces.length;
    filters.push(`[${v}:v]setsar=1,fps=${FPS},format=yuv420p,setpts=PTS-STARTPTS[v${i}]`);
    filters.push(normA(`${addSilence(plan.end_card.seconds)}:a`, `a${i}`, plan.end_card.seconds));
    pieces.push({ seconds: plan.end_card.seconds, transition: plan.end_card.transition });
  }

  // Join the pieces in order: hard cuts concatenate, transitions overlap.
  let [vc, ac] = ["v0", "a0"];
  let length = pieces[0].seconds;
  pieces.slice(1).forEach((p, k) => {
    const i = k + 1;
    const overlap = overlapOf(p.transition);
    if (overlap) {
      filters.push(
        `[${vc}][v${i}]xfade=transition=${XFADE[p.transition.type]}:duration=${overlap.toFixed(3)}:offset=${(length - overlap).toFixed(3)}[jv${i}]`,
        `[${ac}][a${i}]acrossfade=d=${overlap.toFixed(3)}:c1=tri:c2=tri[ja${i}]`,
      );
    } else {
      // concat changes the timebase, which a later xfade would reject.
      filters.push(`[${vc}][${ac}][v${i}][a${i}]concat=n=2:v=1:a=1[cv${i}][ja${i}]`, `[cv${i}]settb=1/${FPS}[jv${i}]`);
    }
    [vc, ac] = [`jv${i}`, `ja${i}`];
    length += p.seconds - overlap;
  });

  let last = vc;
  for (const [k, item] of plan.on_screen_text.entries()) {
    const png = path.join(workDir, `text-${k}.png`);
    await textOverlay(item, W, H, brand, png);
    args.push("-i", png);
    const o = input++;
    const out = `t${k}`;
    filters.push(`[${last}][${o}:v]overlay=0:0:enable='between(t,${item.start},${item.end})'[${out}]`);
    last = out;
  }
  filters.push(`[${ac}]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]`);

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
