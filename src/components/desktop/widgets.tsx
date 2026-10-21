"use client";

import { cx } from "@/components/ui";
import { useNow } from "@/components/use-now";
import type { DesktopData } from "@/lib/desktop";

// Desktop widgets (macOS 14+): the date and a greeting, the numbers that matter for the role,
// and the latest notifications. Each opens the app it's about.
export function Widgets({ name, data, onOpen }: { name: string; data: DesktopData; onOpen: (href: string) => void }) {
  const now = useNow(60_000);
  const hour = now?.getHours() ?? 12;
  const greeting = hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = name.split(/\s+/)[0];

  return (
    <aside aria-label="Widgets" className="animate-rise-in pointer-events-auto flex w-[300px] flex-col gap-3.5">
      <section className="glass-bar rounded-[24px] px-5 py-4 text-white">
        <p className="on-wallpaper text-[12px] font-semibold tracking-wide text-accent uppercase">
          {now ? now.toLocaleDateString(undefined, { weekday: "long" }) : " "}
        </p>
        <p className="on-wallpaper font-display text-[34px] leading-tight font-semibold tracking-tight">
          {now ? now.toLocaleDateString(undefined, { month: "long", day: "numeric" }) : " "}
        </p>
        <p className="on-wallpaper mt-1 text-[13.5px] text-white/75">
          {greeting}, {first}.
        </p>
      </section>

      {data.stats.length > 0 && (
        <section className="glass-bar rounded-[24px] p-3 text-white">
          <h2 className="px-2 pt-1 pb-2 text-[12px] font-semibold tracking-wide text-white/60 uppercase">{data.statsTitle}</h2>
          <div className="grid grid-cols-2 gap-2">
            {data.stats.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => onOpen(s.href)}
                className="rounded-[16px] bg-white/[0.07] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.13]"
              >
                <span
                  className={cx(
                    "block font-display text-[26px] leading-none font-semibold tabular-nums",
                    s.tone === "accent" ? "text-accent" : s.tone === "success" ? "text-success" : "text-white",
                  )}
                >
                  {s.value}
                </span>
                <span className="mt-1 block truncate text-[12px] text-white/70">{s.label}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="glass-bar rounded-[24px] p-3 text-white">
        <div className="flex items-center justify-between px-2 pt-1 pb-1.5">
          <h2 className="text-[12px] font-semibold tracking-wide text-white/60 uppercase">Notifications</h2>
          {data.unread > 0 && <span className="text-[12px] font-semibold text-accent">{data.unread} new</span>}
        </div>
        {data.feed.length === 0 ? (
          <p className="px-2 pb-2 text-[13px] text-white/60">You&apos;re all caught up.</p>
        ) : (
          <ul className="flex flex-col">
            {data.feed.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onOpen(n.href ?? "/notifications")}
                  className="flex w-full gap-2.5 rounded-[14px] px-2 py-2 text-left transition-colors hover:bg-white/[0.08]"
                >
                  <span className={cx("mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full", n.unread ? "bg-accent" : "bg-white/15")} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">{n.title}</span>
                    {n.body && <span className="block truncate text-[12px] text-white/60">{n.body}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
