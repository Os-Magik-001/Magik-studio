"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

// The agents' mission control: a holographic graph of who passes what to whom.
// Everything it shows comes from the page (the database); this component only draws
// and animates it. Links that have carried data pulse; links into a working node
// stream fast; anything that happened in the last minute fires a burst of packets.

export type NodeId = "client" | "a1" | "apify" | "a2" | "a3" | "a4" | "a5" | "shoot" | "engine" | "video";
export type NodeState = "idle" | "busy" | "done" | "failed";
export type HudNode = { id: NodeId; kind: string; title: string; role: string; meta: string; state: NodeState; progress?: string | null };
export type HudLink = { a: NodeId; b: NodeId; label: string; hot?: boolean; active: boolean };
export type HudEvent = { at: string; who: string; msg: string; link?: number; tone?: "ok" | "bad" };

const POS: Record<NodeId, { x: number; y: number; r: number }> = {
  client: { x: 90, y: 120, r: 46 },
  a1: { x: 330, y: 120, r: 62 },
  apify: { x: 570, y: 70, r: 38 },
  a2: { x: 650, y: 290, r: 62 },
  a3: { x: 330, y: 420, r: 62 },
  a4: { x: 880, y: 330, r: 56 },
  a5: { x: 530, y: 430, r: 52 },
  shoot: { x: 110, y: 560, r: 44 },
  engine: { x: 600, y: 560, r: 56 },
  video: { x: 880, y: 560, r: 44 },
};

const COLOR = { idle: "#54d6ff", busy: "#f6d43a", done: "#5fc48a", failed: "#f2685f" };
const NS = "http://www.w3.org/2000/svg";

function curve(a: { x: number; y: number }, b: { x: number; y: number }) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const k = 0.18;
  return { d: `M${a.x},${a.y} Q${mx - dy * k},${my + dx * k} ${b.x},${b.y}`, lx: mx - dy * k * 0.5, ly: my + dx * k * 0.5 };
}

const clock = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

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
  const initial = nodes.find((n) => n.state === "busy")?.id ?? (byId.a2.state === "done" ? "a2" : byId.a1.state === "done" ? "a1" : "client");
  const [selected, setSelected] = useState<NodeId>(initial);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const spinRefs = useRef<Record<string, SVGCircleElement | null>>({});
  const satRefs = useRef<(SVGCircleElement | null)[]>([]);
  const swRefs = useRef<(SVGRectElement | null)[]>([]);
  const packetsRef = useRef<SVGGElement>(null);
  const curves = useMemo(() => links.map((l) => curve(POS[l.a], POS[l.b])), [links]);
  const maxWeight = Math.max(1, ...satellites.map((s) => s.weight));

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lengths = pathRefs.current.map((p) => p?.getTotalLength() ?? 0);
    const packets: { link: number; born: number; speed: number }[] = [];
    const now0 = performance.now();
    // Recent messages replay as bursts on their link.
    events.forEach((e) => {
      const age = Date.now() - new Date(e.at).getTime();
      if (e.link !== undefined && age < 60_000) for (let k = 0; k < 4; k++) packets.push({ link: e.link, born: now0 + k * 240, speed: 1000 });
    });
    let lastSpawn = now0;
    let raf = 0;
    const frame = (now: number) => {
      const t = (now - now0) / 1000;
      // Steady traffic: slow on links that have carried data, fast into a busy node.
      if (!reduce && now - lastSpawn > 450) {
        lastSpawn = now;
        links.forEach((l, i) => {
          const busy = byId[l.b].state === "busy";
          if ((l.active && Math.random() < 0.18) || (busy && Math.random() < 0.7)) packets.push({ link: i, born: now, speed: busy ? 900 : 1700 });
        });
      }
      nodes.forEach((n, i) => {
        const el = spinRefs.current[n.id];
        if (!el) return;
        const sp = reduce ? 0 : n.state === "busy" ? 160 : 16;
        el.setAttribute("transform", `rotate(${(t * sp + i * 40) % 360})`);
      });
      satRefs.current.forEach((el, i) => {
        if (!el) return;
        const a = (i / satRefs.current.length) * Math.PI * 2 + (reduce ? 0 : t * 0.35);
        const rr = POS.a2.r + 42 + (i % 3) * 10;
        el.setAttribute("cx", String(POS.a2.x + Math.cos(a) * rr));
        el.setAttribute("cy", String(POS.a2.y + Math.sin(a) * rr * 0.42));
      });
      swRefs.current.forEach((el, i) => {
        if (!el) return;
        const a = (i / swRefs.current.length) * Math.PI * 2 - (reduce ? 0 : t * 0.5);
        el.setAttribute("x", String(POS.a1.x + Math.cos(a) * (POS.a1.r + 22) - 5.5));
        el.setAttribute("y", String(POS.a1.y + Math.sin(a) * (POS.a1.r + 22) - 5.5));
      });
      pathRefs.current.forEach((p) => p?.setAttribute("stroke-dashoffset", String(reduce ? 0 : -(t * 22) % 1000)));
      const g = packetsRef.current;
      if (g) {
        while (g.firstChild) g.removeChild(g.firstChild);
        for (let i = packets.length - 1; i >= 0; i--) {
          const p = packets[i];
          const age = (now - p.born) / p.speed;
          if (age < 0) continue;
          if (age > 1) {
            packets.splice(i, 1);
            continue;
          }
          const path = pathRefs.current[p.link];
          if (!path) continue;
          const pt = path.getPointAtLength(lengths[p.link] * age);
          const c = document.createElementNS(NS, "circle");
          c.setAttribute("cx", String(pt.x));
          c.setAttribute("cy", String(pt.y));
          c.setAttribute("r", "4.2");
          c.setAttribute("fill", links[p.link].hot ? "#f6d43a" : "#b8f1ff");
          c.setAttribute("filter", "url(#hud-glow)");
          g.appendChild(c);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [nodes, links, events, byId]);

  const sel = byId[selected];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="hud-frame min-w-0" aria-label="Agent graph">
          <div className="flex items-center justify-between px-5 pt-4">
            <span className="hud-label">Neural link · click a node</span>
            <span className="hud-label flex gap-3">
              {(["busy", "done", "failed"] as const).map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: COLOR[s], boxShadow: `0 0 8px ${COLOR[s]}` }} />
                  {s === "busy" ? "working" : s}
                </span>
              ))}
            </span>
          </div>
          <div className="overflow-x-auto">
            <svg ref={svgRef} viewBox="0 0 1000 640" className="block h-auto w-full min-w-[760px]" role="img" aria-label="How the agents pass work to each other">
              <defs>
                <radialGradient id="hud-core" cx="50%" cy="50%" r="50%">
                  <stop offset="0" stopColor="#b8f1ff" stopOpacity="0.9" />
                  <stop offset="0.35" stopColor="#54d6ff" stopOpacity="0.3" />
                  <stop offset="1" stopColor="#54d6ff" stopOpacity="0" />
                </radialGradient>
                <filter id="hud-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <pattern id="hud-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M40 0H0V40" fill="none" stroke="#54d6ff" strokeWidth="0.4" opacity="0.2" />
                </pattern>
              </defs>
              <rect width="1000" height="640" fill="url(#hud-grid)" />
              {links.map((l, i) => (
                <g key={i}>
                  <path
                    ref={(el) => {
                      pathRefs.current[i] = el;
                    }}
                    d={curves[i].d}
                    fill="none"
                    stroke={l.hot ? "#f6d43a" : "#54d6ff"}
                    strokeWidth={1.4}
                    strokeOpacity={l.active ? 0.6 : 0.18}
                    strokeDasharray="4 6"
                  />
                  <text x={curves[i].lx} y={curves[i].ly - 6} textAnchor="middle" className={`hud-edge ${l.hot && l.active ? "hot" : ""} ${l.active ? "" : "off"}`}>
                    {l.label}
                  </text>
                </g>
              ))}
              <g ref={packetsRef} />
              {satellites.map((s, i) => (
                <circle
                  key={i}
                  ref={(el) => {
                    satRefs.current[i] = el;
                  }}
                  r={3 + 7 * Math.sqrt(s.weight / maxWeight)}
                  fill="#54d6ff"
                  fillOpacity={0.75}
                  stroke="#b8f1ff"
                  strokeWidth={0.8}
                  filter="url(#hud-glow)"
                >
                  <title>{s.label}</title>
                </circle>
              ))}
              {swatches.map((c, i) => (
                <rect
                  key={i}
                  ref={(el) => {
                    swRefs.current[i] = el;
                  }}
                  width={11}
                  height={11}
                  fill={c}
                  stroke="#b8f1ff"
                  strokeWidth={0.8}
                />
              ))}
              {nodes.map((n) => {
                const p = POS[n.id];
                const agent = n.id.startsWith("a") && n.id !== "apify";
                const color = selected === n.id ? "#f6d43a" : COLOR[n.state];
                return (
                  <g
                    key={n.id}
                    transform={`translate(${p.x},${p.y})`}
                    className="hud-node"
                    tabIndex={0}
                    role="button"
                    aria-label={`${n.title}: ${n.role}, ${n.state}`}
                    aria-pressed={selected === n.id}
                    onClick={() => setSelected(n.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(n.id);
                      }
                    }}
                  >
                    <circle r={p.r * 1.5} fill="url(#hud-core)" opacity={n.state === "idle" ? 0.15 : 0.4} />
                    <circle r={p.r} fill="rgba(4,14,24,0.88)" stroke={color} strokeWidth={selected === n.id ? 2.6 : 1.6} />
                    <circle
                      ref={(el) => {
                        spinRefs.current[n.id] = el;
                      }}
                      r={p.r - 8}
                      fill="none"
                      stroke={color}
                      strokeWidth={agent ? 4 : 2}
                      strokeDasharray={agent ? "18 10 4 10" : "6 8"}
                      opacity={n.state === "idle" ? 0.45 : 0.9}
                    />
                    <circle r={p.r - 18} fill="none" stroke="#b8f1ff" strokeWidth={1} strokeDasharray="2 5" opacity={0.5} />
                    <circle r={Math.max(5, p.r * 0.16)} fill={n.state === "idle" ? "#2b6f88" : "#d9f7ff"} filter="url(#hud-glow)" />
                    <text y={-p.r - 22} textAnchor="middle" className="hud-kind">
                      {n.kind}
                    </text>
                    <text y={-p.r - 8} textAnchor="middle" className="hud-title" style={{ fill: selected === n.id ? "#f6d43a" : undefined }}>
                      {n.title}
                    </text>
                    <text y={p.r + 18} textAnchor="middle" className="hud-meta">
                      {n.state === "busy" && n.progress ? n.progress.slice(0, 34) : n.meta}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </section>

        <aside className="hud-frame flex min-w-0 flex-col" aria-live="polite">
          <div className="border-b border-[rgba(84,214,255,0.25)] px-5 py-4">
            <div className="hud-label">{sel.kind}</div>
            <h2 className="mt-1 font-mono text-lg tracking-[0.16em] text-accent">{sel.title}</h2>
            <div className="text-[13px] text-muted">
              {sel.role} · <span style={{ color: COLOR[sel.state] }}>{sel.state === "busy" ? sel.progress || "working" : sel.state}</span>
            </div>
          </div>
          <div className="flex max-h-[720px] flex-col gap-4 overflow-y-auto px-5 py-4">{panels[selected] ?? <p className="text-sm text-muted">Nothing here yet.</p>}</div>
        </aside>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="hud-frame px-5 py-4" aria-label="Comm log">
          <div className="hud-label mb-3">Comm log · what each agent sent</div>
          {events.length === 0 ? (
            <p className="text-sm text-muted">No activity yet for this client.</p>
          ) : (
            <ol className="flex max-h-[300px] flex-col gap-1.5 overflow-y-auto font-mono text-[12.5px]">
              {[...events].reverse().map((e, i) => (
                <li key={i} className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 sm:grid-cols-[96px_170px_minmax(0,1fr)]">
                  <span className="text-muted tabular-nums">{clock(e.at)}</span>
                  <span className={e.tone === "bad" ? "text-danger" : "text-accent"}>{e.who}</span>
                  <span className="col-start-2 text-[#bfe6f5] sm:col-start-auto">{e.msg}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="hud-frame px-5 py-4" aria-label="Telemetry">
          <div className="hud-label mb-3">Telemetry</div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {meters.map((m) => (
              <div key={m.label} className="flex flex-col gap-1.5">
                <span className="hud-label">{m.label}</span>
                <span className="font-mono text-2xl text-[#b8f1ff] tabular-nums [text-shadow:0_0_14px_rgba(84,214,255,0.45)]">{m.value}</span>
                <span className="relative h-1 overflow-hidden bg-[rgba(84,214,255,0.12)]">
                  <i className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#54d6ff] to-accent" style={{ width: `${Math.round(Math.min(1, m.fill) * 100)}%` }} />
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
