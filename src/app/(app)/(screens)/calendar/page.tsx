import type { Metadata } from "next";
import { getViewer } from "@/lib/auth";
import { calendarEvents, invitable } from "@/lib/calendar-data";
import { createClient } from "@/lib/supabase/server";
import { WindowPage } from "@/components/desktop/window-page";
import { CalendarApp } from "@/components/calendar/calendar-app";

export const metadata: Metadata = { title: "Calendar" };

const DAY = 86_400_000;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ date?: string; event?: string; new?: string }> }) {
  const viewer = await getViewer();
  const { date, event, new: isNew } = await searchParams;
  const focus = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  // The month on screen first, as the studio counts days; a little more around it, whatever the
  // viewer's own time zone.
  const day = focus ?? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
  const month = day.slice(0, 7);
  const first = Date.parse(`${month}-01T00:00:00Z`);
  const supabase = await createClient();
  const [events, people, { data: clients }] = await Promise.all([
    calendarEvents(viewer, new Date(first - 8 * DAY).toISOString(), new Date(first + 50 * DAY).toISOString()),
    invitable(viewer),
    viewer.role === "client" ? Promise.resolve({ data: [] }) : supabase.from("clients").select("id, name").order("name"),
  ]);
  return (
    <WindowPage>
      <CalendarApp
        initial={{ month, events }}
        role={viewer.role}
        people={people}
        clients={clients ?? []}
        weekStart={viewer.preferences.weekStart ?? 1}
        view={viewer.preferences.calendarView ?? "month"}
        focusDate={focus}
        focusEvent={event && /^[0-9a-f-]{36}$/i.test(event) ? event : null}
        startNew={isNew === "1"}
      />
    </WindowPage>
  );
}
