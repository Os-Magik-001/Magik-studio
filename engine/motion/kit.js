// Shared motion helpers: easing, springs and layout.

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, p) => a + (b - a) * p;
// Progress of t through [a, b], 0 before and 1 after.
export const span = (t, a, b) => clamp01((t - a) / (b - a));
export const easeOut = (p) => 1 - (1 - clamp01(p)) ** 3;
export const easeIn = (p) => clamp01(p) ** 3;
export const easeInOut = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
// A damped spring from 0 to 1. Seconds since it started. The default damping (ratio 0.8)
// overshoots by about 1.5%: sharp, never bouncy.
export function spring(t, { stiffness = 170, damping = 1.6 * Math.sqrt(stiffness) } = {}) {
  if (t <= 0) return 0;
  const w = Math.sqrt(stiffness);
  const z = damping / (2 * w);
  if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}
// Deterministic noise for shakes and scatter.
export const rand = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
export function shake(t, start, strength, length = 0.35) {
  const p = (t - start) / length;
  if (p < 0 || p > 1) return { x: 0, y: 0, r: 0 };
  const k = (1 - p) ** 2 * strength;
  const f = Math.floor(t * 60);
  return { x: (rand(f) - 0.5) * 2 * k, y: (rand(f + 99) - 0.5) * 2 * k, r: (rand(f + 7) - 0.5) * k * 0.08 };
}

export function el(tag, style = {}, parent, text) {
  const e = document.createElement(tag);
  Object.assign(e.style, style);
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

// Shrinks a text element's font until its text fits the width. Measures the text
// itself (not its box, which may be full width), so call it once fonts are loaded.
export function fit(e, maxWidth, size) {
  const width = () => {
    const r = document.createRange();
    r.selectNodeContents(e);
    return r.getBoundingClientRect().width;
  };
  let s = size;
  e.style.fontSize = `${s}px`;
  for (let i = 0; i < 40 && width() > maxWidth; i++) {
    s *= 0.94;
    e.style.fontSize = `${s}px`;
  }
  return s;
}

export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
}
export const rgba = (hex, a) => `rgba(${hexToRgb(hex).join(",")},${a})`;

// Where an overlay's block sits vertically.
export const anchorY = (position, H) => (position === "top" ? H * 0.2 : position === "center" ? H * 0.47 : H * 0.6);

// A dark stage with soft light orbs drifting slowly: the backdrop of the full-frame
// motion-design templates (logo reveals, flows, devices).
export function backdrop(parent, W, H, accent) {
  const S = Math.min(W, H) / 1080;
  const stage = el("div", { position: "absolute", inset: "0", background: "#050506", overflow: "hidden" }, parent);
  const orbs = [
    { x: 0.2, y: 0.18, r: 520, c: rgba(accent, 0.28), sp: 0.31 },
    { x: 0.85, y: 0.55, r: 620, c: rgba(accent, 0.18), sp: 0.23 },
    { x: 0.35, y: 0.92, r: 480, c: "rgba(255,255,255,0.07)", sp: 0.37 },
  ].map((o) => ({ ...o, e: el("div", { position: "absolute", width: `${o.r * 2 * S}px`, height: `${o.r * 2 * S}px`, borderRadius: "50%", background: `radial-gradient(circle, ${o.c}, transparent 68%)` }, stage) }));
  return {
    stage,
    frame(t) {
      for (const [i, o] of orbs.entries()) {
        const x = (o.x + Math.sin(t * o.sp + i * 2) * 0.05) * W - o.r * S;
        const y = (o.y + Math.cos(t * o.sp * 0.8 + i) * 0.04) * H - o.r * S;
        o.e.style.transform = `translate(${x}px, ${y}px)`;
      }
    },
  };
}

// Plays a clip inside a template: the engine extracts the clip's frames, and each
// frame of the graphic shows the matching one (decoded before the screenshot). Rounded
// to the nearest frame, so motion blur's sub-frames never mix two pictures of the clip.
export function screenPlayer(img, screen, fps) {
  let shown = -1;
  return (t) => {
    if (!screen?.count) return undefined;
    const i = Math.max(0, Math.min(screen.count - 1, Math.round(t * fps)));
    if (i === shown) return undefined;
    shown = i;
    img.src = `${screen.base}/${String(i).padStart(5, "0")}.jpg`;
    return img.decode().catch(() => {});
  };
}

// A four-point sparkle, the icon of pills and kickers.
export function sparkle(parent, size, color) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  const p = document.createElementNS(ns, "path");
  p.setAttribute("d", "M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z");
  p.setAttribute("fill", color);
  svg.appendChild(p);
  parent.appendChild(svg);
  return svg;
}
