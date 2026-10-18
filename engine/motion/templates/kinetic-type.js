// Words in depth: each line comes forward out of a blur, one after another, and the
// block drifts slowly toward the camera. Words between *asterisks* are set in the
// accent color, in an italic serif. Full frame, on a dark stage.

import { backdrop, easeIn, easeOut, el, fit, lerp, span } from "../kit.js";

export default function kineticType(root, spec) {
  const { W, H, duration, props } = spec;
  const S = Math.min(W, H) / 1080;
  const accent = props.accent;
  const outAt = duration - 0.35;
  const lines = (props.lines.length ? props.lines : props.title.split(/\s*\|\s*/)).filter(Boolean).slice(0, 4);

  const stage = el("div", { position: "absolute", inset: "0", perspective: `${1400 * S}px`, overflow: "hidden" }, root);
  const bg = backdrop(stage, W, H, accent);
  const block = el("div", { position: "absolute", left: `${W * 0.06}px`, width: `${W * 0.88}px`, top: "50%", transform: "translateY(-50%)", textAlign: "center", transformStyle: "preserve-3d" }, stage);
  const rows = lines.map((line) => {
    const row = el("div", { whiteSpace: "nowrap", lineHeight: "1.08", color: "#fff", fontFamily: "Magik Sans", fontWeight: "800", letterSpacing: `${-2 * S}px` }, block);
    for (const [k, part] of line.split("*").entries()) {
      if (!part) continue;
      el("span", k % 2 ? { fontFamily: "Magik Elegant", fontStyle: "italic", fontWeight: "400", color: accent, letterSpacing: "0" } : {}, row, part);
    }
    fit(row, W * 0.88, 140 * S);
    return row;
  });

  return {
    frame(t) {
      bg.frame(t);
      const out = easeIn(span(t, outAt, duration));
      block.style.transform = `translateY(-50%) translateZ(${(t * 40 + out * 500) * S}px)`;
      rows.forEach((row, i) => {
        const a = 0.05 + i * 0.22;
        const p = easeOut(span(t, a, a + 0.55));
        row.style.opacity = String(p * (1 - out));
        row.style.filter = `blur(${((1 - p) * 22 + out * 16) * S}px)`;
        row.style.transform = `translate3d(0, ${(1 - p) * 40 * S}px, ${lerp(-700, 0, p) * S}px)`;
      });
    },
  };
}
