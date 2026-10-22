import type { CalEvent } from "@/lib/calendar";

// Calendar arithmetic in the viewer's own time zone. A "day" is a local calendar date
// (YYYY-MM-DD); all-day events are dates, the same everywhere.

export const pad = (n: number) => String(n).padStart(2, "0");

export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Local midnight of a day key.
export const fromKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const addMonths = (d: Date, n: number) => {
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(d.getDate(), last));
  return x;
};

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const startOfWeek = (d: Date, weekStart: 0 | 1) => {
  const x = startOfDay(d);
  const back = (x.getDay() - weekStart + 7) % 7;
  return addDays(x, -back);
};

// The six weeks a month grid shows.
export const monthGridStart = (d: Date, weekStart: 0 | 1) => startOfWeek(new Date(d.getFullYear(), d.getMonth(), 1), weekStart);

export const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b);

// The local days an event covers, as day keys (all-day: its dates; timed: the days it touches).
export function eventDays(e: CalEvent): string[] {
  const days: string[] = [];
  if (e.allDay) {
    const start = fromKey(e.start.slice(0, 10));
    const end = fromKey(e.end.slice(0, 10));
    for (let d = start; d < end || days.length === 0; d = addDays(d, 1)) {
      days.push(dayKey(d));
      if (days.length > 60) break;
    }
    return days;
  }
  const s = new Date(e.start);
  const end = new Date(e.end);
  // An event ending at midnight doesn't touch the next day.
  const last = new Date(Math.max(s.getTime(), end.getTime() - 1));
  for (let d = startOfDay(s); d <= last; d = addDays(d, 1)) {
    days.push(dayKey(d));
    if (days.length > 60) break;
  }
  return days;
}

export const minutesInto = (d: Date) => d.getHours() * 60 + d.getMinutes();

export function timeLabel(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function rangeLabel(e: CalEvent) {
  if (e.allDay) {
    const s = fromKey(e.start.slice(0, 10));
    const last = addDays(fromKey(e.end.slice(0, 10)), -1);
    const fmt: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" };
    return sameDay(s, last) || last < s ? `${s.toLocaleDateString(undefined, fmt)} · all day` : `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${last.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · all day`;
  }
  const s = new Date(e.start);
  const end = new Date(e.end);
  const day = s.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  return sameDay(s, end) ? `${day} · ${timeLabel(s)} – ${timeLabel(end)}` : `${day} ${timeLabel(s)} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${timeLabel(end)}`;
}

// A value for <input type="datetime-local"> / "date", in local time.
export const localInput = (d: Date) => `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Overlapping timed events of one day, side by side: each gets a lane and the number of lanes
// in its cluster.
export function layoutDay(events: { id: string; start: number; end: number }[]) {
  const sorted = [...events].sort((a, b) => a.start - b.start || b.end - a.end);
  const out = new Map<string, { lane: number; lanes: number }>();
  let cluster: { id: string; start: number; end: number; lane: number }[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    for (const c of cluster) out.set(c.id, { lane: c.lane, lanes });
    cluster = [];
  };
  for (const e of sorted) {
    if (cluster.length && e.start >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    const used = new Set(cluster.filter((c) => c.end > e.start).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    cluster.push({ ...e, lane });
    clusterEnd = Math.max(clusterEnd, e.end);
  }
  flush();
  return out;
}
