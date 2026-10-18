// A 3D name plate that swings in on a hinge beside the speaker, with an accent
// bar, the name and the role, then swings back out.

import { easeIn, easeOut, el, fit, lerp, span, spring } from "../kit.js";

export default function lowerThird3d(root, spec) {
  const { W, H, duration, props } = spec;
  const S = Math.min(W, H) / 1080;
  const accent = props.accent;
  const outAt = duration - 0.4;

  const stage = el("div", { position: "absolute", inset: "0", perspective: `${1300 * S}px` }, root);
  const top = props.position === "top" ? H * 0.16 : props.position === "center" ? H * 0.42 : H * 0.58;
  const plate = el("div", {
    position: "absolute", left: `${W * 0.06}px`, top: `${top}px`, maxWidth: `${W * 0.82}px`, display: "flex", alignItems: "stretch",
    transformOrigin: "0% 50%", transformStyle: "preserve-3d", filter: `drop-shadow(0 ${24 * S}px ${40 * S}px rgba(0,0,0,0.5))`,
  }, stage);
  const bar = el("div", { width: `${16 * S}px`, background: accent, borderRadius: `${8 * S}px 0 0 ${8 * S}px` }, plate);
  const body = el("div", { background: "rgba(12,12,18,0.94)", padding: `${22 * S}px ${36 * S}px ${24 * S}px ${28 * S}px`, borderRadius: `0 ${20 * S}px ${20 * S}px 0`, border: `${2 * S}px solid rgba(255,255,255,0.14)`, borderLeft: "0", overflow: "hidden", position: "relative" }, plate);
  const name = el("div", { fontFamily: "Magik Heavy", color: "#fff", lineHeight: "1", whiteSpace: "nowrap" }, body, props.title.toUpperCase());
  fit(name, W * 0.7, 92 * S);
  const role = el("div", { fontFamily: "Magik Mono", fontSize: `${30 * S}px`, letterSpacing: `${3 * S}px`, color: accent, marginTop: `${10 * S}px`, whiteSpace: "nowrap" }, body, props.subtitle.toUpperCase());

  return {
    frame(t) {
      const e = spring(t - 0.02, { stiffness: 170 });
      const out = easeIn(span(t, outAt, duration));
      plate.style.transform = `rotateY(${lerp(-95, -8, e) - out * 85}deg) rotateX(${Math.sin(t * 1.5) * 2}deg) translateZ(${(1 - e) * -120 * S}px)`;
      plate.style.opacity = Math.min(1, e * 2) * (1 - out);
      role.style.opacity = span(t, 0.3, 0.55);
      role.style.transform = `translateX(${(1 - easeOut(span(t, 0.3, 0.55))) * -30 * S}px)`;
      bar.style.transform = `scaleY(${easeOut(span(t, 0, 0.35))})`;
    },
  };
}
