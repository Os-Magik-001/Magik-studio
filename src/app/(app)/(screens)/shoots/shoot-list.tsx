"use client";

import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui";
import { useHydrated } from "@/components/local-date";
import { formatDate } from "@/lib/dates";

export type ShootRow = {
  id: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  needs: string | null;
  videoId: string;
  videoTitle: string;
  clientName: string;
  scriptApproved: boolean;
  videographer: string | null;
};

// Groups by the viewer's own calendar day, so a shoot never lands on the wrong date.
export function ShootList({ shoots }: { shoots: ShootRow[] }) {
  const local = useHydrated();
  const byDay = new Map<string, ShootRow[]>();
  for (const s of shoots) {
    const day = formatDate(s.startsAt, "day", local);
    byDay.set(day, [...(byDay.get(day) ?? []), s]);
  }

  return (
    <div className="flex flex-col gap-8">
      {[...byDay.entries()].map(([day, items]) => (
        <section key={day}>
          <h2 className="mb-3 font-serif text-xl text-ink">{day}</h2>
          <ul className="flex flex-col gap-3">
            {items.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/shoots/${s.videoId}`}
                  className="flex flex-col gap-2 rounded-xl frost p-4 transition-colors hover:border-line-strong @min-[40rem]:flex-row @min-[40rem]:items-center @min-[40rem]:gap-6"
                >
                  <div className="flex w-40 shrink-0 items-center gap-1.5 text-sm font-medium text-ink">
                    <Clock size={14} className="text-muted" aria-hidden />
                    {formatDate(s.startsAt, "time", local)}
                    {s.endsAt && `–${formatDate(s.endsAt, "time", local)}`}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted">{s.clientName}</div>
                    <div className="font-medium text-ink">{s.videoTitle}</div>
                    {s.location && (
                      <div className="mt-1 flex items-center gap-1 text-[13px] text-ink-2">
                        <MapPin size={12} aria-hidden /> {s.location}
                      </div>
                    )}
                    {s.needs && <div className="mt-1 text-[13px] text-muted">Bring: {s.needs}</div>}
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-1 @min-[40rem]:items-end">
                    {s.scriptApproved ? (
                      <Badge tone="success">Script approved</Badge>
                    ) : (
                      <Badge tone="warning">Script not approved yet</Badge>
                    )}
                    {s.videographer && <span className="text-xs text-muted">{s.videographer}</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
