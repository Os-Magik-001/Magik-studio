"use client";

import type { CSSProperties, ReactNode } from "react";
import { Eye, Maximize2, Minus, X } from "lucide-react";
import { cx } from "@/components/ui";
import { useStoredValue } from "@/components/use-now";
import { useDesktop } from "@/components/desktop/context";

// Home's panels are widgets: red hides one, yellow folds it to its title, green opens its app.
// What's hidden or folded is kept in this browser, per person.

type Layout = { hidden: string[]; folded: string[] };

const EVENT = "magik:widgets";
const keyFor = (userId: string) => `magik.widgets.${userId}`;

function read(raw: string | null): Layout {
  try {
    const v = JSON.parse(raw ?? "{}") as Partial<Layout>;
    return { hidden: Array.isArray(v.hidden) ? v.hidden : [], folded: Array.isArray(v.folded) ? v.folded : [] };
  } catch {
    return { hidden: [], folded: [] };
  }
}

function useLayout() {
  const { viewer } = useDesktop();
  const raw = useStoredValue(keyFor(viewer.id), "{}", EVENT);
  const layout = read(raw);
  const save = (next: Layout) => {
    try {
      localStorage.setItem(keyFor(viewer.id), JSON.stringify(next));
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  };
  return { layout, save, ready: raw !== null };
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export function Widget({ id, className, style, children }: { id: string; className?: string; style?: CSSProperties; children: ReactNode }) {
  const { layout } = useLayout();
  if (layout.hidden.includes(id)) return null;
  return (
    <div data-widget={id} data-folded={layout.folded.includes(id) || undefined} className={cx("widget", className)} style={style}>
      {children}
    </div>
  );
}

// The panel's traffic lights.
export function PanelLights({ id, href, title }: { id: string; href?: string; title: string }) {
  const d = useDesktop();
  const { layout, save } = useLayout();
  const folded = layout.folded.includes(id);
  return (
    <span className="traffic-group flex items-center gap-1.5">
      <button type="button" aria-label={`Hide ${title}`} title="Hide" onClick={() => save({ ...layout, hidden: toggle(layout.hidden, id) })} className="traffic traffic-close traffic-sm">
        <X size={7} strokeWidth={3} aria-hidden />
      </button>
      <button
        type="button"
        aria-label={folded ? `Unfold ${title}` : `Fold ${title}`}
        title={folded ? "Unfold" : "Fold"}
        aria-pressed={folded}
        onClick={() => save({ ...layout, folded: toggle(layout.folded, id) })}
        className="traffic traffic-min traffic-sm"
      >
        <Minus size={7} strokeWidth={3} aria-hidden />
      </button>
      <button
        type="button"
        aria-label={href ? `Open ${title}` : `${title}: nothing to open`}
        title={href ? "Open" : undefined}
        disabled={!href}
        onClick={() => href && d.open(href)}
        className="traffic traffic-zoom traffic-sm"
      >
        <Maximize2 size={6} strokeWidth={3} aria-hidden />
      </button>
    </span>
  );
}

// Under the panels: the hidden ones can come back.
export function HiddenWidgets({ names }: { names: Record<string, string> }) {
  const { layout, save, ready } = useLayout();
  const hidden = layout.hidden.filter((id) => names[id]);
  if (!ready || !hidden.length) return null;
  return (
    <div className="mt-5 flex justify-center">
      <button
        type="button"
        onClick={() => save({ ...layout, hidden: layout.hidden.filter((id) => !names[id]) })}
        className="glass flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium text-ink"
      >
        <Eye size={15} aria-hidden />
        Show {hidden.length === 1 ? names[hidden[0]] : `${hidden.length} hidden panels`}
      </button>
    </div>
  );
}
