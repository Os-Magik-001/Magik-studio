"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, Maximize2, Minus, RotateCw, X } from "lucide-react";
import { cx } from "@/components/ui";
import { AppIcon } from "@/components/desktop/app-icon";
import { MIN_H, MIN_W, clamp, frameOf, zoomRect, type Area, type Rect, type Win, type Zoom } from "@/components/desktop/use-windows";

type Props = {
  win: Win;
  role: string;
  area: Area;
  focused: boolean;
  phone: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onZoom: (zoom: Zoom) => void;
  onPlace: (rect: Rect) => void;
  onBack: () => void;
  onReload: () => void;
  // The iframe finished loading (pages without the bridge never say "ready").
  onLoaded: () => void;
  onSnapPreview: (rect: Rect | null) => void;
  onInteract: (active: boolean) => void;
  // Where the window goes when minimized: its dock icon.
  dockRect: () => DOMRect | null;
  registerFrame: (key: string, el: HTMLIFrameElement | null) => void;
};

const EDGES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;
type Edge = (typeof EDGES)[number];

const edgeClass: Record<Edge, string> = {
  n: "top-[-4px] left-3 right-3 h-2 cursor-ns-resize",
  s: "bottom-[-4px] left-3 right-3 h-2 cursor-ns-resize",
  e: "right-[-4px] top-3 bottom-3 w-2 cursor-ew-resize",
  w: "left-[-4px] top-3 bottom-3 w-2 cursor-ew-resize",
  ne: "right-[-5px] top-[-5px] h-4 w-4 cursor-nesw-resize",
  nw: "left-[-5px] top-[-5px] h-4 w-4 cursor-nwse-resize",
  se: "right-[-5px] bottom-[-5px] h-4 w-4 cursor-nwse-resize",
  sw: "left-[-5px] bottom-[-5px] h-4 w-4 cursor-nesw-resize",
};

// "Pipeline · Magik OS" -> "Pipeline"
const pageTitle = (title: string) => title.replace(/\s*·\s*Magik OS$/, "").trim();

export function WindowFrame(props: Props) {
  const { win, role, area, focused, phone } = props;
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const frame = frameOf(win, area);
  const [opening, setOpening] = useState(true);
  const wasMinimized = useRef(win.minimized);

  // Open: grow out of the dock icon. Windows coming back after a reload just appear.
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el || phone || win.minimized || Date.now() - win.openedAt > 1500) {
      setOpening(false);
      return;
    }
    const from = props.dockRect();
    const r = el.getBoundingClientRect();
    const dx = from ? from.left + from.width / 2 - (r.left + r.width / 2) : 0;
    const dy = from ? from.top + from.height / 2 - (r.top + r.height / 2) : 40;
    const anim = el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(0.08)`, opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 340, easing: "cubic-bezier(0.2, 0.9, 0.25, 1)" },
    );
    anim.onfinish = () => setOpening(false);
    return () => anim.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el || phone) return;
    if (wasMinimized.current && !win.minimized) {
      const from = props.dockRect();
      const r = el.getBoundingClientRect();
      const dx = from ? from.left + from.width / 2 - (r.left + r.width / 2) : 0;
      const dy = from ? from.top + from.height / 2 - (r.top + r.height / 2) : 40;
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(0.06)`, opacity: 0 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 320, easing: "cubic-bezier(0.2, 0.9, 0.25, 1)" },
      );
    }
    wasMinimized.current = win.minimized;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.minimized]);

  function minimize() {
    const el = inner.current;
    const to = props.dockRect();
    if (!el || phone || !to) return props.onMinimize();
    const r = el.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (r.left + r.width / 2);
    const dy = to.top + to.height / 2 - (r.top + r.height / 2);
    const anim = el.animate(
      [
        { transform: "none", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.06)`, opacity: 0 },
      ],
      { duration: 300, easing: "cubic-bezier(0.5, 0, 0.75, 0.4)", fill: "forwards" },
    );
    anim.onfinish = () => {
      props.onMinimize();
      anim.cancel();
    };
  }

  function close() {
    const el = inner.current;
    if (!el || phone) return props.onClose();
    const anim = el.animate(
      [
        { transform: "none", opacity: 1 },
        { transform: "scale(0.94)", opacity: 0 },
      ],
      { duration: 150, easing: "ease-in", fill: "forwards" },
    );
    anim.onfinish = () => props.onClose();
  }

  // ------------------------------------------------------------ dragging the title bar

  function startDrag(e: ReactPointerEvent) {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button, a, input")) return;
    props.onFocus();
    if (phone) return;
    const el = outer.current!;
    const startX = e.clientX;
    const startY = e.clientY;
    let rect = frame;
    // Dragging a zoomed window gives it back its own size, under the pointer (as macOS does).
    if (win.zoom) {
      const ratio = (startX - frame.x) / frame.w;
      rect = { x: Math.round(startX - win.w * ratio), y: frame.y, w: win.w, h: win.h };
    }
    let moved = false;
    let snap: Zoom = null;
    let last = rect;
    const pointerId = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(pointerId);

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      if (!moved) {
        moved = true;
        props.onInteract(true);
        if (win.zoom) {
          el.style.width = `${rect.w}px`;
          el.style.height = `${rect.h}px`;
        }
      }
      last = {
        ...rect,
        x: clamp(rect.x + dx, 8 - rect.w + 160, area.w - 160),
        y: clamp(rect.y + dy, area.top + 2, area.bottom - 44),
      };
      el.style.transform = `translate3d(${last.x}px, ${last.y}px, 0)`;
      snap = ev.clientX <= 6 ? "left" : ev.clientX >= area.w - 6 ? "right" : ev.clientY <= area.top + 3 ? "max" : null;
      props.onSnapPreview(snap ? zoomRect(snap, area) : null);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      props.onSnapPreview(null);
      if (!moved) return;
      props.onInteract(false);
      el.style.width = "";
      el.style.height = "";
      if (snap) {
        props.onPlace(rect);
        props.onZoom(snap);
      } else {
        props.onPlace(last);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  // ------------------------------------------------------------ resizing from an edge

  function startResize(edge: Edge, e: ReactPointerEvent) {
    if (e.button !== 0 || phone) return;
    e.stopPropagation();
    props.onFocus();
    const el = outer.current!;
    const startX = e.clientX;
    const startY = e.clientY;
    const r0 = frame;
    let last = r0;
    props.onInteract(true);
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let { x, y, w, h } = r0;
      if (edge.includes("e")) w = Math.max(MIN_W, r0.w + dx);
      if (edge.includes("s")) h = Math.max(MIN_H, Math.min(r0.h + dy, area.bottom + 40 - r0.y));
      if (edge.includes("w")) {
        w = Math.max(MIN_W, r0.w - dx);
        x = r0.x + r0.w - w;
      }
      if (edge.includes("n")) {
        const ny = clamp(r0.y + dy, area.top + 2, r0.y + r0.h - MIN_H);
        h = r0.h + (r0.y - ny);
        y = ny;
      }
      last = { x, y, w, h };
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      props.onInteract(false);
      el.style.width = "";
      el.style.height = "";
      props.onPlace(last);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  // Tell the page when it's out of sight, so it can stop polling.
  const iframe = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => {
    iframe.current?.contentWindow?.postMessage({ type: "magik:hidden", hidden: win.minimized }, location.origin);
  }, [win.minimized, win.ready]);

  const title = pageTitle(win.title) || win.name;
  const style = phone
    ? { zIndex: win.z, visibility: win.minimized ? ("hidden" as const) : undefined }
    : {
        transform: `translate3d(${frame.x}px, ${frame.y}px, 0)`,
        width: frame.w,
        height: frame.h,
        zIndex: win.z,
        visibility: win.minimized ? ("hidden" as const) : undefined,
      };

  return (
    <div
      ref={outer}
      className={cx(
        "absolute",
        phone ? "inset-0" : "top-0 left-0",
        !phone && !opening && "transition-[width,height,transform] duration-[260ms] ease-[cubic-bezier(0.2,0.9,0.25,1)] [.is-interacting_&]:transition-none",
      )}
      style={style}
      aria-hidden={win.minimized || undefined}
      data-window={win.key}
    >
      <div
        ref={inner}
        className={cx(
          "material-window flex h-full flex-col overflow-hidden",
          phone ? "rounded-none" : "rounded-[22px]",
          focused
            ? "shadow-[0_0_0_0.5px_rgba(255,255,255,0.22)_inset,0_0_0_1px_rgba(0,0,0,0.7),0_38px_90px_-12px_rgba(0,0,0,0.75)]"
            : "win-inactive shadow-[0_0_0_0.5px_rgba(255,255,255,0.12)_inset,0_0_0_1px_rgba(0,0,0,0.6),0_18px_50px_-14px_rgba(0,0,0,0.6)]",
        )}
        onPointerDownCapture={props.onFocus}
      >
        {/* Title bar */}
        <div
          className={cx(
            "relative flex shrink-0 items-center gap-3 border-b select-none",
            phone ? "glass-bar h-[52px] rounded-none px-3 pt-0" : "h-[46px] px-4",
            focused ? "border-white/[0.07] bg-white/[0.035]" : "border-white/[0.05] bg-transparent",
          )}
          onPointerDown={startDrag}
          onDoubleClick={(e) => {
            if (phone || (e.target as HTMLElement).closest("button")) return;
            props.onZoom(win.zoom ? null : "max");
          }}
        >
          {phone ? (
            <button
              type="button"
              onClick={props.onMinimize}
              className="flex h-9 items-center gap-1 rounded-full px-2 text-[15px] font-medium text-accent"
            >
              <ChevronLeft size={20} aria-hidden /> Home
            </button>
          ) : (
            <div className="traffic-group flex items-center gap-2 pr-1">
              <button type="button" aria-label={`Close ${win.name}`} onClick={close} className="traffic bg-[#ff5f57]">
                <X size={8} strokeWidth={3} aria-hidden />
              </button>
              <button type="button" aria-label={`Minimize ${win.name}`} onClick={minimize} className="traffic bg-[#febc2e]">
                <Minus size={8} strokeWidth={3} aria-hidden />
              </button>
              <button
                type="button"
                aria-label={win.zoom ? `Restore ${win.name}` : `Zoom ${win.name}`}
                onClick={() => props.onZoom(win.zoom ? null : "max")}
                className="traffic bg-[#28c840]"
              >
                <Maximize2 size={7} strokeWidth={3} aria-hidden />
              </button>
            </div>
          )}
          <button
            type="button"
            aria-label="Back"
            disabled={win.trail.length < 2}
            onClick={props.onBack}
            className={cx(
              "flex h-7 w-7 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-white/10 disabled:opacity-0",
              phone && "hidden",
            )}
          >
            <ChevronLeft size={17} aria-hidden />
          </button>
          <div className={cx("flex min-w-0 flex-1 items-center gap-2", phone ? "justify-center pr-16" : "")}>
            <AppIcon icon={win.icon} tint={win.tint} glyph={win.glyph} size={18} className="rounded-[5px]" />
            <span className={cx("truncate text-[13px] font-semibold", focused ? "text-ink" : "text-muted")}>{title}</span>
            {title !== win.name && !phone && <span className="hidden truncate text-[12px] text-muted md:inline">— {win.name}</span>}
          </div>
          <button
            type="button"
            aria-label="Reload"
            onClick={props.onReload}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-ink"
          >
            <RotateCw size={14} aria-hidden />
          </button>
        </div>

        {/* The app */}
        <div className="relative min-h-0 flex-1">
          {win.loaded && (
            <iframe
              ref={(el) => {
                iframe.current = el;
                props.registerFrame(win.key, el);
              }}
              key={win.src}
              src={win.src}
              title={win.name}
              data-key={win.key}
              data-role={role}
              allow="fullscreen; clipboard-read; clipboard-write; autoplay"
              allowFullScreen
              onLoad={props.onLoaded}
              className="absolute inset-0 h-full w-full border-0 bg-transparent [.is-interacting_&]:pointer-events-none"
            />
          )}
          {!win.ready && <WindowSkeleton />}
        </div>
      </div>

      {!phone && !win.zoom && EDGES.map((edge) => (
        <div key={edge} aria-hidden className={cx("absolute z-10", edgeClass[edge])} onPointerDown={(e) => startResize(edge, e)} />
      ))}
    </div>
  );
}

function WindowSkeleton() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 animate-fade-in px-8 pt-7">
      <div className="skeleton mb-2 h-3 w-20 rounded-full" />
      <div className="skeleton mb-7 h-7 w-56 rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-28 rounded-[18px]" />
        ))}
      </div>
    </div>
  );
}
