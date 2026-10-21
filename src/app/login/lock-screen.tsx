"use client";

import { useEffect } from "react";
import { useNow } from "@/components/use-now";

// The lock screen's date and big time, in the person's own format (no AM/PM, as on a Mac).
export function LockClock() {
  const now = useNow(5_000);
  const time = now
    ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" })
        .formatToParts(now)
        .filter((p) => p.type !== "dayPeriod")
        .map((p) => p.value)
        .join("")
        .trim()
    : "";
  return (
    <div className="on-wallpaper text-center select-none" aria-hidden={!now}>
      <p className="text-[19px] font-semibold text-white/85">
        {now ? now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : " "}
      </p>
      <p className="font-display text-[96px] leading-none font-bold tracking-[-0.03em] text-white/90 sm:text-[120px]">{time || " "}</p>
    </div>
  );
}

// A session that ran out inside a desktop window: sign in on the whole screen, not in the window.
export function LeaveWindow() {
  useEffect(() => {
    if (window.top && window.top !== window.self) window.top.location.href = "/login";
  }, []);
  return null;
}
