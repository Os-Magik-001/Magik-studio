import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { config } from "./config.ts";
import { run } from "./exec.ts";
import { frameSize } from "./media.ts";
import { hasLayer, layerSpans, renderLayer, type GraphicsInput, type Word } from "./graphics.ts";
import { overlapOf, shotLength, type Clip, type EditPlan } from "./plan.ts";
import { motionAvailable, renderMotion, type MotionLayer } from "./motion.ts";
import { personMatte, segmentationAvailable } from "./segment.ts";
import { sfxFile, sfxLead } from "./sfx.ts";

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
  glitch: "custom",
};

// A digital glitch: the frame breaks into horizontal bands that jump sideways with
// the red and blue channels split apart, and the bands flip to the next shot one by
// one. xfade's progress P runs from 1 to 0. Written without st()/ld() registers,
// which xfade's slice threads would share.
const GLITCH = (() => {
  const q = "(1-P)";
  const raw = `sin(floor(Y*18/H)*12.9898+floor(${q}*12)*78.233)*43758.5453`;
  const roll = `(${raw}-floor(${raw}))`;
  const amp = `sin(${q}*PI)`;
  const x = `clip(X+(${roll}-0.5)*W*0.22*${amp}*gt(${roll},0.55)+W*0.025*${amp}*(eq(PLANE,2)-eq(PLANE,1)),0,W-1)`;
  const pick = (s: string) => `if(eq(PLANE,0),${s}0(${x},Y),if(eq(PLANE,1),${s}1(${x},Y),${s}2(${x},Y)))`;
  return `if(lt(${roll},${q}),${pick("b")},${pick("a")})`;
})();

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

// A rounded card frame (white border and soft shadow) and the matching mask for
// the clip inside it, drawn once per card.
async function cardArt(w: number, h: number, dir: string, k: number) {
  const border = Math.round(Math.min(w, h) * 0.025) + 4;
  const radius = Math.round(Math.min(w, h) * 0.07);
  const pad = border * 3;
  const frame = createCanvas(w + 2 * pad, h + 2 * pad);
  const fx = frame.getContext("2d");
  fx.shadowColor = "rgba(0,0,0,0.45)";
  fx.shadowBlur = pad * 0.8;
  fx.shadowOffsetY = pad * 0.25;
  fx.fillStyle = "#ffffff";
  fx.beginPath();
  fx.roundRect(pad - border, pad - border, w + 2 * border, h + 2 * border, radius + border);
  fx.fill();
  const mask = createCanvas(w, h);
  const mx = mask.getContext("2d");
  mx.fillStyle = "#000000";
  mx.fillRect(0, 0, w, h);
  mx.fillStyle = "#ffffff";
  mx.beginPath();
  mx.roundRect(0, 0, w, h, radius);
  mx.fill();
  const files = { frame: path.join(dir, `card-${k}-frame.png`), mask: path.join(dir, `card-${k}-mask.png`), pad };
  await writeFile(files.frame, await frame.encode("png"));
  await writeFile(files.mask, await mask.encode("png"));
  return files;
}

// Fills a w x h box from a clip, centered on its focus point.
function fillBox(clip: Clip, w: number, h: number, focus: { x: number; y: number }) {
  const fill = Math.max(w / clip.width, h / clip.height);
  return `scale=${even(clip.width * fill)}:${even(clip.height * fill)},crop=${w}:${h}:x='clip(${focus.x}*iw-${w / 2},0,iw-${w})':y='clip(${focus.y}*ih-${h / 2},0,ih-${h})',setsar=1`;
}

// Pass 1, the picture edit: shots, moves, transitions, the end card and video
// overlays (cutaways and cards), with the shots' own sound.
async function pictureEdit(opts: RenderOptions, W: number, H: number, file: string) {
  const { plan, clips, brand, workDir } = opts;
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
    // A freeze repeats its first frame for the hold; any push still plays over it.
    const freeze = seg.hold > 0 ? `trim=end_frame=1,loop=loop=${Math.ceil(seconds * FPS)}:size=1:start=0,setpts=N/${FPS}/TB,trim=duration=${seconds.toFixed(3)},` : "";
    filters.push(`[${v}:v]${freeze}${shotVideo(seg, clip, W, H, plan.look)}[v${i}]`);
    if (clip.hasAudio && seg.audio === "keep" && seg.hold === 0) filters.push(normA(`${v}:a`, `a${i}`, seconds, atempo(seg.speed)));
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
    if (overlap && p.transition.type === "glitch") {
      // The glitch samples each plane on its own, so it runs on full-resolution RGB.
      filters.push(
        `[${vc}]format=gbrp[ga${i}]`,
        `[v${i}]format=gbrp[gb${i}]`,
        `[ga${i}][gb${i}]xfade=transition=custom:expr='${GLITCH}':duration=${overlap.toFixed(3)}:offset=${(length - overlap).toFixed(3)},format=yuv420p[jv${i}]`,
        `[${ac}][a${i}]acrossfade=d=${overlap.toFixed(3)}:c1=tri:c2=tri[ja${i}]`,
      );
    } else if (overlap) {
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

  // Overlays sit on top of the joined picture; the voice underneath carries on.
  const look = LOOK_FILTERS[plan.look] ? `,${LOOK_FILTERS[plan.look]}` : "";
  for (const [k, o] of plan.overlays.entries()) {
    const clip = byId.get(o.clip)!;
    const seconds = o.end - o.start;
    const at = o.at.toFixed(3);
    const until = (o.at + seconds).toFixed(3);
    args.push("-ss", o.start.toFixed(3), "-t", (o.still ? 0.2 : seconds).toFixed(3), "-i", clip.file);
    const v = input++;
    // A still repeats its first frame for the card's whole time.
    const timing = o.still
      ? `trim=end_frame=1,loop=loop=${Math.ceil(seconds * FPS)}:size=1:start=0,setpts=N/${FPS}/TB`
      : `setpts=PTS-STARTPTS,fps=${FPS}`;
    if (o.kind === "cutaway") {
      filters.push(`[${v}:v]${timing},${fillBox(clip, W, H, o.focus)}${look},format=yuv420p,setpts=PTS+${at}/TB[ov${k}]`);
      filters.push(`[${vc}][ov${k}]overlay=0:0:eof_action=pass:enable='between(t,${at},${until})'[oc${k}]`);
    } else {
      const w = even(W * o.width);
      const h = even(Math.min(w * (clip.height / clip.width), H * 0.5));
      const art = await cardArt(w, h, workDir, k);
      args.push("-loop", "1", "-framerate", String(FPS), "-t", seconds.toFixed(3), "-i", art.frame);
      const frameIn = input++;
      args.push("-loop", "1", "-framerate", String(FPS), "-t", seconds.toFixed(3), "-i", art.mask);
      const maskIn = input++;
      const fade = `fade=t=in:st=0:d=0.18:alpha=1,fade=t=out:st=${Math.max(0, seconds - 0.15).toFixed(3)}:d=0.15:alpha=1`;
      const rotate = o.tilt ? `,rotate=${((o.tilt * Math.PI) / 180).toFixed(4)}:ow=rotw(${((o.tilt * Math.PI) / 180).toFixed(4)}):oh=roth(${((o.tilt * Math.PI) / 180).toFixed(4)}):c=none` : "";
      filters.push(
        `[${v}:v]${timing},${fillBox(clip, w, h, o.focus)}${look},format=rgba[cv${k}]`,
        `[${maskIn}:v]format=gray,setsar=1[cm${k}]`,
        `[cv${k}][cm${k}]alphamerge[ca${k}]`,
        `[${frameIn}:v]format=rgba,setsar=1[cf${k}]`,
        `[cf${k}][ca${k}]overlay=${art.pad}:${art.pad}:shortest=1,format=rgba${rotate},${fade},setpts=PTS+${at}/TB[ov${k}]`,
        `[${vc}][ov${k}]overlay=x='${(o.x * W).toFixed(1)}-w/2':y='${(o.y * H).toFixed(1)}-h/2':eof_action=pass:enable='between(t,${at},${until})'[oc${k}]`,
      );
    }
    vc = `oc${k}`;
  }

  const graph = path.join(workDir, "picture.txt");
  await writeFile(graph, filters.join(";\n"));
  args.push(
    "-/filter_complex", graph,
    "-map", `[${vc}]`, "-map", `[${ac}]`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "15", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "256k",
    file,
  );
  await run(config.ffmpeg, args);
  return length;
}

export type RenderOptions = {
  plan: EditPlan;
  clips: Clip[];
  aspect: string;
  brand: Brand;
  workDir: string;
  output: string;
  // Kept spoken words on the finished timeline (automatic captions).
  words?: Word[];
  // The chosen music track, already downloaded and normalized.
  musicFile?: string | null;
};

const MUSIC_LEVEL = { low: 0.16, medium: 0.28, high: 0.5 };

// Pass 2, finishing: the graphics layer (text behind people too), music that dips
// under speech, sound effects, and loudness for social.
export async function render(opts: RenderOptions) {
  const { workDir, output } = opts;
  const [W, H] = frameSize(opts.aspect);
  await mkdir(workDir, { recursive: true });
  const base = path.join(workDir, "picture.mp4");
  const length = await pictureEdit(opts, W, H, base);

  // Without the cut-out tool, text meant to sit behind people is drawn in front.
  const matte = opts.plan.on_screen_text.some((t) => t.behind_subject) && (await segmentationAvailable());
  const plan = matte ? opts.plan : { ...opts.plan, on_screen_text: opts.plan.on_screen_text.map((t) => ({ ...t, behind_subject: false })) };
  const gfx: GraphicsInput = { plan, words: opts.words ?? [], W, H, length, fps: FPS, brand: opts.brand };
  const args: string[] = ["-v", "error", "-y", "-i", base];
  const filters: string[] = [];
  let input = 1;
  let v = "0:v";

  // Text behind the person: draw it, then lay a cut-out of the person back on top
  // wherever it shows.
  if (matte) {
    const layer = await renderLayer(gfx, "behind", path.join(workDir, "gfx"));
    args.push("-f", "concat", "-safe", "0", "-i", layer.list);
    filters.push(`[${input}:v]fps=${FPS},format=rgba[bl]`, `[${v}][bl]overlay=0:0:eof_action=pass:format=auto[vb]`);
    input++;
    v = "vb";
    const spans = mergeSpans(layerSpans(gfx, "behind"), length);
    filters.push(`[0:v]split=${spans.length}${spans.map((_, i) => `[bc${i}]`).join("")}`);
    for (const [i, span] of spans.entries()) {
      const mask = path.join(workDir, `matte-${i}.mov`);
      await personMatte(base, span.start, span.end - span.start, FPS, mask);
      args.push("-i", mask);
      filters.push(
        `[bc${i}]trim=start=${span.start.toFixed(4)}:end=${span.end.toFixed(4)},setpts=PTS-STARTPTS,format=rgba[bs${i}]`,
        `[${input}:v]format=gray,scale=${W}:${H}[bm${i}]`,
        `[bs${i}][bm${i}]alphamerge,setpts=PTS+${span.start.toFixed(4)}/TB[bp${i}]`,
        `[${v}][bp${i}]overlay=0:0:eof_action=pass:enable='between(t,${span.start.toFixed(4)},${span.end.toFixed(4)})'[vp${i}]`,
      );
      input++;
      v = `vp${i}`;
    }
  }
  // 3D motion graphics sit over the picture and under captions and titles.
  if (plan.motion.length) {
    if (await motionAvailable()) {
      const accent = opts.brand.colors.find((c, i) => i > 0 && isColor(c)) ?? plan.captions.highlight_color;
      const layers = await renderMotion({ plan, clips: opts.clips, picture: base, W, H, fps: FPS, accent, workDir });
      if (layers.length) {
        // One input for every graphic: separate image-sequence inputs stall ffmpeg's overlay
        // sync now and then (a graphic froze on its 8th frame), a single timed list never does.
        args.push("-framerate", String(FPS), "-i", await motionTrack(layers, W, H, length, workDir));
        filters.push(`[${input}:v]format=rgba[mo]`, `[${v}][mo]overlay=0:0:eof_action=pass:format=auto[vm]`);
        input++;
        v = "vm";
      }
    } else console.warn("motion graphics skipped: no Chrome or Chromium found for rendering them");
  }
  if (hasLayer(gfx, "front")) {
    const layer = await renderLayer(gfx, "front", path.join(workDir, "gfx"));
    args.push("-f", "concat", "-safe", "0", "-i", layer.list);
    filters.push(`[${input}:v]fps=${FPS},format=rgba[fl]`, `[${v}][fl]overlay=0:0:eof_action=pass:format=auto[vf]`);
    input++;
    v = "vf";
  }
  filters.push(`[${v}]format=yuv420p[vout]`);

  // Sound: the edit's own audio, the music bed ducked under it, and effects.
  const mix: string[] = [];
  if (opts.musicFile && plan.music.track) {
    filters.push(`[0:a]asplit=2[dlg][side]`);
    args.push("-ss", plan.music.start.toFixed(3), "-i", opts.musicFile);
    const fadeOut = Math.max(0, length - 1.5).toFixed(3);
    filters.push(
      `[${input}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=duration=${length.toFixed(3)},${musicLevel(plan.music, length, fadeOut)}[mus]`,
      `[mus][side]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=400:makeup=1[duck]`,
    );
    input++;
    mix.push("[dlg]", "[duck]");
  } else mix.push("[0:a]");
  for (const [k, fx] of plan.sfx.entries()) {
    args.push("-i", await sfxFile(fx.kind));
    const delay = Math.max(0, Math.round((fx.at - sfxLead[fx.kind]) * 1000));
    filters.push(`[${input}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=${delay}|${delay},volume=0.45[fx${k}]`);
    input++;
    mix.push(`[fx${k}]`);
  }
  filters.push(
    mix.length > 1 ? `${mix.join("")}amix=inputs=${mix.length}:duration=first:normalize=0[mixed]` : `${mix[0]}anull[mixed]`,
    `[mixed]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]`,
  );

  const graph = path.join(workDir, "finish.txt");
  await writeFile(graph, filters.join(";\n"));
  args.push(
    "-/filter_complex", graph,
    "-map", "[vout]", "-map", "[aout]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "192k",
    "-t", length.toFixed(3),
    "-movflags", "+faststart",
    output,
  );
  await run(config.ffmpeg, args);
}

// Every motion graphic on one timeline, as an image sequence with exactly one image per
// output frame (links to the graphics' frames, a transparent image in between). A single
// input at the edit's own frame rate keeps every graphic frame-accurate; stitched stills
// came out on ffmpeg's 25 fps image clock and drifted.
async function motionTrack(layers: MotionLayer[], W: number, H: number, length: number, workDir: string) {
  const dir = path.join(workDir, "motion-track");
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const blank = path.join(workDir, "motion-blank.png");
  await writeFile(blank, await createCanvas(W, H).encode("png"));
  const total = Math.ceil(length * FPS);
  const frames: string[] = new Array(total).fill(blank);
  // Later graphics win where two overlap.
  for (const m of [...layers].sort((a, b) => a.start - b.start)) {
    const first = Math.round(m.start * FPS);
    for (let f = 0; f < m.frames && first + f < total; f++) frames[first + f] = path.join(m.dir, `${String(f).padStart(5, "0")}.png`);
  }
  await Promise.all(frames.map((src, i) => symlink(src, path.join(dir, `${String(i).padStart(6, "0")}.png`))));
  return path.join(dir, "%06d.png");
}

// The music's level over the timeline: the whole video at one level, or only inside
// its sections, each ramping in and out over 0.2 s.
function musicLevel(music: EditPlan["music"], length: number, fadeOut: string) {
  if (!music.sections?.length) return `afade=t=in:d=0.5,afade=t=out:st=${fadeOut}:d=1.5,volume=${MUSIC_LEVEL[music.volume]}`;
  const ramp = 0.2;
  const terms = music.sections.map((s) => `${MUSIC_LEVEL[s.volume]}*clip(min((t-${s.start.toFixed(3)})/${ramp},(${Math.min(s.end, length).toFixed(3)}-t)/${ramp}),0,1)`);
  return `volume='${terms.join("+")}':eval=frame`;
}

// Overlapping or touching ranges become one, so each needs a single cut-out pass.
function mergeSpans(spans: { start: number; end: number }[], length: number) {
  const sorted = spans.map((s) => ({ start: Math.max(0, s.start), end: Math.min(length, s.end) })).sort((a, b) => a.start - b.start);
  const out: { start: number; end: number }[] = [];
  for (const s of sorted) {
    const last = out.at(-1);
    if (last && s.start <= last.end + 0.1) last.end = Math.max(last.end, s.end);
    else out.push({ ...s });
  }
  // Frame-aligned, so the cut-out lines up with the picture frame for frame.
  return out.map((s) => ({ start: Math.floor(s.start * FPS) / FPS, end: Math.ceil(s.end * FPS) / FPS })).filter((s) => s.end - s.start > 0.1);
}
