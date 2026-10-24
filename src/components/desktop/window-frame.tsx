"use client";

import {
  Activity,
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Minus, RotateCw, X } from "lucide-react";
import { appById } from "@/lib/apps";
import { cx } from "@/components/ui";
import { AppIcon } from "@/components/shell/app-icon";
import { useDesktop, WindowContext } from "@/components/desktop/context";
import { useContent } from "@/components/desktop/content";
import type { MissionSpot } from "@/components/desktop/mission";
import { MIN_H, MIN_W, clamp, frameOf, zoomRect, type Rect, type Win, type Zoom } from "@/components/desktop/windows";

const EDGES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;
type Edge = (typeof EDGES)[number];

// The window's content, kept between visits: where each page was scrolled to.
const scrolls = new Map<string, number>();

// One app window: a title bar to drag (traffic lights, back and forward, the page's title),
// edges to resize, and the page itself. It zooms out of the Dock when it opens, goes back into
// it when minimized, and keeps its page alive while other windows are in front.
export function WindowFrame({ win, focused, hidden, mission, aside }: { win: Win; focused: boolean; hidden: boolean; mission: MissionSpot | null; aside?: boolean }) {
  const d = useDesktop();
  const app = win.appId ? appById(win.appId) : null;
  const { area, phone } = d;
  const frame: Rect = phone ? { x: 0, y: area.top, w: area.w, h: area.bottom - area.top } : frameOf(win, area);
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState<Rect | null>(null);

  // ------------------------------------------------------------ the page

  // The page for the window's address; while the next page loads, the last one stays.
  const fresh = useContent(win.path);
  const [shown, setShown] = useState<{ path: string; node: ReactNode } | null>(() => (fresh !== undefined ? { path: win.path, node: fresh } : null));
  if (fresh !== undefined && (shown?.path !== win.path || shown.node !== fresh)) setShown({ path: win.path, node: fresh });
  const loading = fresh === undefined;
  const shownPathname = shown?.path.split("?")[0] ?? null;

  // Each page starts at the top, or where it was left.
  const lastPathname = useRef<string | null>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || shownPathname === lastPathname.current) return;
    if (lastPathname.current) scrolls.set(`${win.uid}:${lastPathname.current}`, el.scrollTop);
    lastPathname.current = shownPathname;
    el.scrollTop = shownPathname ? (scrolls.get(`${win.uid}:${shownPathname}`) ?? 0) : 0;
  }, [shownPathname, win.uid]);

  // Out of sight: videos and sounds stop.
  useEffect(() => {
    if (hidden) outer.current?.querySelectorAll("video, audio").forEach((m) => (m as HTMLMediaElement).pause());
  }, [hidden]);

  // ------------------------------------------------------------ animations

  const fromDock = () => {
    const el = inner.current;
    const to = d.dockIconRect(win.appId);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const dx = to ? to.left + to.width / 2 - (r.left + r.width / 2) : 0;
    const dy = to ? to.top + to.height / 2 - (r.top + r.height / 2) : 80;
    return { dx, dy };
  };

  // Opening, or coming back from the Dock: out of the app's Dock icon.
  const wasHidden = useRef(true);
  useLayoutEffect(() => {
    const el = inner.current;
    const appearing = wasHidden.current && !hidden;
    wasHidden.current = hidden;
    if (!el || !appearing || phone) return;
    const v = fromDock();
    if (!v) return;
    const anim = el.animate(
      [
        { transform: `translate(${v.dx}px, ${v.dy}px) scale(0.06)`, opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 360, easing: "cubic-bezier(0.2, 0.9, 0.25, 1)" },
    );
    return () => anim.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden]);

  const minimize = () => {
    const el = inner.current;
    const v = fromDock();
    if (!el || !v || phone) return d.minimize(win.id);
    const anim = el.animate(
      [
        { transform: "none", opacity: 1 },
        { transform: `translate(${v.dx}px, ${v.dy}px) scale(0.06)`, opacity: 0 },
      ],
      { duration: 300, easing: "cubic-bezier(0.5, 0, 0.75, 0.4)", fill: "forwards" },
    );
    anim.onfinish = () => {
      d.minimize(win.id);
      anim.cancel();
    };
  };

  const close = () => {
    const el = inner.current;
    if (!el || phone) return d.close(win.id);
    const anim = el.animate(
      [
        { transform: "none", opacity: 1 },
        { transform: "scale(0.94)", opacity: 0 },
      ],
      { duration: 150, easing: "ease-in", fill: "forwards" },
    );
    anim.onfinish = () => d.close(win.id);
  };

  const toggleZoom = () => {
    if (phone) return;
    d.zoom(win.id, win.zoom === "max" ? null : "max");
  };

  // ------------------------------------------------------------ moving

  function startDrag(e: ReactPointerEvent<HTMLElement>) {
    if (e.button !== 0 || phone || mission || (e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    const el = outer.current;
    if (!el) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let rect = frame;
    // Dragging a zoomed window gives it back its own size, under the pointer (as macOS does).
    if (win.zoom) {
      const ratio = (startX - frame.x) / frame.w;
      rect = { x: Math.round(startX - win.w * ratio), y: frame.y, w: win.w, h: win.h };
    }
    let moved = false;
    let zoomTo: Zoom = null;
    let last = rect;
    let raf = 0;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      if (!moved) {
        moved = true;
        d.setBusy(true);
        el.style.width = `${rect.w}px`;
        el.style.height = `${rect.h}px`;
      }
      last = {
        ...rect,
        x: clamp(rect.x + dx, 8 - rect.w + 140, area.w - 140),
        y: clamp(rect.y + dy, area.top + 2, area.bottom - 44),
      };
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `translate3d(${last.x}px, ${last.y}px, 0)`;
      });
      const next: Zoom = ev.clientX <= 4 ? "left" : ev.clientX >= area.w - 4 ? "right" : ev.clientY <= area.top + 2 ? "max" : null;
      if (next !== zoomTo) {
        zoomTo = next;
        setSnap(next ? zoomRect(next, area) : null);
      }
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
      cancelAnimationFrame(raf);
      setSnap(null);
      if (!moved) return;
      d.setBusy(false);
      applyRect(el, zoomTo ? zoomRect(zoomTo, area) : last);
      d.place(win.id, zoomTo ? rect : last);
      if (zoomTo) d.zoom(win.id, zoomTo);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  }

  // ------------------------------------------------------------ resizing

  function startResize(edge: Edge, e: ReactPointerEvent<HTMLElement>) {
    if (e.button !== 0 || phone || mission) return;
    const el = outer.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    d.focus(win.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const r0 = frame;
    let last = r0;
    let raf = 0;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    d.setBusy(true);
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let { x, y, w, h } = r0;
      if (edge.includes("e")) w = clamp(r0.w + dx, MIN_W, area.w - r0.x - 4);
      if (edge.includes("s")) h = clamp(r0.h + dy, MIN_H, area.bottom + 60 - r0.y);
      if (edge.includes("w")) {
        w = clamp(r0.w - dx, MIN_W, r0.x + r0.w - 4);
        x = r0.x + r0.w - w;
      }
      if (edge.includes("n")) {
        const ny = clamp(r0.y + dy, area.top + 2, r0.y + r0.h - MIN_H);
        h = r0.h + (r0.y - ny);
        y = ny;
      }
      last = { x, y, w, h };
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
      });
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
      cancelAnimationFrame(raf);
      d.setBusy(false);
      applyRect(el, last);
      d.place(win.id, last);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  }

  // ------------------------------------------------------------ render

  const title = win.title || app?.name || "Magik OS";
  // What the page's own components know of their window (AutoRefresh, the review room…).
  const state = useMemo(() => ({ id: win.id, path: win.path, focused, visible: !hidden }), [win.id, win.path, focused, hidden]);
  const transform = mission
    ? `translate3d(${frame.x + mission.dx}px, ${frame.y + mission.dy}px, 0) scale(${mission.scale})`
    : `translate3d(${frame.x}px, ${frame.y}px, 0)`;

  return (
    <>
      <div
        ref={outer}
        role="dialog"
        aria-label={title}
        data-focused={focused || undefined}
        data-mission={mission ? "" : undefined}
        data-zoomed={win.zoom ?? undefined}
        data-aside={aside || undefined}
        className={cx("win", phone && "win-phone")}
        style={{ width: frame.w, height: frame.h, transform, zIndex: 20 + win.z, display: hidden ? "none" : undefined }}
        onPointerDownCapture={() => {
          if (!mission && !focused) d.focus(win.id);
        }}
        onClick={
          mission
            ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                d.setMission(false);
                d.focus(win.id);
              }
            : undefined
        }
      >
        <div ref={inner} className="win-inner">
          <header className="win-bar" onPointerDown={startDrag} onDoubleClick={(e) => !(e.target as HTMLElement).closest("button") && toggleZoom()}>
            <div className="traffic-group flex items-center gap-2">
              <button type="button" aria-label={`Close ${title}`} title="Close" onClick={close} className="traffic traffic-close">
                <X size={8} strokeWidth={3} aria-hidden />
              </button>
              {!phone && (
                <>
                  <button type="button" aria-label={`Minimize ${title}`} title="Minimize" onClick={minimize} className="traffic traffic-min">
                    <Minus size={8} strokeWidth={3} aria-hidden />
                  </button>
                  <button type="button" aria-label={win.zoom === "max" ? "Restore the window's size" : "Fill the screen"} title="Zoom" onClick={toggleZoom} className="traffic traffic-zoom">
                    {win.zoom === "max" ? <Minimize2 size={7} strokeWidth={3} aria-hidden /> : <Maximize2 size={7} strokeWidth={3} aria-hidden />}
                  </button>
                </>
              )}
            </div>
            <div className="ml-1 flex items-center">
              <button type="button" aria-label="Back" title="Back" disabled={!win.back.length} onClick={() => d.back(win.id)} className="win-tool">
                <ChevronLeft size={17} aria-hidden />
              </button>
              <button type="button" aria-label="Forward" title="Forward" disabled={!win.ahead.length} onClick={() => d.forward(win.id)} className="win-tool hidden sm:flex">
                <ChevronRight size={17} aria-hidden />
              </button>
            </div>
            <div className="pointer-events-none flex min-w-0 flex-1 items-center justify-center gap-2 px-2">
              {app && <AppIcon icon={app.icon} size={20} />}
              <span className="truncate text-[13.5px] font-semibold text-ink/90">{title}</span>
            </div>
            <div className="flex items-center">
              <button type="button" aria-label="Reload" title="Reload" onClick={() => d.reload(win.id)} className="win-tool">
                <RotateCw size={14} aria-hidden />
              </button>
            </div>
            {loading && shown && <span aria-hidden className="win-progress" />}
          </header>
          <div ref={scroller} className="win-body">
            <Activity mode={hidden ? "hidden" : "visible"}>
              <WindowContext value={state}>
                {shown ? (
                  <PageBoundary key={shownPathname} onReload={() => d.reload(win.id)}>
                    <Suspense fallback={<PageSkeleton />}>
                      <div className="win-page">{shown.node}</div>
                    </Suspense>
                  </PageBoundary>
                ) : (
                  <PageSkeleton name={app?.name} />
                )}
              </WindowContext>
            </Activity>
          </div>
          {!phone &&
            !win.zoom &&
            !mission &&
            EDGES.map((edge) => <span key={edge} aria-hidden className={`win-edge win-edge-${edge}`} onPointerDown={(e) => startResize(edge, e)} />)}
        </div>
        {mission && (
          <span className="win-mission-label" style={{ fontSize: 13 / mission.scale }}>
            {title}
          </span>
        )}
      </div>
      {snap && (
        <div
          aria-hidden
          className="win-snap"
          style={{ transform: `translate3d(${snap.x}px, ${snap.y}px, 0)`, width: snap.w, height: snap.h, zIndex: 19 + win.z }}
        />
      )}
    </>
  );
}

// The frame a drag or a resize ended on, written straight to the element: React's next render
// writes the same values, so the window never jumps.
function applyRect(el: HTMLElement, r: Rect) {
  el.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`;
  el.style.width = `${r.w}px`;
  el.style.height = `${r.h}px`;
}

// While a page loads for the first time: the shape of a page.
function PageSkeleton({ name }: { name?: string }) {
  return (
    <div aria-busy="true" aria-label={name ? `Opening ${name}` : "Loading"} className="win-page animate-fade-in">
      <div className="skeleton mb-2.5 h-3 w-24 rounded-full" />
      <div className="skeleton mb-8 h-8 w-72 max-w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-32 rounded-[18px]" />
        ))}
      </div>
    </div>
  );
}

// A server action that redirected (a new client, the next onboarding step) rejects with Next.js's
// redirect error once the router is already on its way there. Next.js's own boundaries sit
// around the routes, not around the windows, so the window takes it.
const isRedirect = (error: unknown) =>
  typeof error === "object" && error !== null && String((error as { digest?: unknown }).digest ?? "").startsWith("NEXT_REDIRECT");

// A page that broke while rendering: say so in its window, the others keep working. After a
// redirect the page just starts over, as it would under Next.js's redirect boundary.
class PageBoundary extends Component<{ children: ReactNode; onReload: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(error: unknown) {
    return { failed: !isRedirect(error) };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="win-page flex flex-col items-start gap-3">
        <p className="text-[15px] font-semibold text-ink">This page couldn&apos;t open.</p>
        <p className="text-[13.5px] text-muted">The other windows are fine. Try again in a moment.</p>
        <button
          type="button"
          onClick={() => {
            this.setState({ failed: false });
            this.props.onReload();
          }}
          className="mt-1 inline-flex h-9 items-center rounded-full bg-white/10 px-4 text-[13.5px] font-medium text-ink hover:bg-white/15"
        >
          Try again
        </button>
      </div>
    );
  }
}
