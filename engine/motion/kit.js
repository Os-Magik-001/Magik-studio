// Shared motion helpers: easing, springs, layout and a three.js particle field.

import * as THREE from "three";

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, p) => a + (b - a) * p;
// Progress of t through [a, b], 0 before and 1 after.
export const span = (t, a, b) => clamp01((t - a) / (b - a));
export const easeOut = (p) => 1 - (1 - clamp01(p)) ** 3;
export const easeIn = (p) => clamp01(p) ** 3;
export const easeInOut = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
export const backOut = (p, c = 1.9) => {
  const x = clamp01(p) - 1;
  return 1 + (c + 1) * x ** 3 + c * x ** 2;
};
// A damped spring from 0 to 1: overshoots, then settles. Seconds since it started.
export function spring(t, { stiffness = 170, damping = 14 } = {}) {
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

// Drifting glowing particles flying toward the camera, drawn with three.js.
export function particleField(parent, W, H, accent, count = 260) {
  const canvas = el("canvas", {}, parent);
  canvas.className = "gl";
  canvas.width = W;
  canvas.height = H;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
  camera.position.z = 8;
  const sprite = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.25, "rgba(255,255,255,0.7)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const geo = new THREE.BufferGeometry();
  const base = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const [ar, ag, ab] = hexToRgb(accent).map((v) => v / 255);
  for (let i = 0; i < count; i++) {
    base[i * 3] = (rand(i) - 0.5) * 14;
    base[i * 3 + 1] = (rand(i + 500) - 0.5) * 22;
    base[i * 3 + 2] = rand(i + 900) * 16 - 12;
    const white = rand(i + 77) > 0.55;
    colors.set(white ? [1, 1, 1] : [ar, ag, ab], i * 3);
  }
  const pos = new Float32Array(base);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({ size: 0.12, map: sprite, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  return {
    canvas,
    frame(t, opacity = 1) {
      for (let i = 0; i < count; i++) {
        // Each particle travels toward the camera and wraps around.
        const z = ((base[i * 3 + 2] + 12 + t * (2.2 + rand(i + 3) * 2.5)) % 16) - 12;
        pos[i * 3 + 2] = z;
        pos[i * 3] = base[i * 3] + Math.sin(t * 0.7 + i) * 0.15;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = opacity;
      renderer.render(scene, camera);
    },
  };
}

// Where an overlay's block sits vertically.
export const anchorY = (position, H) => (position === "top" ? H * 0.2 : position === "center" ? H * 0.47 : H * 0.6);
