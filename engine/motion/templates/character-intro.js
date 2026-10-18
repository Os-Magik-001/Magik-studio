// Freeze-frame character intro: the frame drains to a dark, tinted backdrop, the
// person is cut out and pops forward with a white outline, their name runs in
// giant rows behind them, and a dark card flips up in 3D with the role and stats.
// In the last moments everything clears away and the frame is back to normal, so
// the cut to the next shot reads as the video un-pausing.

import { easeIn, easeInOut, easeOut, el, fit, lerp, rgba, shake, span, spring } from "../kit.js";

export default function characterIntro(root, spec) {
  const { W, H, duration, props, assets, fps } = spec;
  const S = Math.min(W, H) / 1080;
  const accent = props.accent;
  const name = props.title.toUpperCase();
  const outAt = duration - 0.45;

  const stage = el("div", { position: "absolute", inset: "0", perspective: `${1600 * S}px`, overflow: "hidden" }, root);
  // The backdrop is flat and behind everything; only the name, the person and the
  // card live in 3D, so nothing tilts through the background.
  const back = el("div", { position: "absolute", inset: "0", overflow: "hidden" }, stage);
  const world = el("div", { position: "absolute", inset: "0", transformStyle: "preserve-3d" }, stage);

  // The frozen frame, drained and pushed in slowly.
  const bg = el("img", { position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover" }, back);
  bg.src = assets.frame;
  const tint = el("div", { position: "absolute", inset: "0", background: rgba(accent, 0.6), mixBlendMode: "multiply" }, back);

  // Three rows of the name: outline, filled, outline, sliding against each other.
  const rows = [0, 1, 2].map((i) => {
    const row = el("div", {
      position: "absolute", left: "0", top: `${H * 0.13 + i * H * 0.105}px`, whiteSpace: "nowrap",
      fontFamily: "Magik Heavy", fontSize: `${300 * S}px`, lineHeight: "1", letterSpacing: `${-6 * S}px`,
      color: i === 1 ? accent : "transparent", WebkitTextStroke: i === 1 ? "0" : `${3 * S}px rgba(255,255,255,0.85)`,
    }, world, `${name}  ${name}  ${name}  ${name}`);
    return row;
  });

  // The person, cut out of the same frame, so it lines up exactly until it pops.
  const person = el("img", {
    position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", transformOrigin: "50% 70%",
    filter: [4, -4].flatMap((d) => [`drop-shadow(${d * S}px 0 0 #fff)`, `drop-shadow(0 ${d * S}px 0 #fff)`]).join(" ") + ` drop-shadow(0 ${30 * S}px ${50 * S}px rgba(0,0,0,0.65))`,
  }, world);
  person.src = assets.cutout;

  // The 3D info card.
  const cardW = W * 0.84;
  const card = el("div", {
    position: "absolute", left: `${(W - cardW) / 2}px`, top: `${H * 0.585}px`, width: `${cardW}px`, padding: `${30 * S}px ${44 * S}px ${34 * S}px`,
    borderRadius: `${38 * S}px`, background: "rgba(12,12,18,0.94)",
    border: `${2 * S}px solid rgba(255,255,255,0.14)`, boxShadow: `0 ${40 * S}px ${90 * S}px rgba(0,0,0,0.55)`,
    transformOrigin: "50% 100%", overflow: "hidden", color: "#fff",
  }, world);
  const edge = el("div", { position: "absolute", left: "0", top: "0", bottom: "0", width: `${10 * S}px`, background: accent }, card);
  const kicker = el("div", { fontFamily: "Magik Mono", fontSize: `${28 * S}px`, letterSpacing: `${4 * S}px`, color: accent, display: "flex", alignItems: "center", gap: `${14 * S}px` }, card);
  el("div", { width: `${16 * S}px`, height: `${16 * S}px`, borderRadius: "50%", background: accent }, kicker);
  el("span", {}, kicker, props.kicker || `MEMBER ${String(props.index ?? 1).padStart(2, "0")}`);
  const nameEl = el("div", { fontFamily: "Magik Heavy", lineHeight: "1.02", marginTop: `${10 * S}px`, whiteSpace: "nowrap" }, card, name);
  fit(nameEl, cardW - 88 * S, 132 * S);
  const role = el("div", { fontFamily: "Magik Sans", fontWeight: "600", fontSize: `${44 * S}px`, color: "rgba(255,255,255,0.82)", marginTop: `${6 * S}px` }, card, props.subtitle);
  const stats = props.lines.map((line) => {
    const [label, value] = line.split("|");
    const pct = value !== undefined && /^\s*\d+(\.\d+)?\s*$/.test(value) ? Math.min(100, Number(value)) : null;
    const rowEl = el("div", { marginTop: `${18 * S}px` }, card);
    const head = el("div", { display: "flex", justifyContent: "space-between", fontFamily: "Magik Mono", fontSize: `${26 * S}px`, letterSpacing: `${2 * S}px`, color: "rgba(255,255,255,0.75)" }, rowEl);
    el("span", {}, head, pct === null ? "" : label.toUpperCase());
    const num = el("span", { color: "#fff" }, head, "");
    if (pct === null) {
      head.firstChild.textContent = "";
      el("div", { fontFamily: "Magik Sans", fontWeight: "600", fontSize: `${34 * S}px`, color: "#fff" }, rowEl, line);
      return { pct: null, rowEl };
    }
    const track = el("div", { marginTop: `${10 * S}px`, height: `${16 * S}px`, borderRadius: `${8 * S}px`, background: "rgba(255,255,255,0.12)", overflow: "hidden" }, rowEl);
    const fill = el("div", { height: "100%", width: "0%", borderRadius: `${8 * S}px`, background: accent }, track);
    return { pct, fill, num, rowEl };
  });

  return {
    frame(t) {
      const out = easeInOut(span(t, outAt, duration - 0.05));
      const drain = easeOut(span(t, 0.05, 0.4)) * (1 - out);
      const push = 1.04 + 0.08 * easeInOut(span(t, 0, duration));
      bg.style.transform = `scale(${push})`;
      bg.style.filter = `grayscale(${0.85 * drain}) brightness(${lerp(1, 0.32, drain)}) contrast(${lerp(1, 1.12, drain)}) blur(${5 * S * drain}px)`;
      tint.style.opacity = drain;

      // Name rows sweep in from opposite sides, then keep drifting.
      rows.forEach((row, i) => {
        const dir = i === 1 ? -1 : 1;
        const enter = easeOut(span(t, 0.12 + i * 0.06, 0.62 + i * 0.06));
        const x = dir * (1 - enter) * W * 1.1 + dir * -t * 90 * S - W * 0.35;
        row.style.transform = `translate3d(${x}px, 0, ${-200 * S}px) skewX(${(1 - enter) * -18 * dir}deg)`;
        row.style.opacity = enter * (1 - out);
      });

      // The person pops toward the camera on a spring and settles; the hit shakes the frame.
      const pop = spring(t - 0.12, { stiffness: 220 }) * (1 - out);
      person.style.transform = `translate3d(0, ${-14 * S * pop}px, ${70 * S * pop}px) scale(${1 + 0.035 * pop}) rotateY(${Math.sin(t * 1.3) * 2 * pop}deg)`;
      person.style.opacity = t < 0.05 ? 0 : 1;
      const k = shake(t, 0.12, 22 * S);
      stage.style.transform = `translate(${k.x}px, ${k.y}px) rotate(${k.r}deg) scale(1.02)`;

      // The card flips up from its bottom edge, then the stats fill one by one.
      const c = spring(t - 0.45, { stiffness: 160 });
      const leave = easeIn(span(t, outAt - 0.05, outAt + 0.3));
      card.style.transform = `translate3d(0, ${(1 - c) * 160 * S + leave * 420 * S}px, ${180 * S + (1 - c) * -300 * S}px) rotateX(${(1 - c) * -70 + leave * 25}deg) rotateY(${Math.sin(t * 1.1) * 3}deg)`;
      card.style.opacity = Math.min(1, c * 1.4) * (1 - leave);
      edge.style.transform = `scaleY(${easeOut(span(t, 0.6, 0.9))})`;
      kicker.style.opacity = span(t, 0.65, 0.85);
      role.style.opacity = span(t, 0.75, 0.95);
      role.style.transform = `translateY(${(1 - easeOut(span(t, 0.75, 0.95))) * 20 * S}px)`;
      stats.forEach((s, i) => {
        // Counted on whole frames, so motion blur never mixes two numbers.
        const p = easeOut(span(Math.round(t * fps) / fps, 0.95 + i * 0.18, 1.6 + i * 0.18));
        s.rowEl.style.opacity = span(t, 0.9 + i * 0.18, 1.05 + i * 0.18);
        if (s.pct !== null) {
          s.fill.style.width = `${s.pct * p}%`;
          s.num.textContent = String(Math.round(s.pct * p));
        }
      });
    },
  };
}
