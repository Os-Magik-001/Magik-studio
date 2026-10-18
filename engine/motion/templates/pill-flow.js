// A flow of steps: dark pills with a sparkle icon, staggered down the frame and joined
// by a thin line that draws itself from one to the next; each pill pops in as the line
// reaches it. An optional small heading sits on top. Full frame.

import { backdrop, easeIn, easeInOut, easeOut, el, fit, lerp, span, sparkle, spring } from "../kit.js";

export default function pillFlow(root, spec) {
  const { W, H, duration, props } = spec;
  const S = Math.min(W, H) / 1080;
  const accent = props.accent;
  const outAt = duration - 0.4;
  const steps = (props.lines.length ? props.lines : [props.title]).filter(Boolean).slice(0, 5);
  const n = steps.length;

  const stage = el("div", { position: "absolute", inset: "0", overflow: "hidden" }, root);
  const bg = backdrop(stage, W, H, accent);
  const heading = props.title && props.lines.length
    ? el("div", { position: "absolute", left: "0", right: "0", top: `${H * 0.1}px`, textAlign: "center", fontFamily: "Magik Elegant", color: "#fff", whiteSpace: "nowrap" }, stage, props.title)
    : null;
  if (heading) fit(heading, W * 0.86, 88 * S);

  // Pill centres: down the frame, alternating left and right of the centre line.
  const y0 = H * (heading ? 0.3 : 0.22);
  const y1 = H * 0.82;
  const centres = steps.map((_, i) => ({ x: W * (n === 1 ? 0.5 : i % 2 ? 0.62 : 0.38), y: n === 1 ? (y0 + y1) / 2 : lerp(y0, y1, i / (n - 1)) }));

  // The joining line, as one SVG path through the pill centres, from a node above the
  // first pill to one below the last.
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", String(W));
  svg.setAttribute("height", String(H));
  Object.assign(svg.style, { position: "absolute", left: "0", top: "0" });
  stage.appendChild(svg);
  const pts = [{ x: centres[0].x - 120 * S, y: centres[0].y - 190 * S }, ...centres, { x: centres[n - 1].x + 120 * S, y: centres[n - 1].y + 190 * S }];
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const my = (a.y + b.y) / 2;
    d += ` C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
  }
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "rgba(255,255,255,0.55)");
  path.setAttribute("stroke-width", String(2.5 * S));
  svg.appendChild(path);
  const len = path.getTotalLength();
  path.style.strokeDasharray = `${len}`;
  const nodes = [pts[0], pts[pts.length - 1]].map((p) => {
    const c = document.createElementNS(ns, "circle");
    c.setAttribute("cx", String(p.x));
    c.setAttribute("cy", String(p.y));
    c.setAttribute("r", String(9 * S));
    c.setAttribute("fill", "#fff");
    svg.appendChild(c);
    return c;
  });
  // How far along the line each pill sits, so it pops when the line reaches it.
  const along = centres.map((c) => {
    let best = 0;
    let dist = Infinity;
    for (let k = 0; k <= 200; k++) {
      const p = path.getPointAtLength((k / 200) * len);
      const dd = Math.hypot(p.x - c.x, p.y - c.y);
      if (dd < dist) {
        dist = dd;
        best = k / 200;
      }
    }
    return best;
  });

  const pills = steps.map((text, i) => {
    const pill = el("div", {
      position: "absolute", left: `${centres[i].x}px`, top: `${centres[i].y}px`, display: "flex", alignItems: "center", gap: `${20 * S}px`,
      padding: `${30 * S}px ${54 * S}px ${30 * S}px ${40 * S}px`, borderRadius: `${80 * S}px`, background: "#0e0e10",
      border: `${2 * S}px solid rgba(255,255,255,0.14)`, boxShadow: `0 ${24 * S}px ${60 * S}px rgba(0,0,0,0.6)`, whiteSpace: "nowrap",
    }, stage);
    sparkle(pill, 54 * S, accent);
    el("span", { fontFamily: "Magik Sans", fontWeight: "500", fontSize: `${58 * S}px`, color: "#fff" }, pill, text);
    return pill;
  });

  // The line draws over the middle of the graphic, leaving time to read the last pill.
  const drawFrom = 0.15;
  const drawTo = Math.max(drawFrom + 0.6, outAt - 0.7);
  return {
    frame(t) {
      bg.frame(t);
      const out = easeIn(span(t, outAt, duration));
      const p = easeInOut(span(t, drawFrom, drawTo));
      path.style.strokeDashoffset = `${len * (1 - p)}`;
      svg.style.opacity = String(1 - out);
      nodes[0].setAttribute("opacity", String(span(t, drawFrom - 0.1, drawFrom + 0.1)));
      nodes[1].setAttribute("opacity", String(p >= 0.99 ? 1 : 0));
      if (heading) {
        const h = easeOut(span(t, 0, 0.4));
        heading.style.opacity = h * (1 - out);
        heading.style.filter = `blur(${(1 - h) * 10 * S}px)`;
      }
      pills.forEach((pill, i) => {
        const at = drawFrom + (drawTo - drawFrom) * along[i] - 0.08;
        const e = spring(t - at, { stiffness: 220 });
        pill.style.opacity = String(Math.min(1, Math.max(0, e) * 1.5) * (1 - out));
        pill.style.transform = `translate(-50%, -50%) scale(${lerp(0.82, 1, e)}) translateY(${(1 - out) * 0 - out * 30 * S}px)`;
        pill.style.filter = `blur(${Math.max(0, 1 - e) * 8 * S}px)`;
      });
    },
  };
}
