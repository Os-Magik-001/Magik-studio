// A floating 3D proof card: tilted dark card with a big number counting up,
// a label and a small rising bar chart, turning slowly so the depth reads.

import { easeIn, easeOut, el, fit, lerp, rgba, span, spring } from "../kit.js";

const parse = (s) => (s.includes(":") ? s.split(":").reduce((n, x) => n * 60 + Number(x), 0) : Number(s.replace(/[^\d.-]/g, "")));
function format(v, like) {
  if (like.includes(":")) {
    const m = Math.floor(v / 60);
    return `${m}:${String(Math.round(v - m * 60)).padStart(2, "0")}`;
  }
  const suffix = like.match(/[%x+$€]+$/)?.[0] ?? "";
  const prefix = like.match(/^[$€+]+/)?.[0] ?? "";
  const n = v >= 1e6 ? `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M` : v >= 1e4 ? `${Math.round(v / 1e3)}K` : Math.round(v).toLocaleString("en-US");
  return `${prefix}${n}${suffix}`;
}

export default function statCard(root, spec) {
  const { W, H, duration, props, fps } = spec;
  const S = Math.min(W, H) / 1080;
  const accent = props.accent;
  const outAt = duration - 0.3;
  const [fromRaw, toRaw] = props.title.includes("|") ? props.title.split("|") : ["0", props.title];
  const from = parse(fromRaw);
  const to = parse(toRaw);
  const countable = Number.isFinite(from) && Number.isFinite(to);

  const stage = el("div", { position: "absolute", inset: "0", perspective: `${1400 * S}px` }, root);
  const cardW = W * 0.72;
  const top = props.position === "top" ? H * 0.16 : props.position === "center" ? H * 0.36 : H * 0.5;
  const card = el("div", {
    position: "absolute", left: `${(W - cardW) / 2}px`, top: `${top}px`, width: `${cardW}px`, padding: `${36 * S}px ${44 * S}px`,
    borderRadius: `${40 * S}px`, background: "rgba(14,14,20,0.94)", color: "#fff",
    border: `${2 * S}px solid rgba(255,255,255,0.14)`, boxShadow: `0 ${40 * S}px ${90 * S}px rgba(0,0,0,0.5)`, overflow: "hidden",
  }, stage);
  const num = el("div", { fontFamily: "Magik Heavy", lineHeight: "1", whiteSpace: "nowrap", color: "#fff" }, card, countable ? format(to, toRaw) : toRaw);
  fit(num, cardW - 88 * S, 170 * S);
  const label = el("div", { fontFamily: "Magik Sans", fontWeight: "600", fontSize: `${40 * S}px`, color: "rgba(255,255,255,0.8)", marginTop: `${10 * S}px` }, card, props.subtitle);
  const bars = el("div", { display: "flex", alignItems: "flex-end", gap: `${10 * S}px`, height: `${90 * S}px`, marginTop: `${24 * S}px` }, card);
  const barEls = Array.from({ length: 9 }, (_, i) => el("div", { flex: "1", height: "0%", borderRadius: `${6 * S}px`, background: i === 8 ? accent : rgba(accent, 0.35 + i * 0.05) }, bars));

  return {
    frame(t) {
      const e = spring(t - 0.05, { stiffness: 150 });
      const out = easeIn(span(t, outAt, duration));
      card.style.transform = `translate3d(0, ${(1 - e) * 200 * S}px, ${(1 - e) * -500 * S}px) rotateY(${-16 + Math.sin(t * 1.2) * 6}deg) rotateX(${8 + (1 - e) * 40}deg) scale(${1 - out * 0.15})`;
      card.style.opacity = Math.min(1, e * 1.5) * (1 - out);
      // Counted on whole frames, so motion blur never mixes two numbers.
      const c = easeOut(span(Math.round(t * fps) / fps, 0.2, Math.min(duration - 0.4, 1.6)));
      if (countable) num.textContent = format(lerp(from, to, c), toRaw);
      label.style.opacity = span(t, 0.35, 0.6);
      barEls.forEach((b, i) => (b.style.height = `${(18 + i * 10) * easeOut(span(t, 0.3 + i * 0.05, 0.8 + i * 0.05))}%`));
    },
  };
}
