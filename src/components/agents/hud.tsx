"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LocalDate } from "@/components/local-date";

// The agents' mission control: who passes what to whom, read left to right in the order the work
// happens. Everything it shows comes from the page (the database); this component only lays it
// out and animates it. The animation runs in the browser's compositor (CSS) and SMIL, never in a
// script loop, and keeps running smoothly across the page's live refreshes.

export type NodeId = "client" | "refs" | "a1" | "apify" | "a2" | "a3" | "a4" | "a5" | "shoot" | "engine" | "video";
export type NodeState = "idle" | "busy" | "done" | "failed";
export type HudNode = { id: NodeId; kind: string; title: string; role: string; meta: string; state: NodeState; progress?: string | null };
export type HudLink = { id: LinkId; label: string; hot?: boolean; active: boolean };
// `fresh`: it happened in the last minute or two, so its link fires a burst.
export type HudEvent = { at: string; who: string; msg: string; link?: LinkId; tone?: "ok" | "bad"; fresh?: boolean };

const W = 1200;
const H = 650;

const STAGES = [
  { x0: 8, x1: 200, label: "01 · Input" },
  { x0: 200, x1: 400, label: "02 · Brand" },
  { x0: 400, x1: 605, label: "03 · Research" },
  { x0: 605, x1: 815, label: "04 · Script & design" },
  { x0: 815, x1: 1015, label: "05 · Shoot & edit" },
  { x0: 1015, x1: 1192, label: "06 · Output" },
];

const NODES: Record<NodeId, { x: number; y: number; r: number }> = {
  client: { x: 104, y: 230, r: 36 },
  refs: { x: 104, y: 470, r: 36 },
  a1: { x: 300, y: 230, r: 44 },
  apify: { x: 502, y: 110, r: 32 },
  a2: { x: 502, y: 350, r: 44 },
  a3: { x: 710, y: 230, r: 44 },
  a5: { x: 710, y: 460, r: 44 },
  shoot: { x: 915, y: 110, r: 34 },
  engine: { x: 915, y: 350, r: 50 },
  a4: { x: 915, y: 560, r: 44 },
  video: { x: 1104, y: 350, r: 40 },
};

type Side = "top" | "bottom" | "left" | "right";
// A point on a node's rim: its side, and an offset along that side (to run tracks side by side).
type Port = readonly [NodeId, Side, number?];
// `label`: where the link's text sits (its middle).
type Route = { a: NodeId; b: NodeId; from: Port; to: Port; via?: readonly (readonly [number, number])[]; label: readonly [number, number] };

// Every link is drawn as a track with rounded corners through the gaps between the stages, so no
// line ever crosses a node.
const ROUTES = {
  "client-a1": { a: "client", b: "a1", from: ["client", "right"], to: ["a1", "left"], label: [198, 220] },
  "a1-apify": { a: "a1", b: "apify", from: ["a1", "top"], via: [[300, 110]], to: ["apify", "left"], label: [390, 100] },
  "apify-a2": { a: "apify", b: "a2", from: ["apify", "bottom"], to: ["a2", "top"], label: [552, 196] },
  "a1-a2": { a: "a1", b: "a2", from: ["a1", "bottom"], via: [[300, 350]], to: ["a2", "left"], label: [384, 340] },
  "a1-a3": { a: "a1", b: "a3", from: ["a1", "right"], to: ["a3", "left"], label: [430, 220] },
  "a2-a3": { a: "a2", b: "a3", from: ["a2", "right"], via: [[598, 350], [598, 252]], to: ["a3", "left", 22], label: [598, 368] },
  "refs-a3": { a: "refs", b: "a3", from: ["refs", "right", -12], via: [[630, 458], [630, 266]], to: ["a3", "left", 36], label: [380, 448] },
  "refs-a5": { a: "refs", b: "a5", from: ["refs", "right", 10], to: ["a5", "left", 20], label: [380, 497] },
  "refs-engine": { a: "refs", b: "engine", from: ["refs", "bottom"], via: [[104, 626], [838, 626], [838, 380]], to: ["engine", "left", 30], label: [470, 616] },
  "a3-shoot": { a: "a3", b: "shoot", from: ["a3", "top"], via: [[710, 110]], to: ["shoot", "left"], label: [796, 100] },
  "a3-a5": { a: "a3", b: "a5", from: ["a3", "bottom"], to: ["a5", "top"], label: [748, 350] },
  "a3-engine": { a: "a3", b: "engine", from: ["a3", "right"], via: [[812, 230], [812, 330]], to: ["engine", "left", -20], label: [792, 221] },
  "a5-engine": { a: "a5", b: "engine", from: ["a5", "right", -20], via: [[824, 440], [824, 360]], to: ["engine", "left", 10], label: [795, 432] },
  "shoot-engine": { a: "shoot", b: "engine", from: ["shoot", "bottom"], to: ["engine", "top"], label: [962, 232] },
  "a2-a4": { a: "a2", b: "a4", from: ["a2", "bottom"], via: [[502, 560]], to: ["a4", "left"], label: [596, 550] },
  "a4-engine": { a: "a4", b: "engine", from: ["a4", "top"], to: ["engine", "bottom"], label: [966, 462] },
  "engine-video": { a: "engine", b: "video", from: ["engine", "right"], to: ["video", "left"], label: [1012, 340] },
} as const satisfies Record<string, Route>;

export type LinkId = keyof typeof ROUTES;

function port([id, side, offset = 0]: Port): [number, number] {
  const { x, y, r } = NODES[id];
  const o = Math.max(-r + 2, Math.min(r - 2, offset));
  const across = Math.sqrt(r * r - o * o);
  switch (side) {
    case "top":
      return [x + o, y - across];
    case "bottom":
      return [x + o, y + across];
    case "left":
      return [x - across, y + o];
    case "right":
      return [x + across, y + o];
  }
}

// A polyline with rounded corners, and the direction it arrives in (for the arrowhead).
function track(route: Route) {
  const pts = [port(route.from), ...(route.via ?? []).map(([x, y]) => [x, y] as [number, number]), port(route.to)];
  // Ports sit on the rim: straighten the first and last legs onto the waypoints.
  if (route.via?.length) {
    const [fx, fy] = pts[0];
    const [vx, vy] = pts[1];
    if (route.from[1] === "top" || route.from[1] === "bottom") pts[1] = [fx, vy];
    else pts[1] = [vx, fy];
    const n = pts.length;
    const [tx, ty] = pts[n - 1];
    const [wx, wy] = pts[n - 2];
    if (route.to[1] === "left" || route.to[1] === "right") pts[n - 2] = [wx, ty];
    else pts[n - 2] = [tx, wy];
  }
  const R = 16;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const inLen = Math.hypot(cx - px, cy - py);
    const outLen = Math.hypot(nx - cx, ny - cy);
    const r = Math.min(R, inLen / 2, outLen / 2);
    const ax = cx - ((cx - px) / (inLen || 1)) * r;
    const ay = cy - ((cy - py) / (inLen || 1)) * r;
    const bx = cx + ((nx - cx) / (outLen || 1)) * r;
    const by = cy + ((ny - cy) / (outLen || 1)) * r;
    d += ` L${ax.toFixed(1)},${ay.toFixed(1)} Q${cx},${cy} ${bx.toFixed(1)},${by.toFixed(1)}`;
  }
  const end = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  d += ` L${end[0].toFixed(1)},${end[1].toFixed(1)}`;
  const len = Math.hypot(end[0] - prev[0], end[1] - prev[1]) || 1;
  const ux = (end[0] - prev[0]) / len;
  const uy = (end[1] - prev[1]) / len;
  // The arrowhead: its tip on the rim, 8 px long, 9 px wide.
  const arrow = `${end[0]},${end[1]} ${end[0] - ux * 8 - uy * 4.5},${end[1] - uy * 8 + ux * 4.5} ${end[0] - ux * 8 + uy * 4.5},${end[1] - uy * 8 - ux * 4.5}`;
  const total = pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
  return { d, arrow, total };
}

const COLOR = { idle: "#54d6ff", busy: "#f6d43a", done: "#5fc48a", failed: "#f2685f" } as const;
const STATE_TEXT = { idle: "waiting", busy: "working", done: "done", failed: "failed" } as const;
const AGENTS = new Set<NodeId>(["a1", "a2", "a3", "a4", "a5"]);

// A few packets fired once along a link, for something that just happened. SMIL animations with
// `begin="indefinite"` start when they are mounted, whenever that is.
function Burst({ pathId, hot }: { pathId: string; hot: boolean }) {
  const ref = useRef<SVGGElement>(null);
  useEffect(() => {
    const timers = [...(ref.current?.querySelectorAll("circle") ?? [])].map((c, k) =>
      setTimeout(() => c.querySelectorAll("animateMotion, animate").forEach((a) => (a as SVGAnimationElement).beginElement?.()), k * 260),
    );
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <g ref={ref}>
      {[0, 1, 2].map((k) => (
        <circle key={k} r={4.5} fill={hot ? "#f6d43a" : "#c8f4ff"} opacity={0}>
          <animateMotion dur="1.1s" begin="indefinite" repeatCount="3" calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines="0.4 0 0.2 1">
            <mpath href={`#${pathId}`} />
          </animateMotion>
          <animate attributeName="opacity" values="1;1" dur="1.1s" begin="indefinite" repeatCount="3" />
        </circle>
      ))}
    </g>
  );
}

export function AgentHud({
  nodes,
  links,
  events,
  panels,
  satellites,
  swatches,
  meters,
}: {
  nodes: HudNode[];
  links: HudLink[];
  events: HudEvent[];
  panels: Partial<Record<NodeId, ReactNode>>;
  satellites: { label: string; weight: number }[];
  swatches: string[];
  meters: { label: string; value: string; fill: number }[];
}) {
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])) as Record<NodeId, HudNode>, [nodes]);
  const initial = nodes.find((n) => n.state === "busy")?.id ?? (byId.a3?.state === "done" ? "a3" : byId.a2?.state === "done" ? "a2" : byId.a1?.state === "done" ? "a1" : "client");
  const [selected, setSelected] = useState<NodeId>(initial);
  const [hovered, setHovered] = useState<NodeId | null>(null);
  // The selected (or hovered) node's links light up; while hovering, the rest step back.
  const focus = hovered ?? selected;
  const tracks = useMemo(() => Object.fromEntries(Object.entries(ROUTES).map(([id, r]) => [id, track(r)])) as Record<LinkId, ReturnType<typeof track>>, []);
  const fresh = new Set(events.filter((e) => e.fresh && e.link).map((e) => e.link!));
  const maxWeight = Math.max(1, ...satellites.map((s) => s.weight));
  const sel = byId[selected];
  const touches = (id: LinkId) => ROUTES[id].a === focus || ROUTES[id].b === focus;
  const neighbours = new Set(links.flatMap((l) => (touches(l.id) ? [ROUTES[l.id].a, ROUTES[l.id].b] : [])));
  const dimmed = (lit: boolean) => (hovered && !lit ? "hud-dim" : undefined);

  return (
    <div className="flex flex-col gap-4">
      <section className="hud-frame min-w-0" aria-label="Agent graph">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
            <span className="hud-label">Pipeline · click a node to read what it made</span>
            <span className="hud-label flex flex-wrap gap-3">
              {(["busy", "done", "idle", "failed"] as const).map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: COLOR[s], boxShadow: s === "idle" ? undefined : `0 0 8px ${COLOR[s]}` }} />
                  {STATE_TEXT[s]}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded bg-accent" />
                key handoff
              </span>
            </span>
          </div>
          <div className="overflow-x-auto pb-2">
            <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[900px]" role="img" aria-label="How the agents pass work to each other, from the brief to the video">
              <defs>
                <radialGradient id="hud-halo" cx="50%" cy="50%" r="50%">
                  <stop offset="0" stopColor="#7fe3ff" stopOpacity="0.55" />
                  <stop offset="0.45" stopColor="#54d6ff" stopOpacity="0.16" />
                  <stop offset="1" stopColor="#54d6ff" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="hud-halo-busy" cx="50%" cy="50%" r="50%">
                  <stop offset="0" stopColor="#ffe680" stopOpacity="0.6" />
                  <stop offset="0.45" stopColor="#f6d43a" stopOpacity="0.18" />
                  <stop offset="1" stopColor="#f6d43a" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="hud-packet" cx="50%" cy="50%" r="50%">
                  <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
                  <stop offset="0.4" stopColor="#b8f1ff" stopOpacity="0.9" />
                  <stop offset="1" stopColor="#54d6ff" stopOpacity="0" />
                </radialGradient>
                <pattern id="hud-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M40 0H0V40" fill="none" stroke="#54d6ff" strokeWidth="0.4" opacity="0.14" />
                </pattern>
              </defs>
              <rect width={W} height={H} fill="url(#hud-grid)" />

              {/* The stages, in the order the work happens. */}
              {STAGES.map((s, i) => (
                <g key={s.label}>
                  <rect x={s.x0 + 4} y={44} width={s.x1 - s.x0 - 8} height={H - 52} rx={14} fill={i % 2 ? "rgba(84,214,255,0.035)" : "rgba(84,214,255,0.015)"} stroke="rgba(84,214,255,0.08)" />
                  <text x={(s.x0 + s.x1) / 2} y={30} textAnchor="middle" className="hud-stage">
                    {s.label}
                  </text>
                </g>
              ))}

              {/* Tracks. */}
              {links.map((l) => {
                const t = tracks[l.id];
                if (!t) return null;
                const lit = touches(l.id);
                const color = l.hot ? "#f6d43a" : "#54d6ff";
                return (
                  <g key={l.id} className={dimmed(lit)}>
                    <path id={`hud-link-${l.id}`} d={t.d} fill="none" stroke={color} strokeWidth={lit ? 2.4 : 1.6} strokeOpacity={l.active ? (lit ? 0.95 : 0.55) : 0.16} strokeLinejoin="round" />
                    {l.active && <path d={t.d} fill="none" stroke={color} strokeWidth={lit ? 2.4 : 1.6} strokeOpacity={0.9} strokeDasharray="3 17" className="hud-flow" />}
                    <polygon points={t.arrow} fill={color} fillOpacity={l.active ? 0.9 : 0.25} />
                  </g>
                );
              })}

              {/* Packets: steady traffic on links that carry data, fast into a working node. */}
              <g className="hud-packet" pointerEvents="none">
                {links.map((l, i) => {
                  if (!l.active || !tracks[l.id]) return null;
                  const busy = byId[ROUTES[l.id].b]?.state === "busy";
                  const dur = Math.max(1.4, tracks[l.id].total / (busy ? 180 : 70));
                  const count = busy ? 3 : 1;
                  return Array.from({ length: count }, (_, k) => (
                    <circle key={`${l.id}-${k}`} r={busy ? 5 : 3.6} fill={l.hot || busy ? "#f6d43a" : "url(#hud-packet)"} opacity={busy ? 1 : 0.75}>
                      <animateMotion dur={`${dur.toFixed(2)}s`} begin={`-${((i * 0.83 + (k * dur) / count) % dur).toFixed(2)}s`} repeatCount="indefinite">
                        <mpath href={`#hud-link-${l.id}`} />
                      </animateMotion>
                    </circle>
                  ));
                })}
                {[...fresh].map((id) => (tracks[id] ? <Burst key={id} pathId={`hud-link-${id}`} hot={!!links.find((l) => l.id === id)?.hot} /> : null))}
              </g>

              {/* What each link carries. */}
              {links.map((l) => {
                const r = ROUTES[l.id];
                if (!r) return null;
                return (
                  <text key={l.id} x={r.label[0]} y={r.label[1]} textAnchor="middle" className={`hud-edge ${l.hot && l.active ? "hot" : ""} ${l.active ? "" : "off"} ${touches(l.id) ? "lit" : ""} ${dimmed(touches(l.id)) ?? ""}`}>
                    {l.label.length > 30 ? `${l.label.slice(0, 29)}…` : l.label}
                  </text>
                );
              })}

              {/* The researcher's reels and the strategist's palette orbit their agent. */}
              {byId.a2 && satellites.length > 0 && (
                <g className="hud-orbit" style={{ transformOrigin: `${NODES.a2.x}px ${NODES.a2.y}px`, ["--hud-spin" as string]: "70s" }} pointerEvents="none">
                  {satellites.map((s, i) => {
                    const a = (i / satellites.length) * Math.PI * 2;
                    const rr = NODES.a2.r + 10;
                    return <circle key={i} cx={NODES.a2.x + Math.cos(a) * rr} cy={NODES.a2.y + Math.sin(a) * rr} r={2 + 2.5 * Math.sqrt(s.weight / maxWeight)} fill="#54d6ff" fillOpacity={0.8} stroke="#b8f1ff" strokeWidth={0.6} />;
                  })}
                </g>
              )}
              {byId.a1 && swatches.length > 0 && (
                <g className="hud-orbit reverse" style={{ transformOrigin: `${NODES.a1.x}px ${NODES.a1.y}px`, ["--hud-spin" as string]: "90s" }} pointerEvents="none">
                  {swatches.map((c, i) => {
                    const a = (i / swatches.length) * Math.PI * 2 - Math.PI / 2;
                    const rr = NODES.a1.r + 11;
                    return <rect key={i} x={NODES.a1.x + Math.cos(a) * rr - 4} y={NODES.a1.y + Math.sin(a) * rr - 4} width={8} height={8} rx={2} fill={c} stroke="#b8f1ff" strokeWidth={0.6} />;
                  })}
                </g>
              )}

              {/* Nodes. */}
              {nodes.map((n) => {
                const p = NODES[n.id];
                if (!p) return null;
                const agent = AGENTS.has(n.id);
                const isSel = selected === n.id;
                const color = COLOR[n.state];
                const dim = !!hovered && !neighbours.has(n.id) && hovered !== n.id;
                const meta = n.state === "busy" && n.progress ? n.progress : n.meta;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${p.x},${p.y})`}
                    className={`hud-node ${dim ? "hud-dim" : ""}`}
                    tabIndex={0}
                    role="button"
                    aria-label={`${n.title}: ${n.role}, ${STATE_TEXT[n.state]}`}
                    aria-pressed={isSel}
                    onClick={() => setSelected(n.id)}
                    onMouseEnter={() => setHovered(n.id)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(n.id)}
                    onBlur={() => setHovered(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(n.id);
                      }
                    }}
                  >
                    <circle r={p.r * 1.7} fill={n.state === "busy" ? "url(#hud-halo-busy)" : "url(#hud-halo)"} opacity={n.state === "idle" ? 0.35 : 0.85} />
                    {n.state === "busy" && <circle r={p.r} fill="none" stroke={COLOR.busy} strokeWidth={2} className="hud-pulse" />}
                    <circle r={p.r} fill="rgba(3,12,22,0.94)" stroke={isSel ? "#f6d43a" : color} strokeWidth={isSel ? 3 : 1.8} className="hud-rim" />
                    <g className="hud-spin" style={{ ["--hud-spin" as string]: n.state === "busy" ? "3.5s" : agent ? "36s" : "60s" }}>
                      <circle r={p.r - 8} fill="none" stroke={color} strokeWidth={agent ? 3.5 : 2} strokeDasharray={agent ? "16 9 4 9" : "5 8"} opacity={n.state === "idle" ? 0.5 : 0.95} />
                    </g>
                    <circle r={p.r - 17} fill="none" stroke="#b8f1ff" strokeWidth={0.8} strokeDasharray="2 5" opacity={0.4} />
                    <circle r={Math.max(4.5, p.r * 0.15)} fill={n.state === "idle" ? "#2b6f88" : color} />
                    <text y={-p.r - 24} textAnchor="middle" className="hud-kind">
                      {n.kind}
                    </text>
                    <text y={-p.r - 9} textAnchor="middle" className="hud-title" style={{ fill: isSel ? "#f6d43a" : undefined }}>
                      {n.title}
                    </text>
                    <text y={p.r + 22} textAnchor="middle" className="hud-meta" style={{ fill: n.state === "busy" ? COLOR.busy : n.state === "failed" ? COLOR.failed : undefined }}>
                      {meta.length > 26 ? `${meta.slice(0, 25)}…` : meta}
                    </text>
                    <text y={p.r + 36} textAnchor="middle" className="hud-status" style={{ fill: color }}>
                      {n.state === "busy" ? "● working" : n.state === "done" ? "✓ done" : n.state === "failed" ? "! failed" : "○ waiting"}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <aside className="hud-frame flex min-w-0 flex-col" aria-live="polite">
          <div className="border-b border-[rgba(84,214,255,0.25)] px-5 py-4">
            <div className="hud-label">{sel.kind}</div>
            <h2 className="mt-1 font-mono text-lg tracking-[0.16em] text-accent">{sel.title}</h2>
            <div className="text-[13px] text-muted">
              {sel.role} · <span style={{ color: COLOR[sel.state] }}>{sel.state === "busy" ? sel.progress || "working" : STATE_TEXT[sel.state]}</span>
            </div>
          </div>
          <div className="flex max-h-[560px] flex-col gap-4 overflow-y-auto px-5 py-4">{panels[selected] ?? <p className="text-sm text-muted">Nothing here yet.</p>}</div>
        </aside>

        <section className="hud-frame px-5 py-4" aria-label="Comm log">
          <div className="hud-label mb-3">Comm log · newest first</div>
          {events.length === 0 ? (
            <p className="text-sm text-muted">No activity yet for this client.</p>
          ) : (
            <ol className="flex max-h-[520px] flex-col gap-2.5 overflow-y-auto font-mono text-[12.5px]">
              {[...events].reverse().map((e, i) => (
                <li key={i} className="flex flex-col gap-0.5 border-l-2 pl-3" style={{ borderColor: e.tone === "bad" ? "#f2685f" : e.fresh ? "#f6d43a" : "rgba(84,214,255,0.35)" }}>
                  <span className="flex flex-wrap items-baseline gap-x-3">
                    <span className={e.tone === "bad" ? "text-danger" : e.fresh ? "text-accent" : "text-[#7fdcff]"}>{e.who}</span>
                    <span className="text-[11px] text-muted tabular-nums">
                      <LocalDate value={e.at} preset="short" />
                    </span>
                  </span>
                  <span className="text-[#bfe6f5]">{e.msg}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="hud-frame px-5 py-4" aria-label="Telemetry">
          <div className="hud-label mb-3">Telemetry</div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {meters.map((m) => (
              <div key={m.label} className="flex flex-col gap-1.5">
                <span className="hud-label">{m.label}</span>
                <span className="font-mono text-2xl text-[#b8f1ff] tabular-nums [text-shadow:0_0_14px_rgba(84,214,255,0.45)]">{m.value}</span>
                <span className="relative h-1 overflow-hidden bg-[rgba(84,214,255,0.12)]">
                  <i className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#54d6ff] to-accent transition-[width] duration-700" style={{ width: `${Math.round(Math.min(1, m.fill) * 100)}%` }} />
                </span>
              </div>
            ))}
          </div>
        </section>
    </div>
  );
}
