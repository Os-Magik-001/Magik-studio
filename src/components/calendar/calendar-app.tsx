"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { COLOR_HEX, SOURCES, type CalEvent, type CalendarSource, type Person } from "@/lib/calendar";
import type { CalendarView } from "@/lib/preferences";
import { cx } from "@/components/ui";
import { useDesktop, useWindowState } from "@/components/desktop/context";
import { moveEvent, setPostDate } from "@/app/actions/calendar";
import { addDays, addMonths, dayKey, eventDays, fromKey, layoutDay, minutesInto, monthGridStart, sameDay, startOfDay, startOfWeek, timeLabel } from "@/components/calendar/dates";
import { EventCard, EventEditor, draftAt, draftOf, type Draft } from "@/components/calendar/event-editor";

// The Calendar app, in the manner of Google Calendar: a sidebar (create, a small month, the
// calendars shown), then the day, the week, the month or a list. Everyone's calendar reads the
// same data (lib/calendar-data.ts), so a shoot or a posting date shows for everyone it
// concerns, and it refreshes every minute while the window is in front.

const HOUR = 48;
const VIEWS: { key: CalendarView; label: string; letter: string }[] = [
  { key: "day", label: "Day", letter: "d" },
  { key: "week", label: "Week", letter: "w" },
  { key: "month", label: "Month", letter: "m" },
  { key: "agenda", label: "List", letter: "a" },
];
const HIDDEN_KEY = "magik.calendar.hidden";

type Props = {
  initial: { month: string; events: CalEvent[] };
  role: string;
  people: Person[];
  clients: { id: string; name: string }[];
  weekStart: 0 | 1;
  view: CalendarView;
  focusDate: string | null;
  focusEvent: string | null;
  startNew: boolean;
};

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// What one fetch covers: the six weeks around a month (day, week and month views), or two
// months from a day (the list).
function rangeFor(view: CalendarView, cursor: Date, weekStart: 0 | 1) {
  if (view === "agenda") {
    const from = startOfDay(cursor);
    return { key: `list:${dayKey(from)}`, from, to: addDays(from, 60) };
  }
  const from = monthGridStart(cursor, weekStart);
  return { key: `month:${monthKey(cursor)}`, from, to: addDays(from, 42) };
}

export function CalendarApp({ initial, role, people, clients, weekStart, view: initialView, focusDate, focusEvent, startNew }: Props) {
  const desktop = useDesktop();
  const win = useWindowState();
  const isClient = role === "client";
  const canEditPosts = role === "admin" || role === "editor";
  const [view, setView] = useState<CalendarView>(initialView);
  const [cursor, setCursor] = useState<Date>(() => (focusDate ? fromKey(focusDate) : startOfDay(new Date())));
  const [hidden, setHidden] = useState<Set<CalendarSource>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? "[]") as CalendarSource[]);
    } catch {
      return new Set();
    }
  });
  const [cache, setCache] = useState<Map<string, CalEvent[]>>(() => new Map([[`month:${initial.month}`, initial.events]]));
  const [loading, setLoading] = useState(false);
  const [card, setCard] = useState<{ event: CalEvent; anchor: DOMRect | null } | null>(null);
  const [editor, setEditor] = useState<Draft | null>(() => (startNew ? draftAt(nextSlot(new Date())) : null));
  const [now, setNow] = useState(() => new Date());
  const range = rangeFor(view, cursor, weekStart);

  // ------------------------------------------------------------ data

  const fetching = useRef(new Set<string>());
  const load = useCallback(async (r: { key: string; from: Date; to: Date }, force = false) => {
    if (fetching.current.has(r.key)) return;
    fetching.current.add(r.key);
    setLoading(true);
    try {
      const res = await fetch(`/api/events?from=${encodeURIComponent(r.from.toISOString())}&to=${encodeURIComponent(r.to.toISOString())}`, { cache: "no-store" });
      if (res.ok) {
        const { events } = (await res.json()) as { events: CalEvent[] };
        setCache((c) => {
          const next = force ? new Map<string, CalEvent[]>() : new Map(c);
          next.set(r.key, events);
          return next;
        });
      }
    } finally {
      fetching.current.delete(r.key);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!cache.has(range.key)) load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.key]);

  // In sync: every minute while the window is in front, and on coming back to it.
  const viewRef = useRef(view);
  const cursorRef = useRef(cursor);
  useLayoutEffect(() => {
    viewRef.current = view;
    cursorRef.current = cursor;
  });
  const active = !win || (win.focused && win.visible);
  useEffect(() => {
    if (!active) return;
    load(range, true);
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load(rangeFor(viewRef.current, cursorRef.current, weekStart), true);
      setNow(new Date());
    }, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  const reload = () => load(rangeFor(view, cursor, weekStart), true);

  const events = useMemo(() => (cache.get(range.key) ?? []).filter((e) => !hidden.has(e.source)), [cache, range.key, hidden]);
  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) for (const d of eventDays(e)) map.set(d, [...(map.get(d) ?? []), e]);
    for (const list of map.values()) list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start));
    return map;
  }, [events]);

  // What the address asks for (Spotlight, Home, a notification): a day, an event, a new event.
  // The Calendar may already be open, so each new ask is acted on when it comes; an event's card
  // opens once the event has loaded.
  const [asked, setAsked] = useState({ focusDate, focusEvent, startNew });
  const [wanted, setWanted] = useState(focusEvent);
  if (asked.focusDate !== focusDate || asked.focusEvent !== focusEvent || asked.startNew !== startNew) {
    setAsked({ focusDate, focusEvent, startNew });
    if (focusDate && focusDate !== asked.focusDate) setCursor(fromKey(focusDate));
    if (focusEvent && focusEvent !== asked.focusEvent) setWanted(focusEvent);
    if (startNew && !asked.startNew) setEditor(draftAt(nextSlot(new Date())));
  }
  if (wanted) {
    const e = events.find((x) => x.id === `ev:${wanted}`);
    if (e) {
      setWanted(null);
      setCard({ event: e, anchor: null });
    }
  }
  // Then the address lets go of it: the same ask works again, and a reload doesn't repeat it.
  const replaceAddress = desktop.replace;
  const asking = !!(focusDate || focusEvent || startNew);
  useEffect(() => {
    if (asking && win?.focused) replaceAddress(win.id, "/calendar");
  }, [asking, win?.focused, win?.id, replaceAddress]);

  // ------------------------------------------------------------ navigation

  const step = (dir: -1 | 1) => {
    setCard(null);
    setCursor((c) => (view === "month" ? addMonths(c, dir) : view === "week" ? addDays(c, 7 * dir) : view === "day" ? addDays(c, dir) : addDays(c, 30 * dir)));
  };
  const today = () => {
    setCard(null);
    setCursor(startOfDay(new Date()));
  };

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || editor || (t && (t.closest("input, textarea, select, [contenteditable]") || t.isContentEditable))) return;
      const v = VIEWS.find((x) => x.letter === e.key);
      if (v) setView(v.key);
      else if (e.key === "t") today();
      else if (e.key === "ArrowLeft" || e.key === "k") step(-1);
      else if (e.key === "ArrowRight" || e.key === "j") step(1);
      else if (e.key === "c") setEditor(draftAt(nextSlot(cursor)));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const toggleSource = (s: CalendarSource) => {
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      try {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const title =
    view === "month"
      ? cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : view === "week"
        ? weekTitle(startOfWeek(cursor, weekStart))
        : view === "day"
          ? cursor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
          : `From ${cursor.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`;

  const sources = SOURCES.filter((s) => (s.key === "due" ? !isClient && role !== "seller" : s.key === "invoice" ? isClient || role === "admin" || role === "seller" : s.key === "shoot" || s.key === "post" ? role !== "seller" : true));

  const openCard = (event: CalEvent, el: HTMLElement | null) => setCard({ event, anchor: el?.getBoundingClientRect() ?? null });

  // Moving an event (or a posting date) in the week and day views.
  const move = async (e: CalEvent, start: Date, end: Date) => {
    const before = cache.get(range.key) ?? [];
    setCache((c) => new Map(c).set(range.key, before.map((x) => (x.id === e.id ? { ...x, start: start.toISOString(), end: end.toISOString() } : x))));
    const r = e.source === "post" ? await setPostDate(e.videoId!, start.toISOString()) : await moveEvent(e.id.replace(/^ev:/, ""), start.toISOString(), end.toISOString());
    if (!r.ok) setCache((c) => new Map(c).set(range.key, before));
    reload();
  };
  const canMove = (e: CalEvent) => (e.source === "event" && e.editable) || (e.source === "post" && canEditPosts);

  return (
    <div className="win-bleed flex min-h-0 flex-col @min-[48rem]:flex-row">
      {/* ------------------------------------------------ sidebar */}
      <aside className="hidden w-[252px] shrink-0 flex-col gap-5 border-r border-white/[0.07] bg-white/[0.02] p-4 @min-[48rem]:flex">
        <button
          type="button"
          onClick={() => setEditor(draftAt(nextSlot(sameDay(cursor, new Date()) ? new Date() : withHour(cursor, 9))))}
          className="glass-tint flex h-12 items-center gap-2.5 self-start rounded-[16px] pr-6 pl-4 text-[14.5px] font-semibold"
        >
          <Plus size={20} aria-hidden /> Create
        </button>
        <MiniMonth cursor={cursor} weekStart={weekStart} byDay={byDay} onPick={(d) => setCursor(d)} />
        <div>
          <p className="mb-1.5 px-1 text-[12px] font-semibold tracking-wide text-muted uppercase">Calendars</p>
          <ul className="flex flex-col">
            {sources.map((s) => (
              <li key={s.key}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-1.5 py-1.5 text-[13.5px] text-ink hover:bg-white/[0.05]">
                  <input type="checkbox" checked={!hidden.has(s.key)} onChange={() => toggleSource(s.key)} className="peer sr-only" />
                  <span
                    aria-hidden
                    className="flex h-[16px] w-[16px] items-center justify-center rounded-[4px] border-2 text-[10px] font-bold text-black"
                    style={{ borderColor: COLOR_HEX[s.color], background: hidden.has(s.key) ? "transparent" : COLOR_HEX[s.color] }}
                  >
                    {hidden.has(s.key) ? "" : "✓"}
                  </span>
                  {s.key === "event" ? "My events" : s.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
        <Link href="/account/calendar" className="mt-auto rounded-[12px] bg-white/[0.05] px-3 py-2.5 text-[12.5px] text-ink-2 hover:bg-white/[0.08]">
          <span className="block font-medium text-ink">Sync with Google or Apple</span>
          See this calendar on your phone. Settings › Calendar
        </Link>
      </aside>

      {/* ------------------------------------------------ main */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b border-white/[0.07] px-4 py-2.5 @min-[40rem]:px-5">
          <button type="button" onClick={today} className="h-8 rounded-full bg-white/[0.08] px-4 text-[13px] font-medium text-ink hover:bg-white/[0.13]">
            Today
          </button>
          <div className="flex">
            <button type="button" aria-label="Previous" onClick={() => step(-1)} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-white/10">
              <ChevronLeft size={18} aria-hidden />
            </button>
            <button type="button" aria-label="Next" onClick={() => step(1)} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-white/10">
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
          <h1 className="min-w-0 flex-1 truncate font-display text-[19px] font-semibold text-ink first-letter:uppercase">{title}</h1>
          <button type="button" aria-label="Refresh" title="Refresh" onClick={reload} className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-ink">
            <RefreshCw size={14} className={loading ? "animate-spin" : undefined} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setEditor(draftAt(nextSlot(new Date())))}
            className="glass-tint flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-semibold @min-[48rem]:hidden"
          >
            <Plus size={15} aria-hidden /> New
          </button>
          <div role="tablist" aria-label="View" className="inline-flex rounded-full bg-white/[0.07] p-[3px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                role="tab"
                aria-selected={view === v.key}
                onClick={() => setView(v.key)}
                className={cx(
                  "h-[28px] rounded-full px-3.5 text-[13px] font-medium transition-colors",
                  view === v.key ? "bg-white/[0.16] text-ink shadow-[0_1px_3px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.12)]" : "text-muted hover:text-ink",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </header>

        {view === "month" && (
          <MonthView
            cursor={cursor}
            weekStart={weekStart}
            byDay={byDay}
            now={now}
            onDay={(d) => {
              setCursor(d);
              setView("day");
            }}
            onCreate={(d) => setEditor(draftAt(d, 60, true))}
            onEvent={openCard}
          />
        )}
        {(view === "week" || view === "day") && (
          <TimeGrid
            days={view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor, weekStart), i)) : [startOfDay(cursor)]}
            byDay={byDay}
            now={now}
            onCreate={(start) => setEditor(draftAt(start))}
            onCreateAllDay={(d) => setEditor(draftAt(d, 60, true))}
            onEvent={openCard}
            canMove={canMove}
            onMove={move}
            onDay={(d) => {
              setCursor(d);
              setView("day");
            }}
          />
        )}
        {view === "agenda" && <Agenda from={cursor} byDay={byDay} onEvent={openCard} />}
      </section>

      {card && (
        <EventCard
          event={card.event}
          anchor={card.anchor}
          canEditPosts={canEditPosts}
          onClose={() => setCard(null)}
          onEdit={() => {
            setEditor(draftOf(card.event));
            setCard(null);
          }}
          onChanged={() => {
            setCard(null);
            reload();
          }}
          onOpen={(href) => {
            setCard(null);
            desktop.open(href);
          }}
        />
      )}
      {editor && (
        <EventEditor
          draft={editor}
          people={people}
          clients={clients}
          isClient={isClient}
          onClose={() => setEditor(null)}
          onSaved={(date) => {
            setEditor(null);
            const d = fromKey(date);
            if (!sameDay(d, cursor) && rangeFor(view, d, weekStart).key !== range.key) setCursor(d);
            reload();
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------ helpers

function withHour(d: Date, h: number) {
  const x = startOfDay(d);
  x.setHours(h);
  return x;
}

// The next half hour from a moment.
function nextSlot(d: Date) {
  const x = new Date(d);
  x.setSeconds(0, 0);
  x.setMinutes(x.getMinutes() < 30 ? 30 : 60);
  return x;
}

function weekTitle(start: Date) {
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const a = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const b = end.toLocaleDateString(undefined, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" });
  return `${a} – ${b}, ${end.getFullYear()}`;
}

function weekdayNames(weekStart: 0 | 1, style: "short" | "narrow") {
  const base = new Date(2024, 0, 7 + weekStart); // a Sunday, or a Monday
  return Array.from({ length: 7 }, (_, i) => addDays(base, i).toLocaleDateString(undefined, { weekday: style }));
}

// ------------------------------------------------------------ the small month

function MiniMonth({ cursor, weekStart, byDay, onPick }: { cursor: Date; weekStart: 0 | 1; byDay: Map<string, CalEvent[]>; onPick: (d: Date) => void }) {
  const [shown, setShown] = useState(() => new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  const [last, setLast] = useState(monthKey(cursor));
  if (monthKey(cursor) !== last) {
    setLast(monthKey(cursor));
    setShown(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  }
  const start = monthGridStart(shown, weekStart);
  const today = new Date();
  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-[13px] font-semibold text-ink first-letter:uppercase">{shown.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
        <span className="flex">
          <button type="button" aria-label="Previous month" onClick={() => setShown((s) => addMonths(s, -1))} className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-white/10">
            <ChevronLeft size={14} aria-hidden />
          </button>
          <button type="button" aria-label="Next month" onClick={() => setShown((s) => addMonths(s, 1))} className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-white/10">
            <ChevronRight size={14} aria-hidden />
          </button>
        </span>
      </div>
      <div className="grid grid-cols-7 text-center text-[10.5px] text-muted">
        {weekdayNames(weekStart, "narrow").map((n, i) => (
          <span key={i} className="py-1">
            {n}
          </span>
        ))}
        {Array.from({ length: 42 }, (_, i) => {
          const d = addDays(start, i);
          const inMonth = d.getMonth() === shown.getMonth();
          const isToday = sameDay(d, today);
          const picked = sameDay(d, cursor);
          const busy = (byDay.get(dayKey(d))?.length ?? 0) > 0;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(d)}
              aria-label={d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              className={cx(
                "relative mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[12px] tabular-nums",
                isToday ? "bg-accent font-semibold text-black" : picked ? "bg-white/[0.16] text-ink" : inMonth ? "text-ink-2 hover:bg-white/10" : "text-muted/60 hover:bg-white/10",
              )}
            >
              {d.getDate()}
              {busy && !isToday && <span aria-hidden className="absolute bottom-[3px] h-[3px] w-[3px] rounded-full bg-accent/80" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ month

function Chip({ e, onEvent, day }: { e: CalEvent; onEvent: (e: CalEvent, el: HTMLElement | null) => void; day: string }) {
  const color = COLOR_HEX[e.color];
  if (e.allDay || eventDays(e).length > 1) {
    const first = eventDays(e)[0] === day;
    return (
      <button
        type="button"
        onClick={(ev) => {
          ev.stopPropagation();
          onEvent(e, ev.currentTarget);
        }}
        className="block w-full truncate rounded-[5px] px-1.5 py-[1px] text-left text-[11.5px] font-medium text-black"
        style={{ background: color, opacity: first ? 1 : 0.85 }}
      >
        {e.title}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={(ev) => {
        ev.stopPropagation();
        onEvent(e, ev.currentTarget);
      }}
      className="flex w-full items-center gap-1 truncate rounded-[5px] px-1 py-[1px] text-left text-[11.5px] text-ink hover:bg-white/[0.08]"
    >
      <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: color }} />
      <span className="shrink-0 text-muted tabular-nums">{timeLabel(new Date(e.start))}</span>
      <span className="truncate">{e.title}</span>
    </button>
  );
}

function MonthView({
  cursor,
  weekStart,
  byDay,
  now,
  onDay,
  onCreate,
  onEvent,
}: {
  cursor: Date;
  weekStart: 0 | 1;
  byDay: Map<string, CalEvent[]>;
  now: Date;
  onDay: (d: Date) => void;
  onCreate: (d: Date) => void;
  onEvent: (e: CalEvent, el: HTMLElement | null) => void;
}) {
  const start = monthGridStart(cursor, weekStart);
  return (
    <div className="flex min-h-[560px] flex-1 flex-col">
      <div className="grid grid-cols-7 border-b border-white/[0.07]">
        {weekdayNames(weekStart, "short").map((n) => (
          <span key={n} className="py-1.5 text-center text-[11.5px] font-semibold tracking-wide text-muted uppercase">
            {n}
          </span>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {Array.from({ length: 42 }, (_, i) => {
          const d = addDays(start, i);
          const key = dayKey(d);
          const list = byDay.get(key) ?? [];
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = sameDay(d, now);
          const shown = list.slice(0, 3);
          return (
            <div
              key={key}
              onClick={() => onCreate(d)}
              className={cx("min-h-[92px] min-w-0 cursor-pointer border-r border-b border-white/[0.06] p-1 hover:bg-white/[0.025]", !inMonth && "bg-black/[0.12]", i % 7 === 6 && "border-r-0")}
            >
              <div className="mb-0.5 flex justify-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDay(d);
                  }}
                  className={cx(
                    "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] tabular-nums",
                    isToday ? "bg-accent font-semibold text-black" : inMonth ? "text-ink hover:bg-white/10" : "text-muted hover:bg-white/10",
                  )}
                >
                  {d.getDate() === 1 ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : d.getDate()}
                </button>
              </div>
              <div className="flex flex-col gap-[2px]">
                {shown.map((e) => (
                  <Chip key={e.id} e={e} onEvent={onEvent} day={key} />
                ))}
                {list.length > shown.length && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDay(d);
                    }}
                    className="rounded-[5px] px-1.5 text-left text-[11.5px] font-medium text-ink-2 hover:bg-white/[0.08]"
                  >
                    {list.length - shown.length} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ week and day

function TimeGrid({
  days,
  byDay,
  now,
  onCreate,
  onCreateAllDay,
  onEvent,
  canMove,
  onMove,
  onDay,
}: {
  days: Date[];
  byDay: Map<string, CalEvent[]>;
  now: Date;
  onCreate: (start: Date) => void;
  onCreateAllDay: (d: Date) => void;
  onEvent: (e: CalEvent, el: HTMLElement | null) => void;
  canMove: (e: CalEvent) => boolean;
  onMove: (e: CalEvent, start: Date, end: Date) => void;
  onDay: (d: Date) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const cols = useRef<HTMLDivElement>(null);

  // Open on the morning (or the current hour).
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const h = days.some((d) => sameDay(d, now)) ? Math.max(0, now.getHours() - 2) : 7;
    el.scrollTop = h * HOUR;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.length, dayKey(days[0])]);

  const allDay = days.map((d) => (byDay.get(dayKey(d)) ?? []).filter((e) => e.allDay));

  // Moving: drag an event up or down (15 minutes at a time), or to another day.
  const drag = (e: CalEvent, dayIndex: number, mode: "move" | "resize", ev: ReactPointerEvent<HTMLElement>) => {
    if (ev.button !== 0) return;
    const el = ev.currentTarget.closest("[data-event]") as HTMLElement | null;
    const grid = cols.current;
    if (!el || !grid) return;
    ev.stopPropagation();
    const startX = ev.clientX;
    const startY = ev.clientY;
    const colW = grid.getBoundingClientRect().width / days.length;
    const s0 = new Date(e.start);
    const e0 = new Date(e.end);
    let moved = false;
    let dMin = 0;
    let dDay = 0;
    const target = ev.currentTarget;
    target.setPointerCapture(ev.pointerId);
    const onMoveP = (m: PointerEvent) => {
      const dy = m.clientY - startY;
      const dx = m.clientX - startX;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      dMin = Math.round(((dy / HOUR) * 60) / 15) * 15;
      dDay = mode === "move" ? Math.max(-dayIndex, Math.min(days.length - 1 - dayIndex, Math.round(dx / colW))) : 0;
      if (mode === "move") el.style.transform = `translate(${dDay * colW}px, ${(dMin / 60) * HOUR}px)`;
      else el.style.height = `${Math.max(HOUR / 4, ((e0.getTime() - s0.getTime()) / 3_600_000) * HOUR + (dMin / 60) * HOUR)}px`;
      el.style.zIndex = "30";
      el.style.opacity = "0.9";
    };
    const up = () => {
      target.removeEventListener("pointermove", onMoveP);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
      el.style.transform = "";
      el.style.height = "";
      el.style.zIndex = "";
      el.style.opacity = "";
      if (!moved) {
        if (mode === "move") onEvent(e, el);
        return;
      }
      const shift = dMin * 60_000 + dDay * 86_400_000;
      if (mode === "move") onMove(e, new Date(s0.getTime() + shift), new Date(e0.getTime() + shift));
      else {
        const end = new Date(Math.max(s0.getTime() + 15 * 60_000, e0.getTime() + dMin * 60_000));
        onMove(e, s0, end);
      }
    };
    target.addEventListener("pointermove", onMoveP);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* day names */}
      <div className="flex border-b border-white/[0.07]">
        <div className="w-14 shrink-0" />
        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((d) => {
            const isToday = sameDay(d, now);
            return (
              <button key={dayKey(d)} type="button" onClick={() => onDay(d)} className="flex flex-col items-center gap-0.5 py-1.5 hover:bg-white/[0.03]">
                <span className={cx("text-[11px] font-semibold tracking-wide uppercase", isToday ? "text-accent" : "text-muted")}>{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
                <span className={cx("flex h-8 min-w-8 items-center justify-center rounded-full px-1 text-[17px] tabular-nums", isToday ? "bg-accent font-semibold text-black" : "text-ink")}>{d.getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>
      {/* all-day row */}
      <div className="flex border-b border-white/[0.07]">
        <div className="w-14 shrink-0 py-1 pr-2 text-right text-[10.5px] text-muted">all day</div>
        <div className="grid min-h-[30px] flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((d, i) => (
            <div key={dayKey(d)} onClick={() => onCreateAllDay(d)} className="flex min-w-0 cursor-pointer flex-col gap-[2px] border-l border-white/[0.06] p-[3px]">
              {allDay[i].slice(0, 3).map((e) => (
                <Chip key={e.id} e={e} onEvent={onEvent} day={dayKey(d)} />
              ))}
              {allDay[i].length > 3 && <span className="px-1 text-[11px] text-muted">{allDay[i].length - 3} more</span>}
            </div>
          ))}
        </div>
      </div>
      {/* hours */}
      <div ref={scroller} className="relative min-h-[420px] flex-1 overflow-y-auto overscroll-contain">
        <div className="flex" style={{ height: 24 * HOUR }}>
          <div className="relative w-14 shrink-0">
            {Array.from({ length: 23 }, (_, h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[10.5px] text-muted tabular-nums" style={{ top: (h + 1) * HOUR }}>
                {timeLabel(new Date(2024, 0, 1, h + 1))}
              </span>
            ))}
          </div>
          <div ref={cols} className="relative grid flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
            {/* hour lines */}
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: `repeating-linear-gradient(to bottom, rgba(255,255,255,0.06) 0 1px, transparent 1px ${HOUR}px)` }} />
            {days.map((d, di) => {
              const key = dayKey(d);
              const timed = (byDay.get(key) ?? []).filter((e) => !e.allDay);
              const dayStartMs = d.getTime();
              const spans = timed.map((e) => {
                const s = Math.max(dayStartMs, Date.parse(e.start));
                const en = Math.min(dayStartMs + 86_400_000, Date.parse(e.end));
                return { e, start: (s - dayStartMs) / 60_000, end: Math.max((s - dayStartMs) / 60_000 + 20, (en - dayStartMs) / 60_000) };
              });
              const lanes = layoutDay(spans.map((x) => ({ id: x.e.id, start: x.start, end: x.end })));
              const isToday = sameDay(d, now);
              return (
                <div
                  key={key}
                  className="relative border-l border-white/[0.06]"
                  onClick={(ev) => {
                    const r = ev.currentTarget.getBoundingClientRect();
                    const minutes = Math.floor(((ev.clientY - r.top) / HOUR) * 2) * 30;
                    const start = new Date(d);
                    start.setMinutes(minutes);
                    onCreate(start);
                  }}
                >
                  {spans.map(({ e, start, end }) => {
                    const l = lanes.get(e.id) ?? { lane: 0, lanes: 1 };
                    const color = COLOR_HEX[e.color];
                    const movable = canMove(e);
                    const short = end - start < 45;
                    return (
                      <div
                        key={e.id}
                        data-event
                        className={cx("absolute overflow-hidden rounded-[7px] text-left text-[11.5px] leading-tight shadow-[0_1px_3px_rgba(0,0,0,0.35)]", movable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer")}
                        style={{
                          top: (start / 60) * HOUR + 1,
                          height: Math.max(18, ((end - start) / 60) * HOUR - 2),
                          left: `calc(${(l.lane / l.lanes) * 100}% + 2px)`,
                          width: `calc(${100 / l.lanes}% - 4px)`,
                          background: `color-mix(in srgb, ${color} 26%, rgba(28,28,31,0.95))`,
                          boxShadow: `inset 3px 0 0 ${color}`,
                        }}
                        onClick={(ev) => ev.stopPropagation()}
                        onPointerDown={(ev) => (movable ? drag(e, di, "move", ev) : undefined)}
                        onPointerUp={(ev) => {
                          if (!movable) onEvent(e, ev.currentTarget);
                        }}
                      >
                        <div className={cx("px-2 py-1", short && "flex items-center gap-1.5 py-0.5")}>
                          <span className="block truncate font-semibold text-ink">{e.title}</span>
                          <span className="block truncate text-ink-2/80">
                            {timeLabel(new Date(e.start))}
                            {!short && e.location ? ` · ${e.location}` : ""}
                          </span>
                        </div>
                        {movable && e.source === "event" && !short && (
                          <span aria-hidden className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize" onPointerDown={(ev) => drag(e, di, "resize", ev)} />
                        )}
                      </div>
                    );
                  })}
                  {isToday && (
                    <div aria-hidden className="pointer-events-none absolute inset-x-0 z-20" style={{ top: (minutesInto(now) / 60) * HOUR }}>
                      <span className="absolute -top-[5px] -left-[5px] h-[10px] w-[10px] rounded-full bg-[#ff453a]" />
                      <span className="block h-[2px] bg-[#ff453a]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ list

function Agenda({ from, byDay, onEvent }: { from: Date; byDay: Map<string, CalEvent[]>; onEvent: (e: CalEvent, el: HTMLElement | null) => void }) {
  const days = Array.from({ length: 60 }, (_, i) => addDays(startOfDay(from), i)).filter((d) => (byDay.get(dayKey(d)) ?? []).length > 0);
  if (!days.length) return <p className="px-6 py-12 text-center text-[13.5px] text-muted">Nothing in the next two months.</p>;
  const today = new Date();
  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 @min-[40rem]:px-6">
      {days.map((d) => (
        <section key={dayKey(d)} className="flex gap-4 border-b border-white/[0.06] py-3">
          <div className="w-20 shrink-0 pt-0.5">
            <p className={cx("text-[22px] leading-none font-semibold tabular-nums", sameDay(d, today) ? "text-accent" : "text-ink")}>{d.getDate()}</p>
            <p className="mt-1 text-[11.5px] text-muted uppercase">{d.toLocaleDateString(undefined, { month: "short", weekday: "short" })}</p>
          </div>
          <ul className="flex min-w-0 flex-1 flex-col gap-1">
            {(byDay.get(dayKey(d)) ?? []).map((e) => (
              <li key={e.id}>
                <button type="button" onClick={(ev) => onEvent(e, ev.currentTarget)} className="flex w-full items-center gap-3 rounded-[10px] px-2 py-1.5 text-left hover:bg-white/[0.05]">
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLOR_HEX[e.color] }} />
                  <span className="w-28 shrink-0 text-[12.5px] text-muted tabular-nums">{e.allDay ? "All day" : `${timeLabel(new Date(e.start))} – ${timeLabel(new Date(e.end))}`}</span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{e.title}</span>
                  {e.client?.name && <span className="hidden shrink-0 text-[12px] text-muted @min-[40rem]:inline">{e.client.name}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
