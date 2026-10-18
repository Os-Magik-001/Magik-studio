// A 3D phone flies in over a dark stage and settles at an angle, turning slowly, with a
// clip (a website or app scrolling) playing on its screen. An optional headline sits
// above it. Full frame.

import { backdrop, easeIn, easeOut, el, fit, lerp, screenPlayer, span, spring } from "../kit.js";

export default function phone3d(root, spec) {
  const { W, H, duration, props, assets, fps } = spec;
  const S = Math.min(W, H) / 1080;
  const accent = props.accent;
  const outAt = duration - 0.45;

  const stage = el("div", { position: "absolute", inset: "0", perspective: `${2400 * S}px`, overflow: "hidden" }, root);
  const bg = backdrop(stage, W, H, accent);
  const head = props.title ? H * 0.16 : 0;
  const kicker = props.subtitle
    ? el("div", { position: "absolute", left: "0", right: "0", top: `${H * 0.07}px`, textAlign: "center", fontFamily: "Magik Sans", fontWeight: "600", fontSize: `${30 * S}px`, letterSpacing: `${8 * S}px`, color: accent }, stage, props.subtitle.toUpperCase())
    : null;
  const title = props.title
    ? el("div", { position: "absolute", left: "0", right: "0", top: `${H * 0.095}px`, textAlign: "center", fontFamily: "Magik Elegant", color: "#fff", whiteSpace: "nowrap", lineHeight: "1.05" }, stage, props.title)
    : null;
  if (title) fit(title, W * 0.86, 104 * S);

  // The phone: a dark titanium body, a thin bezel, the screen and the island.
  const pw = W * (head ? 0.56 : 0.62);
  const ph = pw * 2.06;
  const top = head + (H - head - ph) / 2 + H * 0.02;
  const phone = el("div", {
    position: "absolute", left: `${(W - pw) / 2}px`, top: `${top}px`, width: `${pw}px`, height: `${ph}px`,
    borderRadius: `${pw * 0.16}px`, background: "#0b0b0d", padding: `${pw * 0.028}px`,
    boxShadow: `0 ${70 * S}px ${140 * S}px rgba(0,0,0,0.75), inset 0 0 0 ${3 * S}px #3a3a40, inset 0 0 0 ${7 * S}px #151518`,
    transformStyle: "preserve-3d",
  }, stage);
  const glass = el("div", { position: "relative", width: "100%", height: "100%", borderRadius: `${pw * 0.135}px`, overflow: "hidden", background: "#000" }, phone);
  const img = el("img", { position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 0%" }, glass);
  el("div", { position: "absolute", left: "50%", top: `${pw * 0.035}px`, width: `${pw * 0.3}px`, height: `${pw * 0.085}px`, marginLeft: `${-pw * 0.15}px`, borderRadius: `${pw * 0.05}px`, background: "#000" }, glass);
  // A faint reflection across the glass, fixed to the phone so it reads as a surface.
  el("div", { position: "absolute", inset: "0", background: "linear-gradient(125deg, rgba(255,255,255,0.10), transparent 38%)" }, glass);
  const play = screenPlayer(img, assets.screen, fps);

  return {
    frame(t) {
      bg.frame(t);
      const e = spring(t - 0.05, { stiffness: 70 });
      const out = easeIn(span(t, outAt, duration));
      const rotY = lerp(-42, -16, e) + Math.sin(t * 0.7) * 5 - out * 30;
      const rotX = lerp(30, 9, e) + Math.sin(t * 0.5) * 2 + out * 12;
      const z = (lerp(-1600, 0, e) + out * 700) * S;
      const y = ((1 - e) * 380 - out * 120) * S;
      phone.style.transform = `translate3d(0, ${y}px, ${z}px) rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${lerp(-14, -5, e)}deg)`;
      phone.style.opacity = Math.min(1, e * 1.6) * (1 - out);
      const tIn = easeOut(span(t, 0.35, 0.8));
      if (title) {
        title.style.opacity = tIn * (1 - out);
        title.style.transform = `translateY(${(1 - tIn) * 30 * S}px)`;
        title.style.filter = `blur(${(1 - tIn) * 10 * S}px)`;
      }
      if (kicker) kicker.style.opacity = easeOut(span(t, 0.25, 0.6)) * (1 - out);
      return play(t);
    },
  };
}
