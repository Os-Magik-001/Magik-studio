import type { Metadata } from "next";
import { getViewer } from "@/lib/auth";
import { WindowPage } from "@/components/desktop/window-page";
import { SettingsShell } from "@/components/settings/settings-shell";
import { CalendarSettings } from "./calendar-settings";

export const metadata: Metadata = { title: "Calendar settings" };

export default async function CalendarSettingsPage() {
  const viewer = await getViewer();
  return (
    <WindowPage>
      <SettingsShell role={viewer.role} active="calendar" title="Calendar" description="How your calendar looks, and how to see it in Google Calendar or on your iPhone.">
        <CalendarSettings weekStart={viewer.preferences.weekStart ?? 1} view={viewer.preferences.calendarView ?? "month"} />
      </SettingsShell>
    </WindowPage>
  );
}
