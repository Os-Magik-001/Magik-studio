"use client";

import { useNow } from "@/components/use-now";

// "12 min ago", in the viewer's own time; empty until hydrated.
export function Ago({ at }: { at: string }) {
  const now = useNow(30_000);
  if (!now) return null;
  const s = Math.max(0, (now.getTime() - new Date(at).getTime()) / 1000);
  if (s < 60) return <>now</>;
  if (s < 3600) return <>{Math.floor(s / 60)} min</>;
  if (s < 86_400) return <>{Math.floor(s / 3600)} h</>;
  if (s < 7 * 86_400) return <>{Math.floor(s / 86_400)} d</>;
  return <>{new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</>;
}

// A Today entry's time: the hour today, the day otherwise.
export function TodayTime({ at, allDay }: { at: string; allDay: boolean }) {
  const now = useNow(60_000);
  if (!now) return null;
  const d = new Date(at);
  const sameDay = d.toDateString() === now.toDateString();
  if (allDay) return <>{sameDay ? "Today" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</>;
  if (sameDay) return <>{d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</>;
  return <>{d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</>;
}
