// The design page: runs one composition written by Claude for one video. The engine
// calls setup(spec) once, then renderAt(t) for every frame and takes a screenshot.
// The composition draws everything from the time it is given (no CSS animations,
// timers or randomness), so every frame is exactly reproducible. Images it shows
// (logo, frames of screen recordings) are decoded before each screenshot.

// Helpers the composition can use, as window.M.
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, p) => a + (b - a) * p;
const span = (t, a, b) => clamp((t - a) / (b - a));
const M = {
  clamp,
  lerp,
  span,
  easeOut: (p) => 1 - (1 - clamp(p)) ** 3,
  easeIn: (p) => clamp(p) ** 3,
  easeInOut: (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2),
  expoOut: (p) => (p >= 1 ? 1 : 1 - 2 ** (-10 * clamp(p))),
  // A damped spring from 0 to 1, seconds since it started; ratio 0.8 overshoots ~1.5%.
  spring(t, { stiffness = 170, damping = 1.6 * Math.sqrt(stiffness) } = {}) {
    if (t <= 0) return 0;
    const w = Math.sqrt(stiffness);
    const z = damping / (2 * w);
    if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
  },
  // Deterministic noise in [0, 1) for scatter and texture.
  rand(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  },
  // The URL of a video asset's frame at time t (seconds into that asset).
  frame(name, t) {
    const a = window.DATA.assets.find((x) => x.name === name);
    if (!a || a.kind !== "video") return "";
    const i = Math.max(0, Math.min(a.frames - 1, Math.round(t * a.fps)));
    return `${a.url}/${String(i).padStart(5, "0")}.jpg`;
  },
  // The URL of an image asset.
  image(name) {
    return window.DATA.assets.find((x) => x.name === name)?.url ?? "";
  },
  // The words spoken around time t (the timeline's own words, with their times).
  wordsAt(t, before = 0, after = 0) {
    return window.DATA.words.filter((w) => w.end >= t - before && w.start <= t + after);
  },
};
window.M = M;

let draw = null;
window.setup = async (spec) => {
  window.DATA = spec.data;
  const root = document.getElementById("stage");
  root.style.width = `${spec.W}px`;
  root.style.height = `${spec.H}px`;
  // One transparent pixel column keeps every screenshot RGBA (Chrome drops the alpha
  // channel of fully opaque frames, and a format switch breaks the compositing).
  root.style.clipPath = "inset(0 0 0 1px)";
  document.getElementById("comp-style").textContent = spec.css;
  root.innerHTML = spec.html;
  window.render = null;
  window.__errors = [];
  const script = document.createElement("script");
  script.textContent = `try {\n${spec.js}\n} catch (e) { window.__errors.push(String(e && e.stack || e)); }`;
  document.body.appendChild(script);
  if (typeof window.init === "function") await window.init();
  await document.fonts.ready;
  draw = window.render;
  if (typeof draw !== "function") window.__errors.push("The composition did not define window.render(t).");
  return window.__errors;
};

async function settled() {
  const imgs = [...document.images].filter((i) => i.getAttribute("src"));
  await Promise.all(imgs.map((i) => (i.complete ? i.decode().catch(() => {}) : new Promise((r) => { i.onload = i.onerror = r; }))));
}

window.renderAt = async (t) => {
  try {
    await draw?.(t);
  } catch (e) {
    window.__errors.push(`render(${t.toFixed(2)}): ${String((e && e.stack) || e)}`);
  }
  await settled();
  return window.__errors.length;
};
window.ready = true;
