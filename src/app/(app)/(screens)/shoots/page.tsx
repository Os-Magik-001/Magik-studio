import Link from "next/link";
import type { Metadata } from "next";
import { requireRole, displayName } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, PageHeader } from "@/components/ui";
import { ShootList, type ShootRow } from "./shoot-list";
import { WindowPage } from "@/components/desktop/window-page";

export const metadata: Metadata = { title: "Shoots" };

export default async function ShootsPage() {
  const viewer = await requireRole("videographer", "admin");
  const supabase = await createClient();
  const since = startOfYesterday();
  const [{ data: shoots }, { data: unscheduled }] = await Promise.all([
    supabase
      .from("shoots")
      .select(
        "id, starts_at, ends_at, location, needs, video:videos(id, title, status, client:clients(name), videographer:profiles!videos_videographer_id_fkey(full_name, email), scripts(status))",
      )
      .gte("starts_at", since)
      .order("starts_at"),
    supabase.from("videos").select("id, title, client:clients(name), shoots(id)").eq("status", "shoot"),
  ]);

  const waiting = (unscheduled ?? []).filter((v) => v.shoots.length === 0);

  const rows: ShootRow[] = (shoots ?? []).flatMap((s) =>
    s.video
      ? [
          {
            id: s.id,
            startsAt: s.starts_at,
            endsAt: s.ends_at,
            location: s.location,
            needs: s.needs,
            videoId: s.video.id,
            videoTitle: s.video.title,
            clientName: s.video.client?.name ?? "",
            scriptApproved: s.video.scripts?.status === "approved",
            videographer: viewer.role === "admin" && s.video.videographer ? displayName(s.video.videographer) : null,
          },
        ]
      : [],
  );

  return (
    <WindowPage>
      <PageHeader
        title="Shoot calendar"
        description={
          viewer.role === "admin"
            ? "Every upcoming shoot across the studio."
            : "Your upcoming shoots, with the approved script and shot list for each."
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="No upcoming shoots">New shoots appear here as soon as they&apos;re scheduled.</EmptyState>
      ) : (
        <ShootList shoots={rows} />
      )}
      {viewer.role === "admin" && waiting.length > 0 && (
        <section className="mt-10">
          <h2 className="kicker mb-3">Ready to shoot, not scheduled</h2>
          <ul className="flex flex-wrap gap-2">
            {waiting.map((v) => (
              <li key={v.id}>
                <Link href={`/videos/${v.id}`} className="inline-flex rounded-xl frost px-3 py-2 text-[13px] hover:border-line-strong">
                  {v.client?.name} · {v.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </WindowPage>
  );
}

// Keep yesterday's shoots visible so a late footage drop is easy to find.
function startOfYesterday() {
  return new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
}
