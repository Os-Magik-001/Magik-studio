// Mixed-type captions (the `mixed_type` preset), learned from @blackmedia.ve's real-estate
// walk-and-talk reels (Oct 2026). Each spoken phrase becomes a small type lockup instead of a
// subtitle line: a thin lead-in on top, one key word set big in a heavy face with a colour
// gradient (behind the person when the cut-out tool is there), and the rest tucked under it,
// right-aligned. Every word comes in on its own syllable, out of a blur. A phrase with no word
// worth a lockup is a small bold italic line at chest height.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import type { EditPlan } from "./plan.ts";
import { canvasFont, type Typography } from "./typefaces.ts";

const FONTS_DIR = fileURLToPath(new URL("../assets/fonts", import.meta.url));
// Static cuts: the canvas can't pick a weight inside a variable font.
const FACES: [string, string][] = [
  ["Poppins-ExtraBold.ttf", "Mix Geo"],
  ["Poppins-Light.ttf", "Mix Light"],
  ["PlayfairDisplay-BlackItalic.ttf", "Mix Serif"],
  ["PlayfairDisplay-BoldItalic.ttf", "Mix Serif Text"],
  ["Inter-BoldItalic.ttf", "Mix Grotesk"],
  ["Inter-LightItalic.ttf", "Mix Grotesk Light"],
  ["GreatVibes-Regular.ttf", "Mix Script"],
  ["ArchivoExpanded-ExtraBoldItalic.ttf", "Mix Wide"],
];
for (const [file, family] of FACES) GlobalFonts.registerFromPath(path.join(FONTS_DIR, file), family);

type Ctx = SKRSContext2D;
export type Word = { text: string; start: number; end: number };
type Captions = EditPlan["captions"];

// geo: thin geometric lead, heavy geometric key word in a light-to-deep gradient ("I positioned /
// Home / this"). serif: bold italic lead, black italic serif key word in a two-hue gradient ("and
// make / major decisions / today,"). script: a one-word script lead over a geometric key word
// ("Houses / Appreciate"). wide: thin italic lead, expanded italic capitals in one solid colour,
// for numbers ("and / ZERO ENTRY"). line: no key word.
export type Look = "geo" | "serif" | "script" | "wide" | "line";
export type Lockup = { words: Word[]; start: number; end: number; hero: [number, number] | null; look: Look };

// ---------------------------------------------------------------- choosing the key word

const STOP = new Set(
  (
    "a an the and or but so to of in on at for with from by is are was were be been being it its this that these those i you he she we they me my your our their his her them us " +
    "do does did not no yes just very really what which who how when where why if then than as about into over under up down out more most can will would should could have has had " +
    "im youre its thats theres there here also all any some one get got go going gonna like okay ok well oh yeah " +
    "because were theyre ill youll itll lets whats couldnt wouldnt shouldnt dont doesnt didnt cant wont isnt arent wasnt werent ive youve weve " +
    "le la les un une des de du et ou mais donc or ni car au aux en dans sur sous pour par avec sans ce cet cette ces ça ca je tu il elle on nous vous ils elles " +
    "me te se moi toi lui leur leurs mon ma mes ton ta tes son sa ses notre nos votre vos qui que quoi dont où est es suis sont être avoir ai as ont fait faire " +
    "pas ne plus très bien tout tous toute toutes là pis puis alors comme si oui non juste aussi même va vais vas veux peux peut faut bon ben genre quand " +
    "parce cest était avait vraiment beaucoup chose choses"
  ).split(" "),
);
const bare = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
// Without French elisions (l', d', j', t', qu'…), so "t'as" reads as "as".
const core = (s: string) => bare(s).replace(/^(?:l|d|j|t|qu|c|n|s|m)'/, "").replace(/'/g, "");
const isContent = (s: string) => core(s).length >= 4 && !STOP.has(core(s));
const hasDigit = (s: string) => /\d/.test(s);

// Highlight words and phrases as runs of words without elisions ("lash lift" -> ["lash", "lift"];
// "extension" also matches "d'extension").
export function highlightRuns(words: string[]) {
  return words.map((w) => w.split(/\s+/).map(core).filter(Boolean)).filter((r) => r.length);
}

// The span of a highlight phrase in `words` that covers index i, if any.
function highlightAt(words: Word[], i: number, runs: string[][]): [number, number] | null {
  for (const run of runs) {
    for (let k = 0; k < run.length; k++) {
      const from = i - k;
      if (from < 0 || from + run.length > words.length) continue;
      if (run.every((r, j) => core(words[from + j].text) === r)) return [from, from + run.length - 1];
    }
  }
  return null;
}

// The phrase's key word (or highlight phrase), when one deserves a lockup. Words that were the key
// word of the last few lockups (`recent`) count less, so a repeated "besoin" doesn't win every time.
export function chooseHero(words: Word[], runs: string[][], recent: string[] = []): [number, number] | null {
  let best: { span: [number, number]; score: number } | null = null;
  for (let i = 0; i < words.length; i++) {
    const hl = highlightAt(words, i, runs);
    const text = words[i].text;
    const plain = isContent(text) ? core(text).length - (recent.includes(core(text)) ? 4 : 0) : 0;
    const score = hl ? 100 + core(words.slice(hl[0], hl[1] + 1).map((w) => w.text).join("")).length : hasDigit(text) ? 60 + text.length : plain;
    if (score && (!best || score > best.score)) best = { span: hl ?? [i, i], score };
  }
  // A number keeps its unit: "12 hours", "8 semaines", "100 $".
  if (best && best.span[0] === best.span[1] && hasDigit(words[best.span[0]].text) && UNIT.test(core(words[best.span[0] + 1]?.text ?? ""))) best.span = [best.span[0], best.span[0] + 1];
  // A short ordinary word stays a line: a lockup needs a word that carries the phrase.
  if (!best || best.score < 6) return null;
  // Very long phrases as one key word don't fit: keep highlight spans to 3 words.
  if (best.span[1] - best.span[0] > 2) best.span = [best.span[0], best.span[0]];
  return best.span;
}

const UNIT = /^(?:hours?|hrs?|minutes?|mins?|seconds?|days?|weeks?|months?|years?|percent|dollars?|k|m|sq|square|feet|ft|heures?|minutes?|jours?|semaines?|mois|ans?|années?|pour(?:cent)?|dollars?|piastres?|[%$€])$/;

const startsSentence = (words: Word[], i: number, before: Word | undefined) => i === 0 && (!before || /[.?!,;:]$/.test(before.text));

// Picks the look of each lockup: geometric and serif alternate, numbers go wide, and a phrase that
// opens on one strong word gets the script lead-in.
function lookOf(words: Word[], hero: [number, number] | null, n: number, before: Word | undefined): Look {
  if (!hero) return "line";
  const heroText = words.slice(hero[0], hero[1] + 1).map((w) => w.text).join(" ");
  if (hasDigit(heroText)) return "wide";
  if (hero[0] === 1 && isContent(words[0].text) && startsSentence(words, 0, before)) return "script";
  return n % 2 === 0 ? "geo" : "serif";
}

// ---------------------------------------------------------------- phrases

const MAX_WORDS = 6;
const MAX_CHARS = 34;
const PAUSE = 0.38;

// Spoken words grouped into phrases (broken at punctuation, pauses and length, never inside a
// highlight phrase), each held until the next one, with its key word and look.
export function lockupScreens(spoken: Word[], highlights: string[]): Lockup[] {
  const runs = highlightRuns(highlights);
  // Transcribers split numbers ("10" ",000") and units ("100" "%"): one word each.
  const words: Word[] = [];
  for (const w of spoken) {
    const last = words.at(-1);
    if (last && /\d$/.test(last.text) && /^(?:[,.]\d|%)/.test(w.text)) words[words.length - 1] = { ...last, text: last.text + w.text, end: w.end };
    else words.push(w);
  }
  const phrases: Word[][] = [];
  let cur: Word[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const last = cur.at(-1);
    const chars = cur.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length;
    const span = last ? highlightAt(words, i - 1, runs) : null;
    const inside = !!span && span[1] >= i;
    if (last && !inside && (cur.length >= MAX_WORDS || chars > MAX_CHARS || w.start - last.end > PAUSE || /[.?!,;:]$/.test(last.text))) {
      phrases.push(cur);
      cur = [];
    }
    cur.push(w);
  }
  if (cur.length) phrases.push(cur);
  // A lone small word ("and", "mais") joins the phrase after it when that one has room.
  for (let i = 0; i < phrases.length - 1; i++) {
    const [p, next] = [phrases[i], phrases[i + 1]];
    if (p.length === 1 && !/[.?!]$/.test(p[0].text) && !isContent(p[0].text) && !hasDigit(p[0].text) && next.length < MAX_WORDS && next[0].start - p[0].end < 0.6) {
      phrases.splice(i, 2, [...p, ...next]);
      i--;
    }
  }
  return toLockups(phrases, runs);
}

// Lockups for phrases that are already grouped (translated subtitles, one line each).
export function lockupsFromScreens(screens: { words: Word[]; start: number; end: number }[], highlights: string[]): Lockup[] {
  const out = toLockups(screens.map((s) => s.words), highlightRuns(highlights));
  return out.map((l, i) => ({ ...l, start: screens[i].start, end: screens[i].end }));
}

// A key word's French elision ("d'", "l'", "qu'") moves to the end of the lead-in, so the big
// word starts on its own letter: "pas besoin d'" / "extension".
const ELISION = /^((?:l|d|j|t|qu|c|n|s|m)['’])(\p{L}.*)$/iu;
function splitElision(words: Word[], hero: [number, number]): { words: Word[]; hero: [number, number] } {
  const w = words[hero[0]];
  const m = w.text.match(ELISION);
  if (!m) return { words, hero };
  const parts = [{ ...w, text: m[1], end: w.start }, { ...w, text: m[2] }];
  return { words: [...words.slice(0, hero[0]), ...parts, ...words.slice(hero[0] + 1)], hero: [hero[0] + 1, hero[1] + 1] };
}

function toLockups(phrases: Word[][], runs: string[][]): Lockup[] {
  let heroes = 0;
  const recent: string[] = [];
  const out: Lockup[] = phrases.map((phrase, i) => {
    const found = chooseHero(phrase, runs, recent.slice(-4));
    const { words, hero } = found ? splitElision(phrase, found) : { words: phrase, hero: null };
    if (hero) recent.push(...words.slice(hero[0], hero[1] + 1).map((w) => core(w.text)));
    const before = phrases[i - 1]?.at(-1);
    const look = lookOf(words, hero, heroes, before);
    if (look === "geo" || look === "serif") heroes++;
    return { words, start: words[0].start, end: words.at(-1)!.end, hero, look };
  });
  // Hold each lockup until the next one, but not through long silences.
  for (let i = 0; i < out.length; i++) {
    const next = out[i + 1];
    out[i].end = next && next.start - out[i].end < 0.5 ? next.start : out[i].end + 0.3;
  }
  return out;
}

// ---------------------------------------------------------------- colour

const HEX = /^#[0-9a-f]{6}$/i;
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]) => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
export const mix = (a: string, b: string, p: number) => toHex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * p));

// The same colour turned around the colour wheel by `deg`.
export function shiftHue(hex: string, deg: number) {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d < 1e-6) return hex;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (((h * 60 + deg) % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex([r1 + m, g1 + m, b1 + m].map((v) => v * 255));
}

export type Palette = { ink: string; hi: string; second: string };

// The lockups' colours: the highlight colour, a partner for two-hue gradients (the brand's other
// colour, else a neighbour on the colour wheel: never a rainbow), and the ink of small words.
export function lockupPalette(c: Captions, brand: { colors: string[]; typography?: Typography | null }): Palette {
  const type = brand.typography;
  const hi = type?.colors.highlight ?? (HEX.test(c.highlight_color) ? c.highlight_color : "#7FD3F7");
  const ink = type?.colors.text ?? (HEX.test(c.color) ? c.color : "#FFFFFF");
  const near = (x: string) => rgb(x).reduce((n, v, i) => n + Math.abs(v - rgb(hi)[i]), 0) < 60;
  const brandSecond = (type ? [type.colors.accent] : brand.colors).find((x) => HEX.test(x) && !near(x) && x.toUpperCase() !== ink.toUpperCase() && !/^#(?:F{6}|0{6})$/i.test(x));
  return { ink, hi, second: brandSecond ?? shiftHue(hi, -40) };
}

// ---------------------------------------------------------------- layout

type Fill = { stops: string[]; x0: number; x1: number };
export type Piece = { text: string; font: string; size: number; x: number; y: number; w: number; at: number; hero: boolean; fill: Fill };
export type Layout = { pieces: Piece[]; cx: number; cy: number; box: { x: number; y: number; w: number; h: number } | null };

export type LockupOptions = { W: number; H: number; captions: Captions; palette: Palette; typography?: Typography | null };

const fontOf = (family: string, size: number) => `${Math.round(size)}px "${family}", "Apple Color Emoji", sans-serif`;
const clean = (s: string) => s.replace(/[.,;:!?]+$/, "");
const caseOf = (s: string, c: Captions["case"]) => (c === "lower" ? s.toLowerCase() : c === "upper" ? s.toUpperCase() : s);
// Words show slightly before they're heard, so they're on screen with the syllable.
const LEAD_TIME = 0.04;

function measure(ctx: Ctx, font: string, text: string) {
  ctx.font = font;
  const m = ctx.measureText(text);
  return { w: m.width, asc: m.actualBoundingBoxAscent, desc: m.actualBoundingBoxDescent };
}

// Words laid in a row from x on baseline y, one piece each.
function row(ctx: Ctx, words: Word[], font: string, size: number, x: number, y: number, fill: (x0: number, x1: number) => Fill, start: number, hero = false, text = (w: Word) => w.text): Piece[] {
  ctx.font = font;
  const space = ctx.measureText(" ").width + size * 0.04;
  const widths = words.map((w) => ctx.measureText(text(w)).width);
  const total = widths.reduce((n, w) => n + w, 0) + space * (words.length - 1);
  let cx = x;
  return words.map((w, i) => {
    const p: Piece = { text: text(w), font, size, x: cx, y, w: widths[i], at: Math.max(start, w.start - LEAD_TIME), hero, fill: fill(x, x + total) };
    cx += widths[i] + space;
    return p;
  });
}

const rowWidth = (ctx: Ctx, words: Word[], font: string, size: number, text = (w: Word) => w.text) => {
  ctx.font = font;
  return words.reduce((n, w) => n + ctx.measureText(text(w)).width, 0) + (ctx.measureText(" ").width + size * 0.04) * Math.max(0, words.length - 1);
};

// Where the key word's centre sits: head height for `center`, the creator-reel standard for this look.
const ANCHOR = { top: 0.29, center: 0.4, bottom: 0.6 };

export function layoutLockup(ctx: Ctx, l: Lockup, o: LockupOptions): Layout {
  const { W, H, captions: c, palette: pal, typography: type } = o;
  const solid = (color: string) => () => ({ stops: [color], x0: 0, x1: 1 });
  const cyHero = H * ANCHOR[c.position];

  if (!l.hero) {
    // A plain line: bold italic white, centred at chest height, two lines when it's long.
    let size = W * { small: 0.058, medium: 0.07, large: 0.082 }[c.size];
    const face = (s: number) => (type ? canvasFont(type, "text", s, true) : fontOf("Mix Grotesk", s));
    const words = l.words.map((w) => ({ ...w, text: caseOf(w.text, c.case) }));
    const maxW = W * 0.8;
    let lines = [words];
    if (rowWidth(ctx, words, face(size), size) > maxW && words.length > 1) {
      const half = Math.ceil(words.length / 2);
      lines = [words.slice(0, half), words.slice(half)];
    }
    while (Math.max(...lines.map((ln) => rowWidth(ctx, ln, face(size), size))) > maxW && size > W * 0.04) size *= 0.92;
    const lh = size * 1.12;
    const cy = cyHero + H * 0.075;
    const pieces = lines.flatMap((ln, i) => {
      const w = rowWidth(ctx, ln, face(size), size);
      return row(ctx, ln, face(size), size, W / 2 - w / 2, cy + (i - (lines.length - 1) / 2) * lh + size * 0.36, solid(pal.ink), l.start);
    });
    return { pieces, cx: W / 2, cy, box: null };
  }

  const [h0, h1] = l.hero;
  const lead = l.words.slice(0, h0);
  const heroWords = l.words.slice(h0, h1 + 1);
  const tail = l.words.slice(h1 + 1);
  const look = l.look;

  // The key word: big enough to fill most of the width, capped for short words.
  const heroFace = (s: number) =>
    look === "serif" ? (type ? canvasFont(type, "accent", s) : fontOf("Mix Serif", s)) : look === "wide" ? fontOf("Mix Wide", s) : type ? canvasFont(type, "title", s) : fontOf("Mix Geo", s);
  const heroText = (w: Word) => {
    const t = look === "serif" ? w.text : clean(w.text);
    return look === "wide" ? t.toUpperCase() : caseOf(t, c.case);
  };
  const letters = heroWords.map((w) => clean(w.text)).join("").length;
  const target = W * { small: 0.6, medium: 0.72, large: 0.84 }[c.size] * (letters <= 4 ? 0.82 : 1);
  const w100 = rowWidth(ctx, heroWords, heroFace(100), 100, heroText);
  const cap = W * (look === "serif" ? 0.25 : look === "wide" ? 0.16 : 0.21);
  const S = Math.min(cap, Math.max(W * 0.085, (100 * target) / Math.max(1, w100)));
  const heroW = rowWidth(ctx, heroWords, heroFace(S), S, heroText);
  const m = measure(ctx, heroFace(S), heroWords.map(heroText).join(" "));
  const heroX = W / 2 - heroW / 2;
  const heroBase = cyHero + (m.asc - m.desc) / 2;
  const heroTop = heroBase - m.asc;
  const heroBottom = heroBase + m.desc;
  const gradient =
    look === "wide" ? [pal.hi] : look === "serif" ? [pal.second, pal.hi] : [mix(pal.hi, "#FFFFFF", 0.5), pal.hi];
  const pieces: Piece[] = row(ctx, heroWords, heroFace(S), S, heroX, heroBase, (x0, x1) => ({ stops: gradient, x0, x1 }), l.start, true, heroText);

  // The lead-in: thin and small, left-aligned just inside the key word, tucked onto its cap line.
  if (lead.length) {
    const script = look === "script";
    const L = script ? S * 0.62 : Math.min(W * 0.068, Math.max(W * 0.044, S * (look === "serif" ? 0.4 : 0.34)));
    const face = script ? fontOf("Mix Script", L) : look === "serif" ? (type ? canvasFont(type, "text", L, true) : fontOf("Mix Grotesk", L)) : look === "wide" ? fontOf("Mix Grotesk Light", L) : fontOf("Mix Light", L);
    const text = (w: Word) => caseOf(script ? clean(w.text) : w.text, c.case);
    const lw = rowWidth(ctx, lead, face, L, text);
    const lm = measure(ctx, face, lead.map(text).join(" "));
    const x = lw > heroW * 0.92 ? W / 2 - lw / 2 : heroX + heroW * 0.04;
    // Script overlaps the key word's top; the others sit just on it.
    const y = script ? heroTop + S * 0.12 : heroTop - lm.desc - S * 0.03;
    pieces.push(...row(ctx, lead, face, L, x, y, solid(pal.ink), l.start, false, text));
  }

  // The tail: under the key word, right-aligned to it; in the serif look it stays serif.
  if (tail.length) {
    const T = look === "serif" ? Math.max(W * 0.05, S * 0.46) : Math.min(W * 0.068, Math.max(W * 0.044, S * 0.34));
    const face = look === "serif" ? (type ? canvasFont(type, "accent", T) : fontOf("Mix Serif Text", T)) : look === "wide" ? fontOf("Mix Grotesk Light", T) : fontOf("Mix Light", T);
    const text = (w: Word) => caseOf(w.text, c.case);
    const tw = rowWidth(ctx, tail, face, T, text);
    const tm = measure(ctx, face, tail.map(text).join(" "));
    const x = tw > heroW * 0.92 ? W / 2 - tw / 2 : heroX + heroW * 0.96 - tw;
    const y = heroBottom + tm.asc + S * (look === "serif" ? -0.02 : 0.05);
    pieces.push(...row(ctx, tail, face, T, x, y, solid(pal.ink), l.start, false, text));
  }

  // Keep the whole lockup inside the frame's margins and the platform's free area.
  const minX = Math.min(...pieces.map((p) => p.x));
  const maxX = Math.max(...pieces.map((p) => p.x + p.w));
  const dx = minX < W * 0.06 ? W * 0.06 - minX : maxX > W * 0.94 ? W * 0.94 - maxX : 0;
  const minY = Math.min(...pieces.map((p) => p.y - p.size * 0.9));
  const maxY = Math.max(...pieces.map((p) => p.y + p.size * 0.3));
  const dy = minY < H * 0.12 ? H * 0.12 - minY : maxY > H * 0.76 ? H * 0.76 - maxY : 0;
  for (const p of pieces) {
    p.x += dx;
    p.y += dy;
    p.fill = { ...p.fill, x0: p.fill.x0 + dx, x1: p.fill.x1 + dx };
  }
  return { pieces, cx: W / 2 + dx, cy: cyHero + dy, box: { x: heroX + dx, y: heroTop + dy, w: heroW, h: heroBottom - heroTop } };
}

// ---------------------------------------------------------------- drawing

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3;
// The whole lockup drifts this much larger over its time on screen, so it never sits dead still.
const DRIFT = 0.025;
const EXIT = 0.08;

// Draws one lockup at time t: the key word on the behind layer (when it goes behind the person),
// everything else on the front one.
export function drawLockup(ctx: Ctx, l: Lockup, layout: Layout, t: number, part: "hero" | "rest" | "all") {
  const drift = 1 + DRIFT * clamp01((t - l.start) / Math.max(0.6, l.end - l.start));
  const out = clamp01((l.end - t) / EXIT);
  ctx.save();
  ctx.translate(layout.cx, layout.cy);
  ctx.scale(drift, drift);
  ctx.translate(-layout.cx, -layout.cy);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  for (const p of layout.pieces) {
    if (t < p.at || (part === "hero" && !p.hero) || (part === "rest" && p.hero)) continue;
    const e = easeOut((t - p.at) / (p.hero ? 0.26 : 0.18));
    const blur = (1 - e) * Math.min(36, p.size * (p.hero ? 0.16 : 0.12));
    const scale = 1 + (p.hero ? 0.12 : 0.08) * (1 - e);
    const mx = p.x + p.w / 2;
    const my = p.y - p.size * 0.35;
    ctx.save();
    ctx.globalAlpha = e * out;
    if (blur > 0.3) ctx.filter = `blur(${blur.toFixed(1)}px)`;
    ctx.translate(mx, my + (1 - e) * p.size * 0.06);
    ctx.scale(scale, scale);
    ctx.translate(-mx, -my);
    ctx.font = p.font;
    if (p.fill.stops.length > 1) {
      const g = ctx.createLinearGradient(p.fill.x0, 0, p.fill.x1, 0);
      p.fill.stops.forEach((s, i) => g.addColorStop(i / (p.fill.stops.length - 1), s));
      ctx.fillStyle = g;
    } else ctx.fillStyle = p.fill.stops[0];
    // A soft shadow keeps white words readable on light walls; the key word's is lighter.
    ctx.shadowColor = `rgba(0,0,0,${p.hero ? 0.22 : 0.42})`;
    ctx.shadowBlur = p.size * (p.hero ? 0.1 : 0.3);
    ctx.shadowOffsetY = p.size * 0.04;
    ctx.fillText(p.text, p.x, p.y);
    ctx.restore();
  }
  ctx.restore();
}
