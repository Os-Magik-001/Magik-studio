"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AudioLines, CalendarRange, Camera, ClipboardList, Compass, Cpu, Film, MonitorPlay, PenLine, Radar, WandSparkles, type LucideIcon } from "lucide-react";
import { LocalDate } from "@/components/local-date";

// The agents' mission control for one client: five stages read left to right, one card per agent
// (or person), and the tracks that carry their work to the next one. Everything it shows comes
// from the page (the database); this component lays it out and animates it. Tracks never cross a
// card or each other; what a track carries shows on the selected card's tracks and in its panel.

export type NodeId = "client" | "refs" | "strategist" | "researcher" | "planner" | "scriptwriter" | "motion" | "shoot" | "engine" | "sound" | "video";
export type NodeState = "idle" | "busy" | "done" | "failed";
export type HudSkill = { name: string; description: string };
export type HudNode = { id: NodeId; kind: string; title: string; role: string; meta: string; state: NodeState; progress?: string | null; skills?: HudSkill[] };
export type HudLink = { id: LinkId; label: string; hot?: boolean; active: boolean };
// `fresh`: it happened in the last minute or two, so its track fires a burst.
export type HudEvent = { at: string; who: string; msg: string; link?: LinkId; tone?: "ok" | "bad"; fresh?: boolean };

// The stage: 1200 × 620, five columns of cards, three rows.
const W = 1200;
const H = 620;
const CW = 190;
const CH = 136;
const COLS = [25, 265, 505, 745, 985];
const ROWS = [58, 240, 422];
const STAGES = ["01 · Brief", "02 · Brand & research", "03 · Plan & write", "04 · Shoot & edit", "05 · Deliver"];

const NODES: Record<NodeId, { col: number; row: number; icon: LucideIcon }> = {
  client: { col: 0, row: 0, icon: ClipboardList },
  refs: { col: 0, row: 2, icon: Film },
  strategist: { col: 1, row: 0, icon: Compass },
  researcher: { col: 1, row: 1, icon: Radar },
  planner: { col: 2, row: 0, icon: CalendarRange },
  scriptwriter: { col: 2, row: 1, icon: PenLine },
  motion: { col: 2, row: 2, icon: WandSparkles },
  shoot: { col: 3, row: 0, icon: Camera },
  engine: { col: 3, row: 1, icon: Cpu },
  sound: { col: 3, row: 2, icon: AudioLines },
  video: { col: 4, row: 1, icon: MonitorPlay },
};

type Pt = readonly [number, number];
const at = (id: NodeId) => ({ x: COLS[NODES[id].col], y: ROWS[NODES[id].row] });
// A point on a card's edge, shifted along it (to run tracks side by side).
const right = (id: NodeId, d = 0): Pt => [at(id).x + CW, at(id).y + CH / 2 + d];
const left = (id: NodeId, d = 0): Pt => [at(id).x, at(id).y + CH / 2 + d];
const top = (id: NodeId, d = 0): Pt => [at(id).x + CW / 2 + d, at(id).y];
const bottom = (id: NodeId, d = 0): Pt => [at(id).x + CW / 2 + d, at(id).y + CH];
const mid = (row: number, d = 0) => ROWS[row] + CH / 2 + d;

// Tracks run straight across a gap, or turn in a lane of the gap between two columns.
const ROUTES = {
  "client-strategist": { a: "client", b: "strategist", pts: [right("client"), left("strategist")] },
  "strategist-researcher": { a: "strategist", b: "researcher", pts: [bottom("strategist"), top("researcher")] },
  "strategist-planner": { a: "strategist", b: "planner", pts: [right("strategist", -16), left("planner", -16)] },
  "researcher-planner": { a: "researcher", b: "planner", pts: [right("researcher", -24), [470, mid(1, -24)], [470, mid(0, 16)], left("planner", 16)] },
  "researcher-scriptwriter": { a: "researcher", b: "scriptwriter", pts: [right("researcher", 12), left("scriptwriter", 12)] },
  "planner-scriptwriter": { a: "planner", b: "scriptwriter", pts: [bottom("planner"), top("scriptwriter")] },
  "refs-scriptwriter": { a: "refs", b: "scriptwriter", pts: [right("refs", -18), [490, mid(2, -18)], [490, mid(1, 40)], left("scriptwriter", 40)] },
  "refs-motion": { a: "refs", b: "motion", pts: [right("refs", 16), left("motion", 16)] },
  "scriptwriter-motion": { a: "scriptwriter", b: "motion", pts: [bottom("scriptwriter"), top("motion")] },
  "scriptwriter-shoot": { a: "scriptwriter", b: "shoot", pts: [right("scriptwriter", -34), [712, mid(1, -34)], [712, mid(0)], left("shoot")] },
  "scriptwriter-engine": { a: "scriptwriter", b: "engine", pts: [right("scriptwriter"), left("engine")] },
  "motion-engine": { a: "motion", b: "engine", pts: [right("motion", -22), [728, mid(2, -22)], [728, mid(1, 34)], left("engine", 34)] },
  "shoot-engine": { a: "shoot", b: "engine", pts: [bottom("shoot"), top("engine")] },
  "sound-engine": { a: "sound", b: "engine", pts: [top("sound"), bottom("engine")] },
  "engine-video": { a: "engine", b: "video", pts: [right("engine"), left("video")] },
} as const satisfies Record<string, { a: NodeId; b: NodeId; pts: readonly Pt[] }>;

export type LinkId = keyof typeof ROUTES;

// A polyline with rounded corners, its arrowhead, its length and where its label sits: the middle
// of its longest leg (a label on a leg across a gap wraps to the gap's width).
function track(pts: readonly Pt[]) {
  const r0 = 12;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const inLen = Math.hypot(cx - px, cy - py) || 1;
    const outLen = Math.hypot(nx - cx, ny - cy) || 1;
    const r = Math.min(r0, inLen / 2, outLen / 2);
    d += ` L${cx - ((cx - px) / inLen) * r},${cy - ((cy - py) / inLen) * r} Q${cx},${cy} ${cx + ((nx - cx) / outLen) * r},${cy + ((ny - cy) / outLen) * r}`;
  }
  const end = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  d += ` L${end[0]},${end[1]}`;
  const len = Math.hypot(end[0] - prev[0], end[1] - prev[1]) || 1;
  const ux = (end[0] - prev[0]) / len;
  const uy = (end[1] - prev[1]) / len;
  const arrow = `${end[0]},${end[1]} ${end[0] - ux * 8 - uy * 4.5},${end[1] - uy * 8 + ux * 4.5} ${end[0] - ux * 8 + uy * 4.5},${end[1] - uy * 8 - ux * 4.5}`;
  let total = 0;
  let longest = { len: 0, at: [0, 0] as [number, number], across: false };
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    total += l;
    if (l > longest.len) longest = { len: l, at: [(pts[i][0] + pts[i - 1][0]) / 2, (pts[i][1] + pts[i - 1][1]) / 2], across: pts[i][1] === pts[i - 1][1] };
  }
  return { d, arrow, total, label: longest.at, width: longest.across ? longest.len - 6 : null };
}

const COLOR = { idle: "#54d6ff", busy: "#f6d43a", done: "#5fc48a", failed: "#f2685f" } as const;
const STATE_TEXT = { idle: "Waiting", busy: "Working", done: "Done", failed: "Needs you" } as const;
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

// A few packets fired once along a track, for something that just happened.
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
  meters,
  now,
  swatches,
}: {
  nodes: HudNode[];
  links: HudLink[];
  events: HudEvent[];
  panels: Partial<Record<NodeId, ReactNode>>;
  meters: { label: string; value: string; fill: number }[];
  // What the agents are doing right now, or the next step, in plain words.
  now: { who: string; text: string; busy: boolean }[];
  // The charte's colors, shown on the strategist's card.
  swatches: string[];
}) {
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])) as Record<NodeId, HudNode>, [nodes]);
  const initial = nodes.find((n) => n.state === "busy")?.id ?? nodes.find((n) => n.state === "failed")?.id ?? [...nodes].reverse().find((n) => n.state === "done")?.id ?? "client";
  const [selected, setSelected] = useState<NodeId>(initial);
  const [hovered, setHovered] = useState<NodeId | null>(null);
  const focus = hovered ?? selected;
  const tracks = useMemo(() => Object.fromEntries(Object.entries(ROUTES).map(([id, r]) => [id, track(r.pts)])) as Record<LinkId, ReturnType<typeof track>>, []);
  const fresh = new Set(events.filter((e) => e.fresh && e.link).map((e) => e.link!));
  const touches = (id: LinkId) => ROUTES[id].a === focus || ROUTES[id].b === focus;
  const neighbours = new Set(links.flatMap((l) => (touches(l.id) ? [ROUTES[l.id].a, ROUTES[l.id].b] : [])));
  const sel = byId[selected];
  const SelIcon = NODES[selected].icon;
  const gets = links.filter((l) => ROUTES[l.id].b === selected);
  const gives = links.filter((l) => ROUTES[l.id].a === selected);

  return (
    <div className="flex flex-col gap-4">
      <section className="hud-frame min-w-0" aria-label="Agent graph">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 px-5 pt-4">
          <div className="flex min-w-0 flex-col gap-1" aria-live="polite">
            <span className="hud-label">Now</span>
            {now.map((n, i) => (
              <span key={i} className="flex items-center gap-2 text-[13.5px]">
                <span className={n.busy ? "hud-led" : "hud-led-idle"} data-state={n.busy ? "busy" : "idle"} aria-hidden />
                <span className="font-mono text-[11.5px] tracking-[0.14em] text-[#7fdcff] uppercase">{n.who}</span>
                <span className="text-[#d8f2fc]">{n.text}</span>
              </span>
            ))}
          </div>
          <span className="hud-label flex flex-wrap gap-3 pt-0.5">
            {(["busy", "done", "idle", "failed"] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: COLOR[s], boxShadow: s === "idle" ? undefined : `0 0 8px ${COLOR[s]}` }} />
                {STATE_TEXT[s]}
              </span>
            ))}
          </span>
        </div>

        <div className="overflow-x-auto px-3 pb-3">
          <div className="relative mx-auto w-full min-w-[1040px]" style={{ aspectRatio: `${W} / ${H}` }}>
            <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
              <defs>
                <pattern id="hud-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M40 0H0V40" fill="none" stroke="#54d6ff" strokeWidth="0.4" opacity="0.12" />
                </pattern>
                <radialGradient id="hud-packet" cx="50%" cy="50%" r="50%">
                  <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
                  <stop offset="0.4" stopColor="#b8f1ff" stopOpacity="0.9" />
                  <stop offset="1" stopColor="#54d6ff" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width={W} height={H} fill="url(#hud-grid)" />
              {/* The stages, in the order the work happens. */}
              {STAGES.map((label, i) => (
                <g key={label}>
                  <rect x={COLS[i] - 12} y={34} width={CW + 24} height={H - 44} rx={18} fill={i % 2 ? "rgba(84,214,255,0.035)" : "rgba(84,214,255,0.018)"} stroke="rgba(84,214,255,0.08)" />
                  <text x={COLS[i] + CW / 2} y={22} textAnchor="middle" className="hud-stage">
                    {label}
                  </text>
                </g>
              ))}
              {/* Tracks. */}
              {links.map((l) => {
                const t = tracks[l.id];
                const lit = touches(l.id);
                const color = l.hot ? "#f6d43a" : "#54d6ff";
                return (
                  <g key={l.id} className={hovered && !lit ? "hud-dim" : undefined}>
                    <path id={`hud-link-${l.id}`} d={t.d} fill="none" stroke={color} strokeWidth={lit ? 2.6 : 1.6} strokeOpacity={l.active ? (lit ? 0.95 : 0.5) : lit ? 0.45 : 0.14} strokeLinejoin="round" strokeDasharray={l.active ? undefined : "4 6"} />
                    {l.active && <path d={t.d} fill="none" stroke={color} strokeWidth={lit ? 2.6 : 1.6} strokeOpacity={0.95} strokeDasharray="3 17" className="hud-flow" />}
                    <polygon points={t.arrow} fill={color} fillOpacity={l.active ? 0.95 : 0.3} />
                  </g>
                );
              })}
              {/* Packets: steady traffic on tracks that carry work, fast into a working card. */}
              <g className="hud-packet" pointerEvents="none">
                {links.map((l, i) => {
                  if (!l.active) return null;
                  const into = byId[ROUTES[l.id].b]?.state === "busy";
                  const dur = Math.max(1.2, tracks[l.id].total / (into ? 160 : 60));
                  const count = into ? 3 : 1;
                  return Array.from({ length: count }, (_, k) => (
                    <circle key={`${l.id}-${k}`} r={into ? 4.5 : 3.4} fill={l.hot || into ? "#f6d43a" : "url(#hud-packet)"} opacity={into ? 1 : 0.8}>
                      <animateMotion dur={`${dur.toFixed(2)}s`} begin={`-${((i * 0.83 + (k * dur) / count) % dur).toFixed(2)}s`} repeatCount="indefinite">
                        <mpath href={`#hud-link-${l.id}`} />
                      </animateMotion>
                    </circle>
                  ));
                })}
                {[...fresh].map((id) => (tracks[id] ? <Burst key={id} pathId={`hud-link-${id}`} hot={!!links.find((l) => l.id === id)?.hot} /> : null))}
              </g>
            </svg>

            {/* The cards. */}
            {nodes.map((n) => {
              const p = at(n.id);
              const Icon = NODES[n.id].icon;
              const dim = !!hovered && hovered !== n.id && !neighbours.has(n.id);
              return (
                <button
                  key={n.id}
                  type="button"
                  className="hud-card absolute flex flex-col text-left"
                  data-state={n.state}
                  data-selected={selected === n.id || undefined}
                  data-dim={dim || undefined}
                  style={{ left: pct(p.x, W), top: pct(p.y, H), width: pct(CW, W), height: pct(CH, H) }}
                  aria-pressed={selected === n.id}
                  aria-label={`${n.title}: ${n.role}. ${STATE_TEXT[n.state]}.`}
                  title={n.role}
                  onClick={() => setSelected(n.id)}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(n.id)}
                  onBlur={() => setHovered(null)}
                >
                  {n.state === "busy" && <span className="hud-scan" aria-hidden />}
                  <span className="flex items-center gap-2">
                    <span className="hud-icon" aria-hidden>
                      <Icon size={14} strokeWidth={2} />
                    </span>
                    <span className="hud-kind-label">{n.kind}</span>
                    <span className="hud-led ml-auto" data-state={n.state} aria-hidden />
                  </span>
                  <span className="mt-2 text-[14px] leading-tight font-semibold text-[#ecfaff]">{n.title}</span>
                  <span className="mt-1 line-clamp-2 text-[11.5px] leading-snug" style={{ color: n.state === "busy" ? "#ffe680" : n.state === "failed" ? "#ff9b94" : "#8fb6c9" }}>
                    {n.state === "busy" && n.progress ? n.progress : n.meta}
                  </span>
                  <span className="mt-auto flex items-center gap-2 pt-1 font-mono text-[10px] tracking-[0.14em] uppercase">
                    <span style={{ color: COLOR[n.state] }}>{STATE_TEXT[n.state]}</span>
                    {n.id === "strategist" && swatches.length > 0 && (
                      <span className="flex gap-0.5" aria-hidden>
                        {swatches.slice(0, 6).map((c, i) => (
                          <i key={i} className="block h-2 w-2 rounded-[2px] ring-1 ring-white/25" style={{ background: c }} />
                        ))}
                      </span>
                    )}
                    {n.skills?.length ? <span className="ml-auto text-[#6f9bb3]">{n.skills.length === 1 ? "1 skill" : `${n.skills.length} skills`}</span> : null}
                  </span>
                  {n.state === "busy" && <span className="hud-bar" aria-hidden />}
                </button>
              );
            })}

            {/* What the focused card's tracks carry. */}
            {links
              .filter((l) => touches(l.id))
              .map((l) => {
                const { label: [x, y], width } = tracks[l.id];
                return (
                  <span key={l.id} className={`hud-pill ${l.hot ? "hot" : ""}`} style={{ left: pct(x, W), top: pct(y, H), maxWidth: width ? pct(Math.max(44, width), W) : undefined }}>
                    {l.label}
                  </span>
                );
              })}
          </div>
        </div>
      </section>

      <div className="grid items-start gap-4 @min-[64rem]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <aside className="hud-frame flex min-w-0 flex-col" aria-live="polite">
          <div className="flex items-start gap-3 border-b border-[rgba(84,214,255,0.22)] px-5 py-4">
            <span className="hud-icon mt-0.5 h-9 w-9 shrink-0" data-state={sel.state} aria-hidden>
              <SelIcon size={18} />
            </span>
            <div className="min-w-0">
              <div className="hud-label">{sel.kind}</div>
              <h2 className="mt-0.5 font-display text-lg font-bold tracking-[0.02em] text-accent">{sel.title}</h2>
              <p className="text-[13px] text-[#a9cddd]">{sel.role}</p>
              <p className="mt-1 text-[13px]" style={{ color: COLOR[sel.state] }}>
                {sel.state === "busy" ? `${sel.progress || "Working"}…` : `${STATE_TEXT[sel.state]} · ${sel.meta}`}
              </p>
            </div>
          </div>
          <div className="flex max-h-[640px] flex-col gap-5 overflow-y-auto px-5 py-4">
            {(gets.length > 0 || gives.length > 0) && (
              <div className="grid gap-4 @min-[40rem]:grid-cols-2">
                {[
                  { title: "Gets", list: gets, other: (l: HudLink) => ROUTES[l.id].a, arrow: "←" },
                  { title: "Hands over", list: gives, other: (l: HudLink) => ROUTES[l.id].b, arrow: "→" },
                ].map((col) =>
                  col.list.length ? (
                    <div key={col.title}>
                      <div className="hud-label mb-2">{col.title}</div>
                      <ul className="flex flex-col gap-1.5">
                        {col.list.map((l) => {
                          const other = byId[col.other(l)];
                          return (
                            <li key={l.id}>
                              <button type="button" onClick={() => setSelected(other.id)} className="group flex w-full items-baseline gap-2 text-left text-[13px]">
                                <span className="text-[#6f9bb3]">{col.arrow}</span>
                                <span className="font-medium text-[#d8f2fc] group-hover:text-accent">{other.title}</span>
                                <span className={l.hot ? "text-accent/90" : "text-[#7fa9bd]"}>{l.label}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null,
                )}
              </div>
            )}
            {sel.skills && sel.skills.length > 0 && (
              <details className="rounded-xl border border-[rgba(84,214,255,0.18)] bg-[rgba(84,214,255,0.03)] px-4 py-3">
                <summary className="cursor-pointer text-[13px] font-medium text-[#bfe6f5]">
                  {sel.skills.length === 1 ? "1 skill" : `${sel.skills.length} skills`}: the studio&apos;s playbook it follows
                </summary>
                <ul className="mt-3 flex flex-col gap-2">
                  {sel.skills.map((s) => (
                    <li key={s.name} className="text-[12.5px] leading-snug">
                      <span className="font-mono text-[11.5px] text-accent">{s.name}</span>
                      <span className="text-[#9fc3d3]"> · {s.description}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {panels[selected] ?? <p className="text-sm text-muted">Nothing here yet.</p>}
          </div>
        </aside>

        <section className="hud-frame px-5 py-4" aria-label="Comm log">
          <div className="hud-label mb-3">Comm log · newest first</div>
          {events.length === 0 ? (
            <p className="text-sm text-muted">No activity yet for this client.</p>
          ) : (
            <ol className="flex max-h-[600px] flex-col gap-2.5 overflow-y-auto font-mono text-[12.5px]">
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
        <div className="grid grid-cols-2 gap-4 @min-[40rem]:grid-cols-3 @min-[64rem]:grid-cols-6">
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
