// Cast lineup: one 3D card per person on a dark stage with a glowing floor grid.
// Cards fly up in turn and settle into a fan that slowly turns, names on plates.

import * as THREE from "three";
import { backOut, easeIn, easeInOut, easeOut, el, fit, hexToRgb, lerp, particleField, rgba, span, spring } from "../kit.js";

export default function castLineup(root, spec) {
  const { W, H, duration, props, assets } = spec;
  const S = Math.min(W, H) / 1080;
  const accent = props.accent;
  const people = props.people;
  const n = people.length;
  const outAt = duration - 0.4;

  const stage = el("div", { position: "absolute", inset: "0", perspective: `${1800 * S}px`, overflow: "hidden", background: `radial-gradient(ellipse at 50% 35%, ${rgba(accent, 0.45)}, transparent 62%), #07070b` }, root);
  const grid = gridFloor(stage, W, H, accent);
  const particles = particleField(stage, W, H, accent, 160);

  const header = props.title
    ? el("div", { position: "absolute", left: "0", right: "0", top: `${H * 0.12}px`, textAlign: "center", fontFamily: "Magik Heavy", color: "#fff", whiteSpace: "nowrap", textShadow: `0 0 ${40 * S}px ${rgba(accent, 0.8)}` }, stage, props.title.toUpperCase())
    : null;
  if (header) fit(header, W * 0.88, 120 * S);
  const sub = props.subtitle ? el("div", { position: "absolute", left: "0", right: "0", top: `${H * 0.12 + 140 * S}px`, textAlign: "center", fontFamily: "Magik Mono", fontSize: `${30 * S}px`, letterSpacing: `${6 * S}px`, color: accent }, stage, props.subtitle.toUpperCase()) : null;

  const fan = el("div", { position: "absolute", left: "50%", top: `${H * 0.5}px`, width: "0", height: "0", transformStyle: "preserve-3d" }, stage);
  const cardW = Math.min(W * 0.5, (W * 1.3) / Math.max(n, 2));
  const cardH = cardW * 1.45;
  const cards = people.map((p, i) => {
    const card = el("div", {
      position: "absolute", left: `${-cardW / 2}px`, top: `${-cardH / 2}px`, width: `${cardW}px`, height: `${cardH}px`,
      borderRadius: `${30 * S}px`, overflow: "hidden", transformStyle: "preserve-3d",
      background: `linear-gradient(170deg, ${rgba(accent, 0.95)}, ${rgba(accent, 0.35)} 55%, #101016)`,
      border: `${3 * S}px solid rgba(255,255,255,0.75)`, boxShadow: `0 ${40 * S}px ${80 * S}px rgba(0,0,0,0.6)`,
    }, fan);
    el("div", { position: "absolute", inset: "0", background: `repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0 ${10 * S}px, transparent ${10 * S}px ${26 * S}px)` }, card);
    const img = el("img", { position: "absolute", left: "-10%", width: "120%", bottom: `${cardH * 0.12}px`, height: `${cardH * 0.92}px`, objectFit: "cover", objectPosition: "50% 20%", filter: `drop-shadow(0 ${12 * S}px ${20 * S}px rgba(0,0,0,0.5))` }, card);
    img.src = assets.people[i];
    const plate = el("div", { position: "absolute", left: "0", right: "0", bottom: "0", padding: `${18 * S}px ${16 * S}px ${20 * S}px`, background: "linear-gradient(transparent, rgba(0,0,0,0.85) 35%)", textAlign: "center", color: "#fff" }, card);
    const nm = el("div", { fontFamily: "Magik Heavy", whiteSpace: "nowrap", lineHeight: "1" }, plate, p.name.toUpperCase());
    fit(nm, cardW - 32 * S, 64 * S);
    el("div", { fontFamily: "Magik Sans", fontWeight: "600", fontSize: `${Math.max(20, 26 * S)}px`, color: "rgba(255,255,255,0.8)", marginTop: `${6 * S}px` }, plate, p.role);
    const shine = el("div", { position: "absolute", top: "-30%", bottom: "-30%", width: "40%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)", transform: "skewX(-18deg)" }, card);
    return { card, shine };
  });

  return {
    frame(t) {
      const out = easeIn(span(t, outAt, duration));
      grid.frame(t, 1 - out);
      particles.frame(t, 1 - out);
      stage.style.opacity = 1 - out * 0.15;
      if (header) {
        const h = backOut(span(t, 0.05, 0.45));
        header.style.transform = `translate3d(0, ${(1 - h) * -60 * S}px, ${(1 - h) * -400 * S}px) scale(${lerp(1.6, 1, easeOut(span(t, 0.05, 0.4)))})`;
        header.style.opacity = span(t, 0.05, 0.25) * (1 - out);
      }
      if (sub) sub.style.opacity = span(t, 0.35, 0.6) * (1 - out);

      // The fan turns slowly so the depth reads.
      fan.style.transform = `rotateX(8deg) rotateY(${Math.sin(t * 0.8) * 10}deg) translateZ(${lerp(-200, 0, easeOut(span(t, 0, 1.2))) * S}px)`;
      cards.forEach(({ card, shine }, i) => {
        const mid = (n - 1) / 2;
        const k = n > 1 ? (i - mid) / mid : 0;
        const e = spring(t - 0.25 - i * 0.12, { stiffness: 150, damping: 14 });
        const x = k * (n > 1 ? Math.min(W * 0.36, cardW * 0.78 * mid) : 0);
        const z = -Math.abs(k) * 160 * S;
        const leave = easeIn(span(t, outAt - 0.05 + i * 0.03, outAt + 0.3 + i * 0.03));
        card.style.transform = `translate3d(${x}px, ${(1 - e) * H * 0.6 + leave * H * 0.5}px, ${z}px) rotateY(${-k * 28}deg) rotateZ(${k * 6 + (1 - e) * 25}deg) rotateX(${(1 - e) * 50}deg)`;
        card.style.opacity = Math.min(1, e * 2) * (1 - leave);
        card.style.zIndex = String(100 - Math.round(Math.abs(k) * 10));
        shine.style.left = `${lerp(-60, 160, easeInOut(span(t, 0.9 + i * 0.1, 1.5 + i * 0.1)))}%`;
      });
    },
  };
}

// A neon grid floor receding into the distance, scrolling toward the camera.
function gridFloor(parent, W, H, accent) {
  const canvas = el("canvas", {}, parent);
  canvas.className = "gl";
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x07070b, 6, 26);
  const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);
  camera.position.set(0, 1.6, 6);
  camera.lookAt(0, 0.4, -4);
  const [r, g, b] = hexToRgb(accent).map((v) => v / 255);
  const grid = new THREE.GridHelper(60, 60, new THREE.Color(r, g, b), new THREE.Color(r * 0.6, g * 0.6, b * 0.6));
  grid.position.y = -2.6;
  scene.add(grid);
  return {
    frame(t, opacity) {
      grid.position.z = (t * 1.5) % 1;
      grid.material.opacity = opacity;
      grid.material.transparent = true;
      renderer.render(scene, camera);
    },
  };
}
