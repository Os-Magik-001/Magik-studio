// The end card: the logo comes forward out of a blur over a soft light, the tagline
// fades up under it in wide letter-spacing, then the website. Without a logo, the
// title is set as a wordmark. Full frame.

import { backdrop, easeOut, el, fit, lerp, rgba, span } from "../kit.js";

export default function logoReveal(root, spec) {
  const { W, H, props, assets } = spec;
  const S = Math.min(W, H) / 1080;
  const accent = props.accent;

  const stage = el("div", { position: "absolute", inset: "0", overflow: "hidden" }, root);
  const bg = backdrop(stage, W, H, accent);
  const light = el("div", { position: "absolute", left: `${W / 2 - 520 * S}px`, top: `${H * 0.45 - 520 * S}px`, width: `${1040 * S}px`, height: `${1040 * S}px`, borderRadius: "50%", background: `radial-gradient(circle, ${rgba(accent, 0.35)}, transparent 62%)` }, stage);
  const mark = assets.logo
    ? el("img", { position: "absolute", left: `${W * 0.17}px`, width: `${W * 0.66}px`, top: `${H * 0.45}px`, transform: "translateY(-50%)", objectFit: "contain" }, stage)
    : el("div", { position: "absolute", left: "0", right: "0", top: `${H * 0.45}px`, textAlign: "center", fontFamily: "Magik Elegant", color: "#fff", whiteSpace: "nowrap" }, stage, props.title);
  if (assets.logo) mark.src = assets.logo;
  else fit(mark, W * 0.84, 150 * S);
  const tagline = props.subtitle
    ? el("div", { position: "absolute", left: "0", right: "0", top: `${H * 0.45 + 170 * S}px`, textAlign: "center", fontFamily: "Magik Sans", fontWeight: "500", fontSize: `${30 * S}px`, letterSpacing: `${10 * S}px`, color: "rgba(255,255,255,0.8)" }, stage, props.subtitle.toUpperCase())
    : null;
  const site = assets.logo && props.title
    ? el("div", { position: "absolute", left: "0", right: "0", top: `${H * 0.8}px`, textAlign: "center", fontFamily: "Magik Sans", fontWeight: "600", fontSize: `${40 * S}px`, color: accent }, stage, props.title)
    : null;

  return {
    frame(t) {
      bg.frame(t);
      const p = easeOut(span(t, 0.05, 0.9));
      mark.style.opacity = String(p);
      mark.style.filter = `blur(${(1 - p) * 30 * S}px)`;
      mark.style.transform = `translateY(-50%) scale(${lerp(1.18, 1, p) + t * 0.01})`;
      light.style.opacity = String(easeOut(span(t, 0.2, 1.2)) * (0.85 + 0.15 * Math.sin(t * 1.6)));
      if (tagline) {
        const q = easeOut(span(t, 0.7, 1.3));
        tagline.style.opacity = String(q);
        tagline.style.letterSpacing = `${lerp(22, 10, q) * S}px`;
      }
      if (site) {
        const q = easeOut(span(t, 1.0, 1.5));
        site.style.opacity = String(q);
        site.style.transform = `translateY(${(1 - q) * 20 * S}px)`;
      }
    },
  };
}
