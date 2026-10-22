// The calendar's events: what the person put in it, plus what the studio already knows, each
// in its own calendar: shoots, posting dates, deadlines, invoices due. Shared by the Calendar app
// (browser) and the server (which reads them, the feed for Google and Apple Calendar).

export const EVENT_COLORS = ["gold", "blue", "green", "red", "purple", "orange", "pink", "graphite"] as const;
export type EventColor = (typeof EVENT_COLORS)[number];

export const COLOR_HEX: Record<EventColor, string> = {
  gold: "#f6d43a",
  blue: "#0a84ff",
  green: "#30d158",
  red: "#ff453a",
  purple: "#bf5af2",
  orange: "#ff9f0a",
  pink: "#ff375f",
  graphite: "#8e8e93",
};

export type CalendarSource = "event" | "shoot" | "post" | "due" | "invoice";

export const SOURCES: { key: CalendarSource; label: string; color: EventColor }[] = [
  { key: "event", label: "My events", color: "blue" },
  { key: "shoot", label: "Shoots", color: "orange" },
  { key: "post", label: "Posting dates", color: "gold" },
  { key: "due", label: "Deadlines", color: "red" },
  { key: "invoice", label: "Invoices due", color: "graphite" },
];

export type CalEvent = {
  // "ev:<id>", "shoot:<id>", "post:<videoId>", "due:<videoId>", "inv:<invoiceId>"
  id: string;
  source: CalendarSource;
  title: string;
  // ISO times. All-day events run from the first day's midnight (UTC) to the day after the last.
  start: string;
  end: string;
  allDay: boolean;
  color: EventColor;
  location: string | null;
  description: string | null;
  // Where it leads in Magik OS.
  href: string | null;
  // The person can move or edit it.
  editable: boolean;
  owner: string | null;
  attendees: { id: string; name: string }[];
  client: { id: string; name: string } | null;
  videoId: string | null;
  platforms?: string[];
};

export type Person = { id: string; name: string; role: string };

export const POST_PLATFORMS = ["Instagram", "TikTok", "YouTube", "Facebook", "LinkedIn", "X"] as const;

// A calendar date (YYYY-MM-DD) as the all-day instant it starts at.
export const dayStart = (date: string) => `${date}T00:00:00.000Z`;
export const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
