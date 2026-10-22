"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, CalendarDays, Clock, MapPin, Pencil, Trash2, Users, X } from "lucide-react";
import { COLOR_HEX, EVENT_COLORS, POST_PLATFORMS, SOURCES, type CalEvent, type EventColor, type Person } from "@/lib/calendar";
import { Button, Input, Textarea, cx } from "@/components/ui";
import { Switch } from "@/components/switch";
import { deleteEvent, saveEvent, setPostDate } from "@/app/actions/calendar";
import { addDays, dayKey, fromKey, localInput, rangeLabel } from "@/components/calendar/dates";

// The event card that opens on a click, and the editor for a new or existing event.

export type Draft = {
  id?: string;
  title: string;
  allDay: boolean;
  // Local datetime-local strings, or dates for all-day events.
  start: string;
  end: string;
  location: string;
  description: string;
  color: EventColor;
  attendees: string[];
  clientId: string | null;
};

export const draftAt = (start: Date, minutes = 60, allDay = false): Draft => ({
  title: "",
  allDay,
  start: allDay ? dayKey(start) : localInput(start),
  end: allDay ? dayKey(start) : localInput(new Date(start.getTime() + minutes * 60_000)),
  location: "",
  description: "",
  color: "blue",
  attendees: [],
  clientId: null,
});

export function draftOf(e: CalEvent): Draft {
  return {
    id: e.id.replace(/^ev:/, ""),
    title: e.title,
    allDay: e.allDay,
    start: e.allDay ? e.start.slice(0, 10) : localInput(new Date(e.start)),
    end: e.allDay ? dayKey(addDays(fromKey(e.end.slice(0, 10)), -1)) : localInput(new Date(e.end)),
    location: e.location ?? "",
    description: e.description ?? "",
    color: e.color,
    attendees: e.attendees.map((a) => a.id),
    clientId: e.client?.id ?? null,
  };
}

// A card over the window, near what was clicked.
export function EventCard({
  event,
  anchor,
  onClose,
  onEdit,
  onChanged,
  onOpen,
  canEditPosts,
}: {
  event: CalEvent;
  anchor: DOMRect | null;
  onClose: () => void;
  onEdit: () => void;
  onChanged: () => void;
  onOpen: (href: string) => void;
  canEditPosts: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [postAt, setPostAt] = useState(localInput(new Date(event.start)));
  const [platforms, setPlatforms] = useState<string[]>(event.platforms ?? []);

  useEffect(() => {
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const id = setTimeout(() => window.addEventListener("pointerdown", onDown, true), 0);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(id);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const W = 340;
  const left = anchor ? Math.max(12, Math.min(anchor.right + 10 + W > window.innerWidth ? anchor.left - W - 10 : anchor.right + 10, window.innerWidth - W - 12)) : window.innerWidth / 2 - W / 2;
  const top = anchor ? Math.max(56, Math.min(anchor.top - 10, window.innerHeight - 380)) : 140;
  const source = SOURCES.find((s) => s.key === event.source);

  return createPortal(
    <div ref={ref} role="dialog" aria-label={event.title} className="glass-pop animate-pop-in fixed z-[9500] w-[340px] rounded-[18px] p-4 text-ink" style={{ left, top }}>
      <div className="flex items-start gap-3">
        <span className="mt-1.5 h-3 w-3 shrink-0 rounded-[4px]" style={{ background: COLOR_HEX[event.color] }} aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] leading-snug font-semibold">{event.title}</h3>
          <p className="mt-1 flex items-start gap-1.5 text-[13px] text-ink-2">
            <Clock size={14} className="mt-[2px] shrink-0 text-muted" aria-hidden />
            {rangeLabel(event)}
          </p>
          {event.location && (
            <p className="mt-1 flex items-start gap-1.5 text-[13px] text-ink-2">
              <MapPin size={14} className="mt-[2px] shrink-0 text-muted" aria-hidden />
              {event.location}
            </p>
          )}
          {(event.owner || event.attendees.length > 0) && (
            <p className="mt-1 flex items-start gap-1.5 text-[13px] text-ink-2">
              <Users size={14} className="mt-[2px] shrink-0 text-muted" aria-hidden />
              {[event.owner, ...event.attendees.map((a) => a.name)].filter(Boolean).join(", ")}
            </p>
          )}
          {event.client?.name && <p className="mt-1 text-[12.5px] text-muted">{event.client.name}</p>}
          {event.description && <p className="mt-2 text-[13px] whitespace-pre-line text-ink-2">{event.description}</p>}
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
            <CalendarDays size={13} aria-hidden /> {source?.label ?? "Calendar"}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="-mt-1 -mr-1 flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-ink">
          <X size={15} aria-hidden />
        </button>
      </div>

      {event.source === "post" && canEditPosts && (
        <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3">
          <label className="text-[12.5px] font-medium text-ink-2" htmlFor="post-at">
            Posting date
          </label>
          <Input id="post-at" type="datetime-local" value={postAt} onChange={(e) => setPostAt(e.target.value)} />
          <div className="flex flex-wrap gap-1.5">
            {POST_PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={platforms.includes(p)}
                onClick={() => setPlatforms((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]))}
                className={cx("h-7 rounded-full px-2.5 text-[12px] font-medium", platforms.includes(p) ? "bg-accent text-black" : "bg-white/[0.08] text-ink-2 hover:bg-white/[0.13]")}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await setPostDate(event.videoId!, new Date(postAt).toISOString(), platforms);
                  if (!r.ok) setError(r.error);
                  else onChanged();
                })
              }
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await setPostDate(event.videoId!, null);
                  if (!r.ok) setError(r.error);
                  else onChanged();
                })
              }
            >
              Remove the date
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {event.href && (
          <Button size="sm" variant="secondary" onClick={() => onOpen(event.href!)}>
            Open <ArrowUpRight size={13} aria-hidden />
          </Button>
        )}
        {event.source === "event" && event.editable && (
          <>
            <Button size="sm" variant="secondary" onClick={onEdit}>
              <Pencil size={13} aria-hidden /> Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-danger hover:bg-danger-soft"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await deleteEvent(event.id.replace(/^ev:/, ""));
                  if (!r.ok) setError(r.error);
                  else onChanged();
                })
              }
            >
              <Trash2 size={13} aria-hidden /> Delete
            </Button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

// The editor: a sheet over the calendar.
export function EventEditor({
  draft: initial,
  people,
  clients,
  isClient,
  onClose,
  onSaved,
}: {
  draft: Draft;
  people: Person[];
  clients: { id: string; name: string }[];
  isClient: boolean;
  onClose: () => void;
  onSaved: (date: string) => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const title = useRef<HTMLInputElement>(null);
  useEffect(() => title.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  const save = () => {
    setError(null);
    let start: string;
    let end: string;
    if (d.allDay) {
      if (!d.start) return setError("Pick a day.");
      const last = d.end && d.end >= d.start ? d.end : d.start;
      start = `${d.start}T00:00:00.000Z`;
      end = `${dayKey(addDays(fromKey(last), 1))}T00:00:00.000Z`;
    } else {
      const s = new Date(d.start);
      const e = new Date(d.end);
      if (!Number.isFinite(s.getTime())) return setError("Pick when it starts.");
      start = s.toISOString();
      end = (Number.isFinite(e.getTime()) && e >= s ? e : new Date(s.getTime() + 3600_000)).toISOString();
    }
    startTransition(async () => {
      const r = await saveEvent({ id: d.id, title: d.title, start, end, allDay: d.allDay, location: d.location, description: d.description, color: d.color, attendees: d.attendees, clientId: d.clientId });
      if (!r.ok) return setError(r.error);
      onSaved(d.allDay ? d.start : dayKey(new Date(d.start)));
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[9400] flex items-start justify-center bg-black/40 px-4 pt-[10vh]" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={d.id ? "Edit event" : "New event"} className="glass-pop animate-pop-in w-full max-w-[520px] rounded-[22px] p-5 text-ink">
        <div className="flex items-center gap-3">
          <span className="h-3.5 w-3.5 rounded-[5px]" style={{ background: COLOR_HEX[d.color] }} aria-hidden />
          <input
            ref={title}
            value={d.title}
            onChange={(e) => set({ title: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="Add a title"
            aria-label="Title"
            maxLength={200}
            className="min-w-0 flex-1 bg-transparent text-[20px] font-semibold text-ink placeholder:text-muted/70 focus:outline-none"
          />
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-ink">
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[13.5px] text-ink-2">All day</span>
            <Switch
              label="All day"
              checked={d.allDay}
              onChange={(allDay) => {
                if (allDay) set({ allDay, start: d.start.slice(0, 10), end: d.end.slice(0, 10) });
                else {
                  const s = fromKey(d.start.slice(0, 10));
                  s.setHours(9);
                  set({ allDay, start: localInput(s), end: localInput(new Date(s.getTime() + 3600_000)) });
                }
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[12px] text-muted">
              Starts
              <Input
                type={d.allDay ? "date" : "datetime-local"}
                value={d.start}
                onChange={(e) => {
                  const v = e.target.value;
                  if (d.allDay) set({ start: v, end: d.end < v ? v : d.end });
                  else {
                    // Keep the length when the start moves.
                    const len = Date.parse(d.end) - Date.parse(d.start);
                    const s = new Date(v);
                    set({ start: v, end: Number.isFinite(len) && len > 0 && Number.isFinite(s.getTime()) ? localInput(new Date(s.getTime() + len)) : d.end });
                  }
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-muted">
              Ends
              <Input type={d.allDay ? "date" : "datetime-local"} value={d.end} min={d.allDay ? d.start : undefined} onChange={(e) => set({ end: e.target.value })} />
            </label>
          </div>
          <Input value={d.location} onChange={(e) => set({ location: e.target.value })} placeholder="Add a place or a video call link" aria-label="Place" maxLength={300} />
          <Textarea value={d.description} onChange={(e) => set({ description: e.target.value })} rows={3} placeholder="Add a note" aria-label="Note" maxLength={4000} />

          <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Color">
            {EVENT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={d.color === c}
                aria-label={c}
                onClick={() => set({ color: c })}
                className={cx("h-6 w-6 rounded-full transition-transform", d.color === c ? "scale-110 shadow-[0_0_0_2px_rgba(28,28,31,1),0_0_0_4px_rgba(255,255,255,0.8)]" : "hover:scale-110")}
                style={{ background: COLOR_HEX[c] }}
              />
            ))}
          </div>

          {!isClient && people.length > 0 && (
            <details className="rounded-[12px] bg-white/[0.04] px-3 py-2" open={d.attendees.length > 0}>
              <summary className="cursor-pointer text-[13px] text-ink-2">
                Invite the team{d.attendees.length ? ` · ${d.attendees.length}` : ""}
              </summary>
              <div className="mt-2 grid max-h-40 grid-cols-2 gap-1 overflow-y-auto">
                {people.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 rounded-[8px] px-1.5 py-1 text-[13px] text-ink hover:bg-white/[0.05]">
                    <input
                      type="checkbox"
                      checked={d.attendees.includes(p.id)}
                      onChange={(e) => set({ attendees: e.target.checked ? [...d.attendees, p.id] : d.attendees.filter((a) => a !== p.id) })}
                      className="accent-[var(--accent)]"
                    />
                    <span className="truncate">{p.name}</span>
                  </label>
                ))}
              </div>
            </details>
          )}

          {isClient ? (
            <label className="flex items-center justify-between gap-3 text-[13.5px] text-ink-2">
              Share with the studio
              <Switch label="Share with the studio" checked={!!d.clientId} onChange={(on) => set({ clientId: on ? "self" : null })} />
            </label>
          ) : (
            clients.length > 0 && (
              <label className="flex flex-col gap-1 text-[12px] text-muted">
                Share with a client (they see it in their calendar)
                <select
                  value={d.clientId ?? ""}
                  onChange={(e) => set({ clientId: e.target.value || null })}
                  className="h-9 rounded-[10px] border border-white/10 bg-white/[0.055] px-3 text-[14px] text-ink"
                >
                  <option value="">Only the people invited</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )
          )}
        </div>

        {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
