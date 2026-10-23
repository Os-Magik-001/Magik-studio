"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowRight, CalendarDays, Clapperboard, FolderOpen, Search } from "lucide-react";
import type { AppDef } from "@/lib/apps";
import { cx } from "@/components/ui";
import { AppIcon } from "@/components/shell/app-icon";
import { searchDesktop, type SpotlightHit } from "@/app/actions/desktop";
import { useDesktop } from "@/components/desktop/context";

export type QuickAction = { label: string; hint: string; href: string };

type Row =
  | { kind: "app"; app: AppDef }
  | { kind: "action"; action: QuickAction }
  | { kind: "hit"; hit: SpotlightHit };

// ⌘K: find an app, a quick action, a client, a video or an event, and open it.
export function Spotlight({
  apps,
  actions,
  onOpenHref,
  onClose,
}: {
  apps: AppDef[];
  actions: QuickAction[];
  onOpenHref: (href: string) => void;
  onClose: () => void;
}) {
  const d = useDesktop();
  // An app: its window comes forward, or opens.
  const onOpenApp = (app: AppDef) => {
    const main = d.wins.filter((w) => w.appId === app.id && !w.doc).sort((a, b) => b.z - a.z)[0];
    if (main) d.focus(main.id);
    else onOpenHref(app.href);
  };
  const [query, setQuery] = useState("");
  // Search results, for the query they answer.
  const [found, setFound] = useState<{ q: string; hits: SpotlightHit[] }>({ q: "", hits: [] });
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const id = setTimeout(() => {
      startTransition(async () => {
        const hits = await searchDesktop(q);
        setFound({ q, hits });
        setActive(0);
      });
    }, 160);
    return () => clearTimeout(id);
  }, [query]);
  const hits = useMemo(() => (found.q === query.trim() ? found.hits : []), [found, query]);

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const matches = (s: string) => !q || s.toLowerCase().includes(q);
    return [
      ...apps.filter((a) => matches(a.name) || matches(a.hint)).map((app) => ({ kind: "app" as const, app })),
      ...actions.filter((a) => matches(a.label) || matches(a.hint)).map((action) => ({ kind: "action" as const, action })),
      ...hits.map((hit) => ({ kind: "hit" as const, hit })),
    ];
  }, [apps, actions, hits, query]);

  const choose = (row: Row | undefined) => {
    if (!row) return;
    onClose();
    if (row.kind === "app") onOpenApp(row.app);
    else if (row.kind === "action") onOpenHref(row.action.href);
    else onOpenHref(row.hit.href);
  };

  return (
    <div
      className="fixed inset-0 z-[9800] flex justify-center px-4 pt-[16vh]"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-label="Search" className="glass-pop animate-pop-in h-fit w-full max-w-[640px] overflow-hidden rounded-[22px]">
        <div className="flex items-center gap-3 px-5">
          <Search size={20} className="shrink-0 text-muted" aria-hidden />
          <input
            ref={input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(rows.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                choose(rows[active]);
              }
            }}
            placeholder="Search apps, clients, videos and events"
            aria-label="Search apps, clients, videos and events"
            className="h-[58px] flex-1 bg-transparent text-[20px] font-light text-ink placeholder:text-muted/70 focus:outline-none"
          />
          {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white/80" aria-hidden />}
        </div>
        {rows.length > 0 && (
          <ul role="listbox" className="max-h-[52vh] overflow-y-auto border-t border-white/10 p-2">
            {rows.map((row, i) => {
              const selected = i === active;
              const [label, hint, icon] =
                row.kind === "app"
                  ? [row.app.name, row.app.hint, <AppIcon key="i" icon={row.app.icon} size={30} />]
                  : row.kind === "action"
                    ? [row.action.label, row.action.hint, <span key="i" className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-white/10"><ArrowRight size={16} aria-hidden /></span>]
                    : [
                        row.hit.title,
                        row.hit.subtitle,
                        <span key="i" className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-white/10">
                          {row.hit.kind === "client" ? <FolderOpen size={16} aria-hidden /> : row.hit.kind === "event" ? <CalendarDays size={16} aria-hidden /> : <Clapperboard size={16} aria-hidden />}
                        </span>,
                      ];
              return (
                <li key={i} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onPointerMove={() => setActive(i)}
                    onClick={() => choose(row)}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-[12px] px-3 py-2 text-left",
                      selected ? "bg-accent text-black" : "text-ink",
                    )}
                  >
                    {icon}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{label}</span>
                      <span className={cx("block truncate text-[12px]", selected ? "text-black/65" : "text-muted")}>{hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {query.trim().length >= 2 && !pending && rows.length === 0 && (
          <p className="border-t border-white/10 px-5 py-4 text-[13px] text-muted">Nothing matches “{query.trim()}”.</p>
        )}
      </div>
    </div>
  );
}
