// Draws a LogoSpec on a canvas: the six templates and the symbol set of the logo creator
// (logo-creator.tsx). A logo is laid out in font units first (the name set at 100 px, measured
// with the canvas's own text metrics, kerning kept), then scaled to fit the canvas. Nothing is
// fetched: symbols are vector paths drawn from the SVG path data below.

import { LOGO_FONTS, type LogoFontId, type LogoSpec, type LogoSymbolId } from "@/lib/logo-templates";

export type LogoFontFamily = (id: LogoFontId) => string;

// ---------------------------------------------------------------- type choices

const WEIGHT = Object.fromEntries(LOGO_FONTS.map((f) => [f.id, f.weight])) as Record<LogoFontId, number>;

// The tagline is set in caps in a companion face that stays light at small sizes: condensed
// and techy faces pair with themselves, heavy display sans with Poppins, serifs with Cormorant.
export const TAGLINE_FONT: Record<LogoFontId, LogoFontId> = {
  bebas: "bebas",
  archivo: "poppins",
  montserrat: "poppins",
  space: "space",
  unbounded: "poppins",
  syne: "poppins",
  poppins: "poppins",
  playfair: "cormorant",
  dmserif: "cormorant",
  cormorant: "cormorant",
};

// Stem thickness of each face as a share of its cap height, so bars and rules match the type.
const STEM: Record<LogoFontId, number> = {
  bebas: 0.16,
  archivo: 0.27,
  montserrat: 0.22,
  space: 0.18,
  unbounded: 0.21,
  syne: 0.21,
  poppins: 0.16,
  playfair: 0.2,
  dmserif: 0.17,
  cormorant: 0.12,
};

// The fonts a spec draws with (the name's face and the tagline's), to load before drawing.
export function logoFontsFor(spec: Pick<LogoSpec, "font">): LogoFontId[] {
  return spec.font === TAGLINE_FONT[spec.font] ? [spec.font] : [spec.font, TAGLINE_FONT[spec.font]];
}

// ---------------------------------------------------------------- symbols
// Each symbol is SVG path data in a 100 × 100 box. `box` is the ink bounds, used to centre the
// mark; `optical` evens out visual size (a ring reads larger than a star of the same box).

type SymbolPart = { d: string; rule?: "evenodd"; stroke?: number };
type SymbolArt = { parts: SymbolPart[]; box: [number, number, number, number]; optical: number };
type Pt = readonly [number, number];

const n2 = (v: number) => Math.round(v * 100) / 100;

// A closed polygon with rounded corners (one radius, or one per vertex).
function poly(points: Pt[], radius: number | number[] = 0) {
  const k = 0.5523;
  let d = "";
  points.forEach((p, i) => {
    const prev = points[(i - 1 + points.length) % points.length];
    const next = points[(i + 1) % points.length];
    const r = Array.isArray(radius) ? radius[i] : radius;
    if (!r) {
      d += `${i ? "L" : "M"}${n2(p[0])} ${n2(p[1])}`;
      return;
    }
    const l1 = Math.hypot(prev[0] - p[0], prev[1] - p[1]);
    const l2 = Math.hypot(next[0] - p[0], next[1] - p[1]);
    const t = Math.min(r, l1 / 2, l2 / 2);
    const a: Pt = [p[0] + ((prev[0] - p[0]) * t) / l1, p[1] + ((prev[1] - p[1]) * t) / l1];
    const b: Pt = [p[0] + ((next[0] - p[0]) * t) / l2, p[1] + ((next[1] - p[1]) * t) / l2];
    const c1: Pt = [a[0] + (p[0] - a[0]) * k, a[1] + (p[1] - a[1]) * k];
    const c2: Pt = [b[0] + (p[0] - b[0]) * k, b[1] + (p[1] - b[1]) * k];
    d += `${i ? "L" : "M"}${n2(a[0])} ${n2(a[1])}C${n2(c1[0])} ${n2(c1[1])} ${n2(c2[0])} ${n2(c2[1])} ${n2(b[0])} ${n2(b[1])}`;
  });
  return d + "Z";
}

function circle(cx: number, cy: number, r: number) {
  return `M${n2(cx - r)} ${n2(cy)}A${n2(r)} ${n2(r)} 0 1 0 ${n2(cx + r)} ${n2(cy)}A${n2(r)} ${n2(r)} 0 1 0 ${n2(cx - r)} ${n2(cy)}Z`;
}

function rrect(x: number, y: number, w: number, h: number, r: number) {
  return poly(
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    r,
  );
}

function starPoints(cx: number, cy: number, outer: number, inner: number, points: number): Pt[] {
  return Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  });
}

// Shrinks a convex polygon by d on every side (gem facets with even gaps between them).
function inset(points: Pt[], d: number): Pt[] {
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
  const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
  const lines = points.map((a, i) => {
    const b = points[(i + 1) % points.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    let nx = -dy / len;
    let ny = dx / len;
    if ((cx - a[0]) * nx + (cy - a[1]) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    return { px: a[0] + nx * d, py: a[1] + ny * d, dx, dy };
  });
  return points.map((_, i) => {
    const l1 = lines[(i - 1 + lines.length) % lines.length];
    const l2 = lines[i];
    const den = l1.dx * l2.dy - l1.dy * l2.dx;
    const t = ((l2.px - l1.px) * l2.dy - (l2.py - l1.py) * l2.dx) / den;
    return [l1.px + t * l1.dx, l1.py + t * l1.dy] as const;
  });
}

function wave(y: number) {
  return `M10 ${y}C16.7 ${y - 8} 23.3 ${y - 8} 30 ${y}S43.3 ${y + 8} 50 ${y}S63.3 ${y - 8} 70 ${y}S83.3 ${y + 8} 90 ${y}`;
}

function steam(x: number) {
  return `M${x} 33C${x - 6} 27 ${x + 6} 20 ${x} 13`;
}

function blade(hx: number, hy: number, px: number, py: number, tipY: number) {
  // From the middle of a handle's ring, through the pivot, to a point at tipY.
  const dx = px - hx;
  const dy = py - hy;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const t = (tipY - hy) / uy;
  const at = (d: number, off: number): Pt => [hx + ux * d - uy * off, hy + uy * d + ux * off];
  const w = 7.4;
  const belly = 11.5 + (t - 11.5) * 0.4;
  return poly([at(11.5, w), at(belly, w * 1.12), at(t, 0), at(belly, -w * 1.12), at(11.5, -w)], [0, 4, 1.4, 4, 0]);
}

const GEM = (() => {
  const TL: Pt = [27, 14];
  const TR: Pt = [73, 14];
  const GL: Pt = [3, 38];
  const GR: Pt = [97, 38];
  const P: Pt = [50, 93];
  const g1: Pt = [35, 38];
  const g2: Pt = [65, 38];
  const facets: Pt[][] = [
    [GL, TL, g1],
    [TL, TR, g2, g1],
    [TR, GR, g2],
    [GL, g1, P],
    [g1, g2, P],
    [g2, GR, P],
  ];
  return facets.map((f) => poly(inset(f, 1.9), 0.8)).join("");
})();

const SYMBOL_ART: Record<Exclude<LogoSymbolId, "none">, SymbolArt> = {
  spark: {
    parts: [{ d: "M50 2C52.6 32 68 47.4 98 50C68 52.6 52.6 68 50 98C47.4 68 32 52.6 2 50C32 47.4 47.4 32 50 2Z" }],
    box: [2, 2, 98, 98],
    optical: 1.12,
  },
  star: {
    parts: [{ d: poly(starPoints(50, 53.5, 49, 20.5, 5), [3.2, 1.6, 3.2, 1.6, 3.2, 1.6, 3.2, 1.6, 3.2, 1.6]) }],
    box: [3.4, 5, 96.6, 93],
    optical: 1.05,
  },
  diamond: { parts: [{ d: GEM }], box: [4.5, 15.5, 95.5, 90], optical: 1.1 },
  circle: { parts: [{ d: circle(50, 50, 46) + circle(50, 50, 29), rule: "evenodd" }], box: [4, 4, 96, 96], optical: 0.8 },
  bolt: {
    parts: [
      {
        d: poly(
          [
            [56, 4],
            [10, 59],
            [48.5, 59],
            [44, 96],
            [90, 41],
            [51.5, 41],
          ],
          [2.5, 2.5, 1.5, 2.5, 2.5, 1.5],
        ),
      },
    ],
    box: [10, 4, 90, 96],
    optical: 1.02,
  },
  leaf: {
    parts: [
      { d: "M20 80C16 44 40 14 90 10C86 60 56 84 20 80ZM25.4 71.4L74 26L28.6 74.6Z", rule: "evenodd" },
      { d: "M23 77L9 91", stroke: 5.5 },
    ],
    box: [6.2, 10, 90, 93.8],
    optical: 0.97,
  },
  wave: { parts: [30, 50, 70].map((y) => ({ d: wave(y), stroke: 8 })), box: [6, 20, 94, 80], optical: 0.92 },
  crown: {
    parts: [
      {
        d:
          poly(
            [
              [15, 80],
              [7, 33],
              [30, 54],
              [50, 23],
              [70, 54],
              [93, 33],
              [85, 80],
            ],
            [2.5, 1, 3, 1, 3, 1, 2.5],
          ),
      },
      // Overlapping shapes fill one by one: opposite windings would cancel where they meet.
      { d: circle(7, 29, 6.5) },
      { d: circle(50, 17.5, 7) },
      { d: circle(93, 29, 6.5) },
      { d: rrect(15, 85, 70, 9, 3) },
    ],
    box: [0.5, 10.5, 99.5, 94],
    optical: 1.0,
  },
  heart: {
    parts: [
      {
        d: "M50 90C24 70 4 54 4 32C4 17 15 7 29 7C39 7 46 13 50 21C54 13 61 7 71 7C85 7 96 17 96 32C96 54 76 70 50 90Z",
      },
    ],
    box: [4, 7, 96, 90],
    optical: 0.93,
  },
  scissors: {
    parts: [
      { d: circle(28, 75, 16) + circle(28, 75, 8) + circle(72, 75, 16) + circle(72, 75, 8), rule: "evenodd" },
      { d: blade(28, 75, 50, 46, 5) },
      { d: blade(72, 75, 50, 46, 5) },
    ],
    box: [12, 5, 88, 91],
    optical: 1.12,
  },
  camera: {
    parts: [
      {
        d:
          poly(
            [
              [6, 32],
              [33, 32],
              [39, 19],
              [61, 19],
              [67, 32],
              [94, 32],
              [94, 86],
              [6, 86],
            ],
            [11, 3, 4, 4, 3, 11, 11, 11],
          ) +
          circle(50, 58, 21) +
          circle(50, 58, 13.5) +
          circle(81, 44, 4.5),
        rule: "evenodd",
      },
    ],
    box: [6, 19, 94, 86],
    optical: 0.95,
  },
  coffee: {
    parts: [
      { d: "M12 40H72V64C72 79 61 89 47 89H37C23 89 12 79 12 64Z" },
      { d: circle(73, 57, 14.5) + circle(73, 57, 7.5), rule: "evenodd" },
      { d: rrect(4, 93, 76, 6, 3) },
      ...[30, 42, 54].map((x) => ({ d: steam(x), stroke: 5 })),
    ],
    box: [4, 10.5, 87.5, 99],
    optical: 0.94,
  },
  home: {
    parts: [
      {
        d:
          poly(
            [
              [50, 8],
              [95, 47],
              [84, 47],
              [84, 90],
              [16, 90],
              [16, 47],
              [5, 47],
            ],
            [3, 2.5, 1.5, 3, 3, 1.5, 2.5],
          ) +
          poly(
            [
              [41, 90],
              [41, 64],
              [59, 64],
              [59, 90],
            ],
            [0, 4, 4, 0],
          ),
        rule: "evenodd",
      },
      { d: rrect(68, 15, 10, 24, 1.5) },
    ],
    box: [5, 8, 95, 90],
    optical: 0.95,
  },
};

// The symbol as SVG data, for icon buttons that match the canvas exactly.
export function logoSymbolArt(id: LogoSymbolId) {
  if (id === "none") return null;
  const art = SYMBOL_ART[id];
  const [x0, y0, x1, y1] = art.box;
  const side = Math.max(x1 - x0, y1 - y0);
  const viewBox = [(x0 + x1 - side) / 2, (y0 + y1 - side) / 2, side, side].map(n2).join(" ");
  return { viewBox, parts: art.parts };
}

const PATHS = new Map<string, Path2D>();
function path2d(d: string) {
  let p = PATHS.get(d);
  if (!p) {
    p = new Path2D(d);
    PATHS.set(d, p);
  }
  return p;
}

// ---------------------------------------------------------------- colour

function luminance(hex: string) {
  const v = parseInt(hex.slice(1), 16);
  const ch = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrast(a: string, b: string) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Ink for letters set on a fill: the brand's primary when it reads, else white or near-black.
function inkOn(fill: string, preferred: string) {
  if (contrast(preferred, fill) >= 3) return preferred;
  return contrast("#FFFFFF", fill) >= contrast("#111111", fill) ? "#FFFFFF" : "#111111";
}

// ---------------------------------------------------------------- text

type Face = { id: LogoFontId; family: string; weight: number };

// A line of text with its glyphs placed one by one: kerning from the font, tracking added.
type Run = {
  chars: string[];
  xs: number[];
  ws: number[];
  font: string;
  size: number;
  left: number; // ink edges, from the run's origin
  right: number;
  ascent: number; // ink above and below the baseline
  descent: number;
};

function prepare(ctx: CanvasRenderingContext2D) {
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.direction = "ltr";
  if ("fontKerning" in ctx) ctx.fontKerning = "normal";
  if ("letterSpacing" in ctx) (ctx as { letterSpacing: string }).letterSpacing = "0px";
}

function measure(ctx: CanvasRenderingContext2D, text: string, face: Face, size: number, tracking: number): Run {
  const font = `${face.weight} ${n2(size)}px ${face.family}`;
  ctx.font = font;
  const chars = Array.from(text);
  const spacing = tracking * size;
  const xs: number[] = [];
  const ws: number[] = [];
  let prefix = "";
  chars.forEach((ch, i) => {
    prefix += ch;
    const w = ctx.measureText(ch).width;
    // Where the glyph lands when the prefix is set as one string: kerning included.
    xs.push(ctx.measureText(prefix).width - w + i * spacing);
    ws.push(w);
  });
  if (!chars.length) return { chars, xs, ws, font, size, left: 0, right: 0, ascent: 0, descent: 0 };
  const all = ctx.measureText(text);
  const first = ctx.measureText(chars[0]);
  const last = ctx.measureText(chars[chars.length - 1]);
  return {
    chars,
    xs,
    ws,
    font,
    size,
    left: xs[0] - first.actualBoundingBoxLeft,
    right: xs[xs.length - 1] + last.actualBoundingBoxRight,
    ascent: all.actualBoundingBoxAscent,
    descent: all.actualBoundingBoxDescent,
  };
}

const inkW = (r: Run) => r.right - r.left;
const midX = (r: Run) => (r.left + r.right) / 2;

function capHeight(ctx: CanvasRenderingContext2D, face: Face, size: number) {
  ctx.font = `${face.weight} ${n2(size)}px ${face.family}`;
  return ctx.measureText("H").actualBoundingBoxAscent || size * 0.7;
}

// ---------------------------------------------------------------- marks

type Box = { x0: number; y0: number; x1: number; y1: number };
type Mark = { box: Box; paint: (ctx: CanvasRenderingContext2D) => void };

function textMark(run: Run, x: number, y: number, color: string, alpha = 1): Mark {
  return {
    box: { x0: x + run.left, y0: y - run.ascent, x1: x + run.right, y1: y + run.descent },
    paint(ctx) {
      ctx.font = run.font;
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      run.chars.forEach((ch, i) => {
        if (ch.trim()) ctx.fillText(ch, x + run.xs[i], y);
      });
      ctx.globalAlpha = 1;
    },
  };
}

// `size` is the side of a square of the same area: wide marks (a crown, a wave) come out wider
// rather than smaller, so every symbol carries about the same visual weight.
function symbolMark(id: Exclude<LogoSymbolId, "none">, cx: number, cy: number, size: number, color: string): Mark {
  const art = SYMBOL_ART[id];
  const [bx0, by0, bx1, by1] = art.box;
  const bw = bx1 - bx0;
  const bh = by1 - by0;
  const k = (size * art.optical) / Math.sqrt(bw * bh);
  const w = bw * k;
  const h = bh * k;
  return {
    box: { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 },
    paint(ctx) {
      ctx.save();
      ctx.translate(cx - (bx0 + bw / 2) * k, cy - (by0 + bh / 2) * k);
      ctx.scale(k, k);
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const part of art.parts) {
        const p = path2d(part.d);
        if (part.stroke) {
          ctx.lineWidth = part.stroke;
          ctx.stroke(p);
        } else ctx.fill(p, part.rule ?? "nonzero");
      }
      ctx.restore();
    },
  };
}

function barMark(x: number, y: number, w: number, h: number, color: string): Mark {
  return {
    box: { x0: x, y0: y, x1: x + w, y1: y + h },
    paint(ctx) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, h / 2);
      ctx.fill();
    },
  };
}

function discMark(cx: number, cy: number, r: number, color: string): Mark {
  return {
    box: { x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r },
    paint(ctx) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    },
  };
}

function ringMark(cx: number, cy: number, r: number, width: number, color: string): Mark {
  return {
    box: { x0: cx - r - width / 2, y0: cy - r - width / 2, x1: cx + r + width / 2, y1: cy + r + width / 2 },
    paint(ctx) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    },
  };
}

// A superellipse (n = 5): the continuous-corner rounded square of app icons.
function squircleMark(cx: number, cy: number, size: number, color: string): Mark {
  const a = size / 2;
  return {
    box: { x0: cx - a, y0: cy - a, x1: cx + a, y1: cy + a },
    paint(ctx) {
      ctx.fillStyle = color;
      ctx.beginPath();
      const steps = 256;
      for (let i = 0; i < steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        const c = Math.cos(t);
        const s = Math.sin(t);
        const x = cx + a * Math.sign(c) * Math.abs(c) ** 0.4;
        const y = cy + a * Math.sign(s) * Math.abs(s) ** 0.4;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    },
  };
}

function shift(m: Mark, dx: number, dy: number): Mark {
  return {
    box: { x0: m.box.x0 + dx, y0: m.box.y0 + dy, x1: m.box.x1 + dx, y1: m.box.y1 + dy },
    paint(ctx) {
      ctx.save();
      ctx.translate(dx, dy);
      m.paint(ctx);
      ctx.restore();
    },
  };
}

// ---------------------------------------------------------------- layout

const S = 100; // the name's font size, in layout units
const TAG_CAP = 0.3; // tagline cap height, as a share of the name's
const TAG_TRACK = 0.22;

type Env = {
  ctx: CanvasRenderingContext2D;
  spec: LogoSpec;
  nameFace: Face;
  tagFace: Face;
  name: string;
  tagline: string;
  nameRun: Run;
  capH: number;
  stem: number;
  tagSize: number;
  tagCapRatio: number;
  primary: string;
  accent: string;
  onAccent: string;
  tagColor: string;
  tagAlpha: number;
};

function env(ctx: CanvasRenderingContext2D, spec: LogoSpec, family: LogoFontFamily): Env {
  const face = (id: LogoFontId): Face => ({ id, family: family(id), weight: WEIGHT[id] });
  const nameFace = face(spec.font);
  const tagFace = face(TAGLINE_FONT[spec.font]);
  const name = (spec.uppercase ? spec.name.toLocaleUpperCase() : spec.name).trim();
  const tagline = spec.tagline.trim().toLocaleUpperCase();
  const capH = capHeight(ctx, nameFace, S);
  const tagCapRatio = capHeight(ctx, tagFace, S) / S;
  const { primary, accent, background } = spec.colors;
  // The tagline takes the accent when it reads on the ground the logo is made for (the set
  // background, else light for a dark name and dark for a light one); otherwise a softer primary.
  const ground = background ?? (luminance(primary) < 0.4 ? "#FFFFFF" : "#000000");
  const accentReads = contrast(accent, ground) >= 3;
  return {
    ctx,
    spec,
    nameFace,
    tagFace,
    name,
    tagline,
    nameRun: measure(ctx, name, nameFace, S, spec.tracking),
    capH,
    stem: STEM[spec.font] * capH,
    tagSize: (TAG_CAP * capH) / tagCapRatio,
    tagCapRatio,
    primary,
    accent,
    onAccent: inkOn(accent, primary),
    tagColor: accentReads ? accent : primary,
    tagAlpha: accentReads ? 1 : 0.74,
  };
}

// The tagline in tracked caps, fitted to the name's width: tightened (then shrunk) when wider;
// when it's at least about half as wide, locked up to the exact width (tracking first, then a
// slightly larger size so the spacing never gets extreme); a short line grows a little.
function taglineRun(e: Env, width: number, justify: boolean) {
  const text = e.tagline;
  const n = Array.from(text).length;
  let size = e.tagSize;
  let tr = TAG_TRACK;
  const w0 = inkW(measure(e.ctx, text, e.tagFace, size, 0)); // untracked width at the base size
  const perEm = Math.max(0, n - 1) * size; // width added by 1 em of tracking
  if (perEm > 0 && width > 0) {
    const natural = w0 + tr * perEm;
    if (natural > width) {
      tr = Math.max(0.08, (width - w0) / perEm);
      const w = w0 + tr * perEm;
      if (w > width) size *= Math.max(0.62, width / w);
    } else if (justify && natural >= width * 0.45) {
      tr = (width - w0) / perEm;
      if (tr > 0.45) {
        const grow = Math.min(1.25, width / (w0 + 0.45 * perEm));
        size *= grow;
        tr = Math.min(0.6, (width / grow - w0) / perEm);
      }
    } else if (natural < width * 0.45) {
      // A short line under a long name: a little larger and airier, so it isn't lost.
      size *= Math.min(1.35, Math.sqrt((width * 0.45) / natural));
      tr = 0.28;
    }
  }
  return measure(e.ctx, text, e.tagFace, size, tr);
}

// Initials sized to sit in a container: cap height up to maxCap, ink width up to maxW, centred
// on (cx, cy) by cap height so a Q's tail or a J's hook hangs naturally.
function initialsMark(e: Env, cx: number, cy: number, maxW: number, maxCap: number, color: string): Mark {
  const text = (e.spec.initials || "").toLocaleUpperCase();
  const tr = Math.max(-0.02, Math.min(0.06, e.spec.tracking * 0.5));
  const ref = measure(e.ctx, text, e.nameFace, S, tr);
  const capRef = e.capH;
  const k = Math.min(maxCap / capRef, inkW(ref) > 0 ? maxW / inkW(ref) : Infinity);
  const run = measure(e.ctx, text, e.nameFace, S * k, tr);
  return textMark(run, cx - midX(run), cy + (capRef * k) / 2, color);
}

// What sits inside a badge, tile or seal of size `d`: the symbol when one is picked, else the
// initials, fitted by count: [max width, max cap height] as shares of d for 1, 2, 3 letters.
function inner(e: Env, cx: number, cy: number, d: number, fit: [number, number][], symbolSize: number): Mark {
  if (e.spec.symbol !== "none") return symbolMark(e.spec.symbol, cx, cy, symbolSize * d, e.onAccent);
  const [w, c] = fit[Math.min(3, Math.max(1, Array.from(e.spec.initials).length)) - 1];
  return initialsMark(e, cx, cy, w * d, c * d, e.onAccent);
}

function wordmark(e: Env): Mark[] {
  const { nameRun: name, capH } = e;
  const hasSymbol = e.spec.symbol !== "none";
  const leftAlign = hasSymbol;
  const marks: Mark[] = [textMark(name, leftAlign ? -name.left : -midX(name), 0, e.primary)];
  let last = 0;
  if (e.tagline) {
    const tag = taglineRun(e, inkW(name), true);
    last = Math.max(name.descent, 0) + 0.36 * capH + tag.size * e.tagCapRatio;
    marks.push(textMark(tag, leftAlign ? -tag.left : -midX(tag), last, e.tagColor, e.tagAlpha));
  }
  if (e.spec.symbol !== "none") {
    // Beside the text, as tall as the block from the name's cap line to the last baseline.
    const span = last + capH;
    const size = Math.max(1.32 * capH, span * 1.04);
    const sym = symbolMark(e.spec.symbol, 0, (last - capH) / 2, size, e.accent);
    marks.push(shift(sym, -0.42 * capH - sym.box.x1, 0));
  }
  return marks;
}

function underline(e: Env): Mark[] {
  const { nameRun: name, capH } = e;
  const nameW = inkW(name);
  const marks: Mark[] = [textMark(name, -midX(name), 0, e.primary)];
  const barH = Math.max(0.075 * capH, e.stem * 0.7);
  const top = Math.max(name.descent, 0) + 0.4 * capH;
  let bottom = top + barH;
  if (e.spec.symbol !== "none") {
    const sym = symbolMark(e.spec.symbol, 0, top + barH / 2, 0.72 * capH, e.accent);
    const gap = 0.3 * capH;
    const barW = Math.min(Math.max(0.17 * nameW, 0.7 * capH), 1.9 * capH);
    marks.push(sym);
    marks.push(barMark(sym.box.x0 - gap - barW, top, barW, barH, e.accent));
    marks.push(barMark(sym.box.x1 + gap, top, barW, barH, e.accent));
    bottom = Math.max(bottom, sym.box.y1 - 0.16 * capH);
  } else {
    const barW = Math.min(Math.max(0.24 * nameW, 1.0 * capH), 2.6 * capH);
    marks.push(barMark(-barW / 2, top, barW, barH, e.accent));
  }
  if (e.tagline) {
    const tag = taglineRun(e, nameW, true);
    marks.push(textMark(tag, -midX(tag), bottom + 0.42 * capH + tag.size * e.tagCapRatio, e.tagColor, e.tagAlpha));
  }
  return marks;
}

function badge(e: Env): Mark[] {
  const { nameRun: name, capH } = e;
  const marks: Mark[] = [textMark(name, -name.left, 0, e.primary)];
  let last = 0;
  if (e.tagline) {
    const tag = taglineRun(e, inkW(name), true);
    last = Math.max(name.descent, 0) + 0.34 * capH + tag.size * e.tagCapRatio;
    marks.push(textMark(tag, -tag.left, last, e.tagColor, e.tagAlpha));
  }
  const D = Math.max(2.4 * capH, 1.34 * (last + capH));
  const cy = (last - capH) / 2;
  const cx = -0.28 * D - D / 2;
  marks.push(discMark(cx, cy, D / 2, e.accent));
  marks.push(inner(e, cx, cy, D, [[0.6, 0.46], [0.7, 0.4], [0.78, 0.32]], 0.52));
  return marks;
}

function tile(e: Env): Mark[] {
  const { nameRun: name, capH } = e;
  const nameW = inkW(name);
  const T = Math.min(Math.max(0.4 * nameW, 2.4 * capH), 4 * capH);
  const ty = -Math.max(name.ascent, capH) - 0.5 * capH - T / 2;
  const marks: Mark[] = [
    squircleMark(0, ty, T, e.accent),
    inner(e, 0, ty, T, [[0.58, 0.42], [0.7, 0.36], [0.78, 0.3]], 0.5),
    textMark(name, -midX(name), 0, e.primary),
  ];
  if (e.tagline) {
    const tag = taglineRun(e, Math.max(nameW, T), true);
    const y = Math.max(name.descent, 0) + 0.36 * capH + tag.size * e.tagCapRatio;
    marks.push(textMark(tag, -midX(tag), y, e.tagColor, e.tagAlpha));
  }
  return marks;
}

function stacked(e: Env): Mark[] {
  const { nameRun: name, capH } = e;
  const nameW = inkW(name);
  const marks: Mark[] = [textMark(name, -midX(name), 0, e.primary)];
  if (e.spec.symbol !== "none") {
    const sym = symbolMark(e.spec.symbol, 0, 0, Math.min(Math.max(0.24 * nameW, 2 * capH), 3 * capH), e.accent);
    marks.push(shift(sym, 0, -Math.max(name.ascent, capH) - 0.5 * capH - sym.box.y1));
  }
  if (e.tagline) {
    let y = Math.max(name.descent, 0) + 0.38 * capH;
    if (e.spec.symbol === "none") {
      // No symbol: a short accent rule between the name and the tagline.
      const h = Math.max(0.05 * capH, e.stem * 0.45);
      marks.push(barMark(-0.45 * capH, y, 0.9 * capH, h, e.accent));
      y += h + 0.38 * capH;
    }
    const tag = taglineRun(e, nameW, true);
    marks.push(textMark(tag, -midX(tag), y + tag.size * e.tagCapRatio, e.tagColor, e.tagAlpha));
  }
  return marks;
}

// Text set on a circle around (0, 0): the top line reads clockwise with letters standing on the
// arc, the bottom line counter-clockwise with letters hanging from it, both centred on rMid.
function arcText(
  e: Env,
  text: string,
  face: Face,
  o: { cap: number; tracking: number; rMid: number; minSpan: number; maxSpan: number; top: boolean; color: string; alpha: number },
): Mark | null {
  if (!text) return null;
  const capRatio = capHeight(e.ctx, face, S) / S;
  let size = o.cap / capRatio;
  let tr = o.tracking;
  let run = measure(e.ctx, text, face, size, tr);
  const n = run.chars.length;
  const reach = (span: number) => span * o.rMid;
  if (inkW(run) > reach(o.maxSpan)) {
    const w0 = inkW(measure(e.ctx, text, face, size, 0));
    if (n > 1) tr = Math.max(0.04, (reach(o.maxSpan) - w0) / ((n - 1) * size));
    run = measure(e.ctx, text, face, size, tr);
    if (inkW(run) > reach(o.maxSpan)) {
      size *= reach(o.maxSpan) / inkW(run);
      run = measure(e.ctx, text, face, size, tr);
    }
  } else if (inkW(run) < reach(o.minSpan) && n > 1) {
    const w0 = inkW(measure(e.ctx, text, face, size, 0));
    tr = Math.min(0.5, (reach(o.minSpan) - w0) / ((n - 1) * size));
    run = measure(e.ctx, text, face, size, tr);
  }
  const capH = capRatio * size;
  const center = midX(run);
  const rb = o.top ? o.rMid - capH / 2 : o.rMid + capH / 2;
  const R = o.rMid + capH;
  return {
    box: { x0: -R, y0: -R, x1: R, y1: R },
    paint(ctx) {
      ctx.font = run.font;
      ctx.fillStyle = o.color;
      ctx.globalAlpha = o.alpha;
      run.chars.forEach((ch, i) => {
        if (!ch.trim()) return;
        const along = (run.xs[i] + run.ws[i] / 2 - center) / o.rMid;
        ctx.save();
        ctx.rotate(o.top ? along : -along);
        ctx.fillText(ch, -run.ws[i] / 2, o.top ? -rb : rb);
        ctx.restore();
      });
      ctx.globalAlpha = 1;
    },
  };
}

function emblem(e: Env): Mark[] {
  // The seal is 200 u across (any scale works: it's drawn to fit). Rings in the primary, the
  // name and tagline on a band between the thin rings, a disc of accent in the middle.
  const u = (1.9 * e.capH) / 100;
  const marks: Mark[] = [
    ringMark(0, 0, 97.6 * u, 4.8 * u, e.primary),
    ringMark(0, 0, 90.5 * u, 1.3 * u, e.primary),
    ringMark(0, 0, 62.5 * u, 1.3 * u, e.primary),
    discMark(0, 0, 52 * u, e.accent),
  ];
  marks.push(inner(e, 0, 0, 104 * u, [[0.56, 0.4], [0.68, 0.34], [0.76, 0.28]], 0.54));
  const rMid = 76.5 * u;
  const deg = Math.PI / 180;
  const top = arcText(e, e.name, e.nameFace, {
    cap: 14 * u,
    tracking: 0.14 + Math.max(0, e.spec.tracking) * 0.5,
    rMid,
    minSpan: 70 * deg,
    maxSpan: (e.tagline ? 150 : 210) * deg,
    top: true,
    color: e.primary,
    alpha: 1,
  });
  if (top) marks.push(top);
  if (e.tagline) {
    const bottom = arcText(e, e.tagline, e.tagFace, {
      cap: 11 * u,
      tracking: 0.2,
      rMid,
      minSpan: 40 * deg,
      maxSpan: 112 * deg,
      top: false,
      color: e.tagColor,
      alpha: e.tagAlpha === 1 ? 1 : 0.85,
    });
    if (bottom) marks.push(bottom);
    marks.push(discMark(-rMid, 0, 2.6 * u, e.accent), discMark(rMid, 0, 2.6 * u, e.accent));
  } else {
    // No tagline: three stars close the ring.
    for (const [a, size] of [
      [0, 12],
      [-15, 8],
      [15, 8],
    ]) {
      const t = ((90 + a) * Math.PI) / 180;
      marks.push(symbolMark("star", rMid * Math.cos(t), rMid * Math.sin(t), size * u, e.accent));
    }
  }
  return marks;
}

const TEMPLATES: Record<LogoSpec["template"], (e: Env) => Mark[]> = {
  wordmark,
  underline,
  "monogram-circle": badge,
  "monogram-tile": tile,
  stacked,
  emblem,
};

type Layout = { marks: Mark[]; box: Box | null };

function layout(ctx: CanvasRenderingContext2D, spec: LogoSpec, family: LogoFontFamily): Layout {
  ctx.save();
  prepare(ctx);
  const marks = TEMPLATES[spec.template](env(ctx, spec, family));
  ctx.restore();
  let box: Box | null = null;
  for (const { box: b } of marks) {
    if (!(b.x1 > b.x0) || !(b.y1 > b.y0)) continue;
    box = box
      ? { x0: Math.min(box.x0, b.x0), y0: Math.min(box.y0, b.y0), x1: Math.max(box.x1, b.x1), y1: Math.max(box.y1, b.y1) }
      : { ...b };
  }
  return { marks, box };
}

function paint(ctx: CanvasRenderingContext2D, l: Layout, scale: number, tx: number, ty: number) {
  ctx.save();
  prepare(ctx);
  ctx.translate(tx, ty);
  ctx.scale(scale, scale);
  for (const m of l.marks) m.paint(ctx);
  ctx.restore();
}

// ---------------------------------------------------------------- public

/**
 * Draws the logo centred in `size` (canvas pixels), scaled to fit inside `padding` (a share of
 * the shorter side, 0.12 by default). The area is cleared first, so the ground stays
 * transparent unless spec.colors.background is set.
 */
export function drawLogo(
  ctx: CanvasRenderingContext2D,
  spec: LogoSpec,
  size: { width: number; height: number },
  fontFamily: LogoFontFamily,
  options: { padding?: number } = {},
) {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);
  if (spec.colors.background) {
    ctx.save();
    ctx.fillStyle = spec.colors.background;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
  const l = layout(ctx, spec, fontFamily);
  if (!l.box) return;
  const pad = (options.padding ?? 0.12) * Math.min(width, height);
  const bw = l.box.x1 - l.box.x0;
  const bh = l.box.y1 - l.box.y0;
  const scale = Math.max(0, Math.min((width - 2 * pad) / bw, (height - 2 * pad) / bh));
  paint(ctx, l, scale, width / 2 - (l.box.x0 + bw / 2) * scale, height / 2 - (l.box.y0 + bh / 2) * scale);
}

/**
 * The logo as a PNG `width` pixels wide (2048 by default), cropped to the drawn ink plus
 * `padding` (a share of the ink's longer side, 0.06 by default) all round. Transparent unless
 * spec.colors.background is set. Browser only; waits for the logo's fonts.
 */
export async function renderLogoPng(
  spec: LogoSpec,
  fontFamily: LogoFontFamily,
  options: { width?: number; padding?: number } = {},
): Promise<Blob> {
  const width = Math.round(options.width ?? 2048);
  const padding = options.padding ?? 0.06;
  if (document.fonts) {
    const text = `${spec.name}${spec.name.toLocaleUpperCase()}${spec.tagline.toLocaleUpperCase()}${spec.initials}`;
    await Promise.all(
      logoFontsFor(spec).map((id) => document.fonts.load(`${WEIGHT[id]} 64px ${fontFamily(id)}`, text).catch(() => [])),
    );
  }

  // 1. Draw large on a scratch canvas with a wide margin and find the real ink edges.
  const scratch = document.createElement("canvas");
  const sctx = scratch.getContext("2d", { willReadFrequently: true });
  if (!sctx) throw new Error("Canvas isn't available.");
  const l = layout(sctx, spec, fontFamily);
  if (!l.box) throw new Error("The logo is empty.");
  const bw = l.box.x1 - l.box.x0;
  const bh = l.box.y1 - l.box.y0;
  const s0 = 1600 / Math.max(bw, bh);
  const margin = Math.ceil(0.15 * 1600);
  scratch.width = Math.ceil(bw * s0) + 2 * margin;
  scratch.height = Math.ceil(bh * s0) + 2 * margin;
  const ox = margin - l.box.x0 * s0;
  const oy = margin - l.box.y0 * s0;
  paint(sctx, l, s0, ox, oy);
  const px = inkBounds(sctx.getImageData(0, 0, scratch.width, scratch.height));
  const ink = px
    ? { x0: (px.x0 - ox) / s0, y0: (px.y0 - oy) / s0, x1: (px.x1 + 1 - ox) / s0, y1: (px.y1 + 1 - oy) / s0 }
    : l.box;

  // 2. Draw again at the final scale, cropped to the ink plus padding.
  const iw = ink.x1 - ink.x0;
  const ih = ink.y1 - ink.y0;
  const pad = padding * Math.max(iw, ih);
  const scale = width / (iw + 2 * pad);
  const out = document.createElement("canvas");
  out.width = width;
  out.height = Math.max(1, Math.round((ih + 2 * pad) * scale));
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't available.");
  if (spec.colors.background) {
    ctx.fillStyle = spec.colors.background;
    ctx.fillRect(0, 0, out.width, out.height);
  }
  paint(ctx, l, scale, (pad - ink.x0) * scale, (pad - ink.y0) * scale);
  return new Promise((resolve, reject) =>
    out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The PNG couldn't be made."))), "image/png"),
  );
}

function inkBounds(img: ImageData) {
  const { data, width, height } = img;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3] > 6) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}
