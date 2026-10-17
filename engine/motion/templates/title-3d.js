// Kinetic 3D title: each word flies in from deep space and slams into place with a
// flash and a camera shake; the letters have a real extruded edge in the accent.

import { backOut, easeIn, easeOut, el, fit, lerp, rgba, shake, span } from "../kit.js";

export default function title3d(root, spec) {
  const { W, H, duration, props } = spec;
  const S = Math.min(W, H) / 1080;
  const accent = props.accent;
  const outAt = duration - 0.3;
  const words = props.title.toUpperCase().split(/\s+/).filter(Boolean);

  const stage = el("div", { position: "absolute", inset: "0", perspective: `${1200 * S}px`, overflow: "hidden" }, root);
  const top = props.position === "top" ? H * 0.14 : props.position === "center" ? H * 0.38 : H * 0.55;
  const block = el("div", { position: "absolute", left: `${W * 0.05}px`, width: `${W * 0.9}px`, top: `${top}px`, transformStyle: "preserve-3d", textAlign: "center" }, stage);

  // Extrusion: stacked shadows stepping down and back in a darker accent.
  const depth = Array.from({ length: 14 }, (_, i) => `${0}px ${(i + 1) * 1.6 * S}px 0 ${rgba(accent, 1 - i * 0.045)}`).join(", ");
  const glow = `0 ${30 * S}px ${60 * S}px rgba(0,0,0,0.55)`;
  const line = el("div", { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: `${0.2 * 150 * S}px ${0.25 * 150 * S}px`, transformStyle: "preserve-3d" }, block);
  const wordEls = words.map((w) => el("div", {
    fontFamily: "Magik Heavy", fontSize: `${150 * S}px`, lineHeight: "1", color: "#fff", whiteSpace: "nowrap",
    textShadow: `${depth}, ${glow}`, background: "linear-gradient(180deg, #ffffff 30%, #d9d9e3)", WebkitBackgroundClip: "text",
  }, line, w));
  // Long titles shrink so they never pass the edges.
  const longest = wordEls.reduce((a, b) => (b.textContent.length > a.textContent.length ? b : a));
  const size = fit(longest, W * 0.9, 150 * S);
  wordEls.forEach((e) => (e.style.fontSize = `${size}px`));
  const sub = props.subtitle
    ? el("div", { marginTop: `${30 * S}px`, fontFamily: "Magik Sans", fontWeight: "800", fontSize: `${44 * S}px`, letterSpacing: `${3 * S}px`, color: "#fff", display: "inline-block", padding: `${10 * S}px ${26 * S}px`, background: accent, borderRadius: `${12 * S}px`, boxShadow: `0 ${16 * S}px ${40 * S}px ${rgba(accent, 0.5)}` }, block, props.subtitle.toUpperCase())
    : null;
  const flash = el("div", { position: "absolute", left: "0", right: "0", top: `${top - 200 * S}px`, height: `${600 * S}px`, background: `radial-gradient(ellipse at 50% 50%, ${rgba(accent, 0.9)}, transparent 65%)`, mixBlendMode: "screen" }, stage);

  return {
    frame(t) {
      const out = easeIn(span(t, outAt, duration));
      let hit = 0;
      wordEls.forEach((e, i) => {
        const a = 0.04 + i * 0.12;
        const p = span(t, a, a + 0.22);
        if (p >= 1) hit = Math.max(hit, a + 0.22);
        const z = lerp(1600, 0, easeIn(p)) * S;
        e.style.transform = `translate3d(0, ${(1 - p) * -40 * S}px, ${z}px) rotateX(${(1 - p) * 35}deg)`;
        e.style.opacity = Math.min(1, p * 3) * (1 - out);
      });
      const k = shake(t, hit || 99, 26 * S);
      block.style.transform = `translate3d(${k.x}px, ${k.y}px, 0) rotate(${k.r}deg) rotateX(${8 + Math.sin(t * 1.4) * 3}deg) rotateY(${Math.sin(t * 0.9) * 6}deg) scale(${1 - out * 0.1})`;
      flash.style.opacity = hit ? Math.max(0, 1 - (t - hit) / 0.35) * (1 - out) : 0;
      if (sub) {
        const s = backOut(span(t, 0.25 + words.length * 0.12, 0.55 + words.length * 0.12));
        sub.style.transform = `translateY(${(1 - s) * 40 * S}px) scale(${0.6 + 0.4 * s})`;
        sub.style.opacity = span(t, 0.25 + words.length * 0.12, 0.35 + words.length * 0.12) * (1 - out);
      }
    },
  };
}
