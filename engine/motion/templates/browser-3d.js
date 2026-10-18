// A floating 3D browser window tilts in over a dark stage, a clip (the desktop site
// scrolling) playing inside, its address in the bar. An optional headline sits below.
// Full frame.

import { backdrop, easeIn, easeOut, el, fit, lerp, screenPlayer, span, spring } from "../kit.js";

export default function browser3d(root, spec) {
  const { W, H, duration, props, assets, fps } = spec;
  const S = Math.min(W, H) / 1080;
  const accent = props.accent;
  const outAt = duration - 0.45;

  const stage = el("div", { position: "absolute", inset: "0", perspective: `${2000 * S}px`, overflow: "hidden" }, root);
  const bg = backdrop(stage, W, H, accent);

  const bw = W * 0.94;
  const bar = bw * 0.055;
  const bh = bar + bw / 1.6;
  const win = el("div", {
    position: "absolute", left: `${(W - bw) / 2}px`, top: `${H * 0.42 - bh / 2}px`, width: `${bw}px`, height: `${bh}px`,
    borderRadius: `${bw * 0.025}px`, overflow: "hidden", background: "#111114",
    boxShadow: `0 ${60 * S}px ${130 * S}px rgba(0,0,0,0.75), 0 0 0 ${2 * S}px rgba(255,255,255,0.12)`, transformStyle: "preserve-3d",
  }, stage);
  const top = el("div", { position: "relative", height: `${bar}px`, background: "#1b1b1f", display: "flex", alignItems: "center", gap: `${bar * 0.22}px`, padding: `0 ${bar * 0.4}px` }, win);
  for (const c of ["#ff5f57", "#febc2e", "#28c840"]) el("div", { width: `${bar * 0.28}px`, height: `${bar * 0.28}px`, borderRadius: "50%", background: c }, top);
  const url = el("div", {
    position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", height: `${bar * 0.6}px`, padding: `0 ${bar * 0.6}px`,
    borderRadius: `${bar * 0.3}px`, background: "#2a2a30", color: "rgba(255,255,255,0.85)", fontFamily: "Magik Sans", fontWeight: "500",
    fontSize: `${bar * 0.32}px`, display: "flex", alignItems: "center", whiteSpace: "nowrap",
  }, top, props.subtitle || "");
  if (!props.subtitle) url.style.display = "none";
  const img = el("img", { display: "block", width: "100%", height: `${bh - bar}px`, objectFit: "cover", objectPosition: "50% 0%" }, win);
  el("div", { position: "absolute", inset: "0", background: "linear-gradient(120deg, rgba(255,255,255,0.08), transparent 35%)", pointerEvents: "none" }, win);
  const play = screenPlayer(img, assets.screen, fps);

  const title = props.title
    ? el("div", { position: "absolute", left: "0", right: "0", top: `${H * 0.42 + bh / 2 + 110 * S}px`, textAlign: "center", fontFamily: "Magik Elegant", color: "#fff", whiteSpace: "nowrap", lineHeight: "1.05" }, stage, props.title)
    : null;
  if (title) fit(title, W * 0.86, 96 * S);

  return {
    frame(t) {
      bg.frame(t);
      const e = spring(t - 0.05, { stiffness: 70 });
      const out = easeIn(span(t, outAt, duration));
      const rotX = lerp(38, 14, e) + Math.sin(t * 0.6) * 2 - out * 10;
      const rotY = lerp(-28, -10, e) + Math.sin(t * 0.45) * 4 + out * 20;
      const z = (lerp(-1800, 0, e) + out * 600) * S;
      win.style.transform = `translate3d(0, ${(1 - e) * 260 * S}px, ${z}px) rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${lerp(6, 2, e)}deg)`;
      win.style.opacity = Math.min(1, e * 1.6) * (1 - out);
      if (title) {
        const tIn = easeOut(span(t, 0.4, 0.85));
        title.style.opacity = tIn * (1 - out);
        title.style.transform = `translateY(${(1 - tIn) * 30 * S}px)`;
        title.style.filter = `blur(${(1 - tIn) * 10 * S}px)`;
      }
      return play(t);
    },
  };
}
