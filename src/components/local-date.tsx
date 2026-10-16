"use client";

import { useSyncExternalStore } from "react";
import { formatDate, type DatePreset } from "@/lib/dates";


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
