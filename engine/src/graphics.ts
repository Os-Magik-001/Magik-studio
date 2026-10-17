// The graphics layer: captions, titles, animated text and creator-style graphics,
// drawn with canvas onto transparent frames and composited over the edit.
//
// Frames are only drawn when something changes (a word appears, an animation
// moves); still stretches become one image with a duration, played through ffmpeg's
// concat demuxer. That keeps a 60 s reel to a few hundred images instead of 1,800.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import type { EditPlan } from "./plan.ts";

const FONTS_DIR = fileURLToPath(new URL("../assets/fonts", import.meta.url));
const FONT_FILES: [string, string][] = [
  ["Poppins-Medium.ttf", "Magik Sans Medium"],
  ["Poppins-SemiBold.ttf", "Magik Sans SemiBold"],
  ["Poppins-ExtraBold.ttf", "Magik Sans ExtraBold"],
  ["Poppins-Black.ttf", "Magik Sans Black"],
  ["ArchivoBlack-Regular.ttf", "Magik Heavy"],
  ["InstrumentSerif-Regular.ttf", "Magik Serif"],
  ["InstrumentSerif-Italic.ttf", "Magik Serif Italic"],
  ["DMSerifDisplay-Italic.ttf", "Magik Display Italic"],
  ["PermanentMarker-Regular.ttf", "Magik Marker"],
  ["SpaceMono-Bold.ttf", "Magik Mono"],
  ["Creepster-Regular.ttf", "Magik Drip"],
];
for (const [file, family] of FONT_FILES) GlobalFonts.registerFromPath(path.join(FONTS_DIR, file), family);

const font = (family: string, size: number, brand: string[] = []) =>
  `${Math.round(size)}px ${[...brand.map((f) => `"${f}"`), `"${family}"`, '"Apple Color Emoji"', "sans-serif"].join(", ")}`;

export type Word = { text: string; start: number; end: number };
export type Brand = { colors: string[]; fonts: string[] };
type Layer = "front" | "behind";
type Text = EditPlan["on_screen_text"][number];
type Graphic = EditPlan["graphics"][number];

export type GraphicsInput = { plan: EditPlan; words: Word[]; W: number; H: number; length: number; fps: number; brand: Brand };

// ---------------------------------------------------------------- timing helpers

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3;
const backOut = (x: number) => {
  const c = 1.7;
  const t = clamp01(x) - 1;
  return 1 + (c + 1) * t ** 3 + c * t ** 2;
};
const INTRO = 0.24;
const OUTRO = 0.12;

// Entrance progress of an element, quantized to frames so identical frames repeat.
function phase(t: number, start: number, end: number, fps: number) {
  const intro = t - start < INTRO ? Math.floor((t - start) * fps) : -1;
  const outro = end - t < OUTRO ? Math.floor((end - t) * fps) : -1;
  return { intro, outro, introP: intro < 0 ? 1 : (t - start) / INTRO, outroP: outro < 0 ? 1 : (end - t) / OUTRO };
}

// ---------------------------------------------------------------- caption screens

type Screen = { words: Word[]; start: number; end: number };

export function captionScreens(words: Word[], perScreen: number, maxChars: number): Screen[] {
  const screens: Screen[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length) screens.push({ words: cur, start: cur[0].start, end: cur[cur.length - 1].end });
    cur = [];
  };
  for (const w of words) {
    const last = cur.at(-1);
    const chars = cur.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length;
    if (last && (cur.length >= perScreen || chars > maxChars || w.start - last.end > 0.45 || (perScreen > 1 && /[.?!,;:]$/.test(last.text)))) flush();
    cur.push(w);
  }
  flush();
  // Hold each screen until the next one (no flicker between lines), but not through long silences.
  for (let i = 0; i < screens.length; i++) {
    const next = screens[i + 1];
    screens[i].end = next && next.start - screens[i].end < 0.5 ? next.start : screens[i].end + 0.25;
  }
  return screens;
}

// Translated subtitles: each line Claude wrote becomes one screen, and its words are
// spread over the source words spoken in that time, so the translation builds up
// as the person talks.
export function translatedScreens(items: { text: string; start: number; end: number }[], words: Word[]): Screen[] {
  return items
    .map((item) => {
      const parts = item.text.split(/\s+/).filter(Boolean);
      const spoken = words.filter((w) => w.start >= item.start - 0.05 && w.start < item.end);
      const span = Math.max(0.2, item.end - item.start);
      return {
        start: item.start,
        end: item.end,
        words: parts.map((text, k) => {
          const at = spoken.length ? spoken[Math.min(spoken.length - 1, Math.floor((k * spoken.length) / parts.length))].start : item.start + (span * 0.7 * k) / parts.length;
          return { text, start: Math.max(item.start, at), end: item.end };
        }),
      };
    })
    .filter((s) => s.words.length)
    .sort((a, b) => a.start - b.start);
}

// ---------------------------------------------------------------- drawing

type Ctx = SKRSContext2D;

function shadow(ctx: Ctx, blur: number, alpha = 0.55) {
  ctx.shadowColor = `rgba(0,0,0,${alpha})`;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = blur * 0.15;
}
const noShadow = (ctx: Ctx) => {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
};

// Where a block of text goes: anchored by position, kept inside the area the app's
// own interface leaves free on vertical video (as in render.ts before this layer).
function anchorY(position: "top" | "center" | "bottom", blockH: number, W: number, H: number) {
  const vertical = W < H;
  const anchor = position === "top" ? H * 0.17 : position === "center" ? H * (vertical ? 0.56 : 0.5) : H * (vertical ? 0.7 : 0.84);
  const [safeTop, safeBottom] = vertical ? [H * 0.125, H * 0.765] : [H * 0.06, H * 0.94];
  return Math.min(Math.max(anchor - blockH / 2, safeTop), safeBottom - blockH);
}

type Run = { text: string; font: string; color: string };

// Heavy fonts have a thin space that an outline nearly closes; add air that scales
// with the font size so words never run together at phone size.
const wordGap = (ctx: Ctx) => ctx.measureText(" ").width + parseFloat(ctx.font) * 0.14;

// Lays runs (words with their own font and color) into centered lines.
function layoutRuns(ctx: Ctx, runs: Run[], maxW: number) {
  const lines: Run[][] = [[]];
  let lineW = 0;
  const space = (r: Run) => {
    ctx.font = r.font;
    return wordGap(ctx);
  };
  for (const r of runs) {
    ctx.font = r.font;
    const w = ctx.measureText(r.text).width;
    const line = lines[lines.length - 1];
    if (line.length && lineW + space(r) + w > maxW) {
      lines.push([r]);
      lineW = w;
    } else {
      lineW += (line.length ? space(r) : 0) + w;
      line.push(r);
    }
  }
  return lines.map((line) => ({
    runs: line,
    width: line.reduce((n, r, i) => {
      ctx.font = r.font;
      return n + ctx.measureText(r.text).width + (i ? space(r) : 0);
    }, 0),
  }));
}

function drawRuns(ctx: Ctx, lines: ReturnType<typeof layoutRuns>, cx: number, top: number, lineH: number, stroke = 0) {
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  lines.forEach((line, li) => {
    let x = cx - line.width / 2;
    const y = top + lineH * (li + 0.5);
    line.runs.forEach((r, i) => {
      ctx.font = r.font;
      if (i) x += wordGap(ctx);
      if (stroke) {
        ctx.lineWidth = stroke;
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.lineJoin = "round";
        ctx.strokeText(r.text, x, y);
      }
      ctx.fillStyle = r.color;
      ctx.fillText(r.text, x, y);
      x += ctx.measureText(r.text).width;
    });
  });
}

const caseOf = (s: string, c: EditPlan["captions"]["case"]) => (c === "lower" ? s.toLowerCase() : c === "upper" ? s.toUpperCase() : s);
const bare = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

function drawCaption(ctx: Ctx, input: GraphicsInput, screen: Screen, t: number) {
  const { W, H, plan, brand } = input;
  const c = plan.captions;
  const base = Math.min(W, H);
  const size = base * { small: 0.052, medium: 0.068, large: 0.088 }[c.size] * (c.preset === "minimal" ? 0.8 : c.preset === "subtitle" ? 0.72 : 1);
  const highlights = new Set(c.highlight_words.flatMap((w) => w.split(/\s+/)).map(bare));
  const spokenIdx = screen.words.findLastIndex((w) => w.start <= t);
  const builds = c.preset === "bold_pop" || c.preset === "subtitle";
  const shown = builds ? screen.words.slice(0, Math.max(1, spokenIdx + 1)) : screen.words;
  const fonts = {
    bold_pop: font("Magik Sans Black", size, brand.fonts),
    editorial: font("Magik Sans SemiBold", size, brand.fonts),
    karaoke_box: font("Magik Serif", size * 1.1),
    classic: font("Magik Sans SemiBold", size * 0.85, brand.fonts),
    minimal: font("Magik Sans Medium", size, brand.fonts),
    subtitle: font("Magik Sans SemiBold", size, brand.fonts),
  };
  const runs: Run[] = shown.map((w, i) => {
    const hl = highlights.has(bare(w.text));
    const keepsPunctuation = c.preset === "classic" || c.preset === "karaoke_box" || c.preset === "subtitle";
    const text = caseOf(keepsPunctuation ? w.text : w.text.replace(/[.,;:]+$/, ""), c.case);
    if (c.preset === "karaoke_box") {
      const spoken = i <= spokenIdx;
      return { text, font: fonts.karaoke_box, color: hl && spoken ? c.highlight_color : spoken ? "#F7F2E8" : "rgba(247,242,232,0.42)" };
    }
    if (c.preset === "editorial" && hl) return { text, font: font("Magik Serif Italic", size * 1.18), color: c.highlight_color };
    return { text, font: fonts[c.preset], color: hl ? c.highlight_color : c.color };
  });
  const lines = layoutRuns(ctx, runs, W * 0.8);
  const lineH = size * 1.22;
  // A subtitle that builds word by word keeps its first line where the whole phrase puts it.
  const full = c.preset === "subtitle" ? layoutRuns(ctx, screen.words.map((w) => ({ text: w.text, font: fonts.subtitle, color: c.color })), W * 0.8) : lines;
  const blockH = lines.length * lineH;
  const top = anchorY(c.position, full.length * lineH, W, H);

  ctx.save();
  if (c.preset === "classic" || c.preset === "karaoke_box") {
    const widest = Math.max(...lines.map((l) => l.width));
    const padX = size * 0.6;
    const padY = size * 0.32;
    ctx.fillStyle = c.preset === "classic" ? "rgba(0,0,0,0.62)" : "rgba(18,38,30,0.86)";
    ctx.beginPath();
    ctx.roundRect(W / 2 - widest / 2 - padX, top - padY, widest + padX * 2, blockH + padY * 2, size * 0.35);
    ctx.fill();
    drawRuns(ctx, lines, W / 2, top, lineH);
  } else if (c.preset === "bold_pop") {
    // The newest word pops: drawn alone at a scale that settles over ~0.12 s.
    const newest = screen.words[Math.max(0, spokenIdx)];
    const pop = newest ? clamp01((t - newest.start) / 0.12) : 1;
    shadow(ctx, size * 0.35, 0.6);
    if (pop < 1 && lines.length === 1) {
      const last = runs.length - 1;
      const restLines = layoutRuns(ctx, runs, W * 0.8);
      // Lay out the whole line, then redraw the last word scaled around its center.
      const line = restLines[0];
      let x = W / 2 - line.width / 2;
      const y = top + lineH / 2;
      line.runs.forEach((r, i) => {
        ctx.font = r.font;
        if (i) x += wordGap(ctx);
        const w = ctx.measureText(r.text).width;
        ctx.save();
        if (i === last) {
          const s = 1.28 - 0.28 * backOut(pop);
          ctx.translate(x + w / 2, y);
          ctx.scale(s, s);
          ctx.translate(-(x + w / 2), -y);
        }
        ctx.textBaseline = "middle";
        ctx.lineWidth = size * 0.08;
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.lineJoin = "round";
        ctx.strokeText(r.text, x, y);
        ctx.fillStyle = r.color;
        ctx.fillText(r.text, x, y);
        ctx.restore();
        x += w;
      });
    } else drawRuns(ctx, lines, W / 2, top, lineH, size * 0.08);
  } else {
    shadow(ctx, size * 0.4, c.preset === "minimal" || c.preset === "subtitle" ? 0.75 : 0.55);
    drawRuns(ctx, lines, W / 2, top, lineH);
  }
  ctx.restore();
  return spokenIdx;
}

function textRuns(item: Text, family: string, size: number, color: string, accentColor: string, brandFonts: string[]): Run[] {
  const f = font(family, size, brandFonts);
  if (!item.accent) return [{ text: item.text, font: f, color }];
  const at = item.text.indexOf(item.accent);
  const before = item.text.slice(0, at).trim();
  const after = item.text.slice(at + item.accent.length).trim();
  const accent: Run = { text: item.accent, font: font("Magik Serif Italic", size * 1.12), color: accentColor };
  return [...(before ? [{ text: before, font: f, color }] : []), accent, ...(after ? [{ text: after, font: f, color }] : [])];
}

function drawText(ctx: Ctx, input: GraphicsInput, item: Text, t: number) {
  const { W, H, brand, plan, fps } = input;
  const base = Math.min(W, H);
  const p = phase(t, item.start, item.end, fps);
  const color = item.color ?? (item.style === "drip" ? "#D9161E" : "#FFFFFF");
  const accentColor = plan.captions.highlight_color;
  const spec = {
    caption: { family: "Magik Sans SemiBold", size: 0.05, upper: false },
    title: { family: "Magik Sans ExtraBold", size: 0.085, upper: false },
    hero: { family: "Magik Sans Black", size: 0.17, upper: true },
    serif: { family: "Magik Serif Italic", size: 0.13, upper: false },
    stacked: { family: "Magik Sans ExtraBold", size: 0.078, upper: false },
    boxed: { family: "Magik Sans SemiBold", size: 0.048, upper: false },
    label: { family: "Magik Sans Medium", size: 0.036, upper: false },
    drip: { family: "Magik Drip", size: 0.22, upper: true },
  }[item.style];
  let size = base * spec.size;
  const display = { ...item, text: spec.upper ? item.text.toUpperCase() : item.text, accent: item.accent && spec.upper ? item.accent.toUpperCase() : item.accent };

  ctx.save();
  let alpha = item.animation === "none" ? 1 : clamp01(p.introP / 0.45);
  if (p.outro >= 0) alpha *= clamp01(p.outroP);
  ctx.globalAlpha = alpha;

  const lineTexts = item.style === "stacked" || item.style === "drip" ? display.text.split(/\\n|\n/) : [display.text];
  // A drip logo's first line is the logo; any lines under it are a smaller kicker ("EPISODE 10").
  const KICKER = 0.42;
  // Shrink to fit: hero words fill the width but never overflow it.
  const big = item.style === "hero" || item.style === "drip";
  const fitW = W * (big ? 0.9 : 0.82);
  for (let i = 0; i < 8; i++) {
    ctx.font = font(spec.family, size, brand.fonts);
    const widest = Math.max(...(item.style === "drip" ? lineTexts.slice(0, 1) : lineTexts).map((l) => ctx.measureText(l).width));
    if (!big && item.style !== "serif") break;
    if (widest <= fitW) break;
    size *= 0.9;
  }
  const lineH = size * (big ? 1.0 : 1.18);
  const allLines = lineTexts.flatMap((l, i) => layoutRuns(ctx, textRuns({ ...display, text: l, accent: display.accent && l.includes(display.accent) ? display.accent : null }, spec.family, item.style === "drip" && i > 0 ? size * KICKER : size, color, accentColor, brand.fonts), fitW));
  const kickers = item.style === "drip" ? allLines.length - 1 : 0;
  // Stacked headlines build line by line; typewriter reveals letters.
  const visibleLines = item.style === "stacked" ? allLines.slice(0, Math.max(1, Math.floor((t - item.start) / 0.28) + 1)) : allLines;
  const blockH = kickers ? lineH + kickers * size * KICKER * 1.1 : allLines.length * lineH;
  // Behind the person, a top title sits lower so the head overlaps its lower part.
  const top = item.behind_subject && item.position === "top" ? Math.max(H * 0.13, H * 0.27 - blockH / 2) : anchorY(item.position, blockH, W, H);
  const cx = W / 2;
  const cy = top + blockH / 2;

  if (item.animation === "pop" && p.intro >= 0) {
    const s = 0.6 + 0.4 * backOut(p.introP);
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
  } else if (item.animation === "slide_up" && p.intro >= 0) {
    ctx.translate(0, (1 - easeOut(p.introP)) * H * 0.04);
  }

  let lines = visibleLines;
  if (item.animation === "typewriter") {
    const total = allLines.reduce((n, l) => n + l.runs.reduce((m, r) => m + r.text.length, 0), 0);
    let budget = Math.ceil(total * clamp01((t - item.start) / Math.max(0.3, total * 0.04)));
    lines = allLines.map((l) => ({
      ...l,
      runs: l.runs.flatMap((r) => {
        const take = Math.max(0, Math.min(r.text.length, budget));
        budget -= take;
        return take ? [{ ...r, text: r.text.slice(0, take) }] : [];
      }),
    }));
  }

  if (item.style === "boxed" || item.style === "caption") {
    const widest = Math.max(...allLines.map((l) => l.width));
    const padX = size * 0.7;
    const padY = size * 0.4;
    ctx.fillStyle = item.style === "boxed" ? (brand.colors.find((c) => /^#/.test(c)) ?? "#FFFFFF") : "rgba(0,0,0,0.62)";
    shadow(ctx, size * 0.5, 0.35);
    ctx.beginPath();
    ctx.roundRect(cx - widest / 2 - padX, top - padY, widest + padX * 2, blockH + padY * 2, size * 0.45);
    ctx.fill();
    noShadow(ctx);
    if (item.style === "boxed" && !item.color) lines = lines.map((l) => ({ ...l, runs: l.runs.map((r) => ({ ...r, color: luminance(ctx.fillStyle as string) > 0.6 ? "#141413" : "#FFFFFF" })) }));
  } else {
    shadow(ctx, size * (item.style === "hero" ? 0.25 : item.style === "drip" ? 0.12 : 0.35), item.style === "label" ? 0.7 : item.style === "drip" ? 0.35 : 0.55);
  }
  if (kickers) {
    drawRuns(ctx, lines.slice(0, 1), cx, top, lineH);
    drawRuns(ctx, lines.slice(1), cx, top + lineH * 0.98, size * KICKER * 1.1);
  } else drawRuns(ctx, lines, cx, top, lineH);
  ctx.restore();
  return `${p.intro},${p.outro},${visibleLines.length},${lines.reduce((n, l) => n + l.runs.reduce((m, r) => m + r.text.length, 0), 0)}`;
}

function luminance(hex: string) {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) / 255);
  return Number.isFinite(r) ? 0.2126 * r + 0.7152 * g + 0.0722 * b : 1;
}

// "1:16" -> 76, "351000" -> 351000; back to the same shape for display.
const parseValue = (s: string) => (s.includes(":") ? s.split(":").reduce((n, x) => n * 60 + Number(x), 0) : Number(s.replace(/[^\d.-]/g, "")));
function formatValue(v: number, like: string) {
  if (like.includes(":")) {
    const m = Math.floor(v / 60);
    return `${m}:${String(Math.round(v - m * 60)).padStart(2, "0")}`;
  }
  return v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e4 ? `${Math.round(v / 1e3)}K` : Math.round(v).toLocaleString("en-US");
}

function drawGraphic(ctx: Ctx, input: GraphicsInput, g: Graphic, t: number) {
  const { W, H, fps, plan } = input;
  const base = Math.min(W, H) * g.size;
  const x = g.x * W;
  const y = g.y * H;
  const p = phase(t, g.start, g.end, fps);
  const accent = plan.captions.highlight_color;
  const local = t - g.start;
  const dur = g.end - g.start;
  ctx.save();
  ctx.globalAlpha = clamp01(p.introP / 0.5) * (p.outro >= 0 ? clamp01(p.outroP) : 1);
  let key = `${p.intro},${p.outro}`;
  const popIn = () => {
    const s = 0.5 + 0.5 * backOut(p.introP);
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.translate(-x, -y);
  };

  if (g.kind === "progress_bar") {
    const frac = Math.round(clamp01(local / dur) * 270) / 270;
    key = `${frac}`;
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(0, 0, W, Math.max(6, H * 0.004));
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, W * frac, Math.max(6, H * 0.004));
  } else if (g.kind === "emoji") {
    popIn();
    ctx.font = font("Apple Color Emoji", base * 0.16);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(g.text, x, y);
  } else if (g.kind === "counter") {
    const [a, b] = g.text.split("|");
    const v = parseValue(a) + (parseValue(b) - parseValue(a)) * easeOut(local / Math.max(0.4, dur * 0.7));
    const shown = formatValue(v, b);
    key += shown;
    popIn();
    ctx.font = font("Magik Mono", base * 0.12);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    shadow(ctx, base * 0.04, 0.6);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(shown, x, y);
  } else if (g.kind === "circle") {
    const drawn = clamp01(local / 0.45);
    key += Math.round(drawn * 30);
    ctx.strokeStyle = accent;
    ctx.lineWidth = base * 0.012;
    ctx.lineCap = "round";
    ctx.beginPath();
    const r = base * 0.13;
    const steps = Math.max(2, Math.round(64 * drawn * 1.08));
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + (i / 64) * Math.PI * 2;
      const wobble = 1 + 0.04 * Math.sin(i * 0.7);
      const px = x + Math.cos(a) * r * 1.25 * wobble;
      const py = y + Math.sin(a) * r * wobble;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  } else if (g.kind === "comment_cta") {
    popIn();
    const label = "Comment ";
    const keyword = g.text.toUpperCase();
    const typed = Math.ceil(keyword.length * clamp01((local - 0.25) / Math.max(0.3, keyword.length * 0.07)));
    key += typed;
    const fs = base * 0.05;
    ctx.font = font("Magik Sans SemiBold", fs);
    const wLabel = ctx.measureText(label).width;
    ctx.font = font("Magik Sans Black", fs);
    const wKey = ctx.measureText(keyword).width;
    const avatar = fs * 1.5;
    const width = avatar + fs * 0.8 + wLabel + wKey + fs * 1.6;
    const height = fs * 2.3;
    shadow(ctx, fs * 0.6, 0.35);
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(x - width / 2, y - height / 2, width, height, height / 2);
    ctx.fill();
    noShadow(ctx);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x - width / 2 + fs * 0.5 + avatar / 2, y, avatar / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    let tx = x - width / 2 + fs * 0.5 + avatar + fs * 0.6;
    ctx.font = font("Magik Sans SemiBold", fs);
    ctx.fillStyle = "#555555";
    ctx.fillText(label, tx, y);
    tx += wLabel;
    ctx.font = font("Magik Sans Black", fs);
    ctx.fillStyle = "#141413";
    ctx.fillText(keyword.slice(0, typed), tx, y);
    if (typed < keyword.length && Math.floor(local * 3) % 2 === 0) ctx.fillRect(tx + ctx.measureText(keyword.slice(0, typed)).width + 2, y - fs * 0.5, fs * 0.08, fs);
  } else if (g.kind === "follow_pill") {
    popIn();
    const following = local > dur * 0.45;
    key += following ? "F" : "f";
    const fs = base * 0.045;
    const label = following ? "Following" : "Follow";
    ctx.font = font("Magik Sans SemiBold", fs);
    const handle = g.text ? `${g.text.startsWith("@") ? g.text : `@${g.text}`}  ` : "";
    const wHandle = handle ? ctx.measureText(handle).width : 0;
    const wLabel = ctx.measureText(label).width;
    const height = fs * 2.1;
    const pillW = wLabel + fs * 1.8;
    const width = wHandle + pillW;
    if (handle) {
      shadow(ctx, fs * 0.5, 0.6);
      ctx.fillStyle = "#FFFFFF";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText(handle, x - width / 2, y);
      noShadow(ctx);
    }
    ctx.fillStyle = following ? "#363636" : "#0095F6";
    ctx.beginPath();
    ctx.roundRect(x - width / 2 + wHandle, y - height / 2, pillW, height, fs * 0.5);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x - width / 2 + wHandle + pillW / 2, y);
  }
  ctx.restore();
  return key;
}

// ---------------------------------------------------------------- layers

function itemsFor(input: GraphicsInput, layer: Layer) {
  const { mode, preset, words_per_screen } = input.plan.captions;
  // In translate mode the caption items are the subtitles, drawn in the caption preset's look.
  const translated = mode === "translate";
  const texts = input.plan.on_screen_text.filter((t) => (layer === "behind") === t.behind_subject && !(translated && t.style === "caption"));
  const graphics = layer === "front" ? input.plan.graphics : [];
  const maxChars = input.W < input.H ? (preset === "subtitle" ? 34 : 22) : preset === "subtitle" ? 60 : 42;
  const captions =
    layer !== "front" ? [] : mode === "auto" ? captionScreens(input.words, words_per_screen, maxChars) : translated ? translatedScreens(input.plan.on_screen_text.filter((t) => t.style === "caption"), input.words) : [];
  return { texts, graphics, captions };
}

export function hasLayer(input: GraphicsInput, layer: Layer) {
  const { texts, graphics, captions } = itemsFor(input, layer);
  return texts.length + graphics.length + captions.length > 0;
}

// Time ranges the layer draws anything (the matte for text behind people is only needed there).
export function layerSpans(input: GraphicsInput, layer: Layer) {
  const { texts } = itemsFor(input, layer);
  return texts.map((t) => ({ start: t.start, end: t.end }));
}

// Draws the layer and writes a concat list (images with durations) that ffmpeg plays
// as one transparent video. Returns the list path.
export async function renderLayer(input: GraphicsInput, layer: Layer, dir: string) {
  await mkdir(dir, { recursive: true });
  const { W, H, fps, length } = input;
  const { texts, graphics, captions } = itemsFor(input, layer);
  // A caption hides while a title (in front or behind) shows the same words.
  const titleWords = (t: number) =>
    new Set(input.plan.on_screen_text.filter((x) => x.style !== "caption" && t >= x.start && t < x.end).flatMap((x) => x.text.split(/\s+/)).map(bare));

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const frames = Math.ceil(length * fps);
  const entries: { file: string; frames: number }[] = [];
  let lastKey = "";
  for (let f = 0; f < frames; f++) {
    const t = (f + 0.5) / fps;
    const keys: string[] = [];
    ctx.clearRect(0, 0, W, H);
    for (const [i, item] of texts.entries()) if (t >= item.start && t < item.end) keys.push(`t${i}:${drawText(ctx, input, item, t)}`);
    const screen = captions.findIndex((s) => t >= s.start && t < s.end);
    if (screen >= 0) {
      const hidden = titleWords(t);
      const s = captions[screen];
      if (!s.words.every((w) => hidden.has(bare(w.text)))) {
        const spoken = drawCaption(ctx, input, s, t);
        const newest = s.words[Math.max(0, spoken)];
        const pop = input.plan.captions.preset === "bold_pop" && newest ? Math.min(4, Math.floor((t - newest.start) * fps)) : 0;
        keys.push(`c${screen}:${spoken}:${pop}`);
      }
    }
    for (const [i, g] of graphics.entries()) if (t >= g.start && t < g.end) keys.push(`g${i}:${drawGraphic(ctx, input, g, t)}`);
    const key = keys.join("|");
    if (key === lastKey && entries.length) {
      entries[entries.length - 1].frames++;
      continue;
    }
    lastKey = key;
    const file = path.join(dir, `${layer}-${String(entries.length).padStart(5, "0")}.png`);
    await writeFile(file, await canvas.encode("png"));
    entries.push({ file, frames: 1 });
  }
  const list = path.join(dir, `${layer}.txt`);
  const lines = entries.flatMap((e) => [`file '${e.file.replace(/'/g, "'\\''")}'`, `duration ${(e.frames / fps).toFixed(6)}`]);
  // The concat demuxer needs the last image repeated to honor its duration.
  if (entries.length) lines.push(`file '${entries[entries.length - 1].file.replace(/'/g, "'\\''")}'`);
  await writeFile(list, lines.join("\n"));
  return { list, images: entries.length };
}
