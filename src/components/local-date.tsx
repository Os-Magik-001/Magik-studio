"use client";

import { useSyncExternalStore } from "react";

const PRESETS = {
  date: { dateStyle: "medium" },
  datetime: { dateStyle: "medium", timeStyle: "short" },
  full: { dateStyle: "full", timeStyle: "short" },
  time: { hour: "numeric", minute: "2-digit" },
  day: { weekday: "long", month: "long", day: "numeric" },
  short: { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  dayMonth: { month: "short", day: "numeric" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DatePreset = keyof typeof PRESETS;

const noop = () => () => {};

// False during SSR and hydration, true afterwards: lets dates switch to the
// viewer's locale and timezone without a hydration mismatch.
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

export function formatDate(value: string | Date, preset: DatePreset, local: boolean) {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(local ? undefined : "en-US", {
    ...PRESETS[preset],
    ...(local ? {} : { timeZone: "UTC" }),
  }).format(d);
}

// For calendar dates without a time (e.g. a due date): never shift across timezones.
export function formatCalendarDate(isoDate: string, preset: DatePreset = "dayMonth") {
  return new Intl.DateTimeFormat("en-US", { ...PRESETS[preset], timeZone: "UTC" }).format(
    new Date(isoDate + "T00:00:00Z"),
  );
}

export function LocalDate({
  value,
  preset = "datetime",
  prefix,
}: {
  value: string;
  preset?: DatePreset;
  prefix?: string;
}) {
  const local = useHydrated();
  return (
    <time dateTime={value}>
      {prefix}
      {formatDate(value, preset, local)}
    </time>
  );
}
