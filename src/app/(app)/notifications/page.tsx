import Link from "next/link";
import type { Metadata } from "next";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button, EmptyState, PageHeader, cx } from "@/components/ui";
import { markNotificationsRead } from "@/app/actions/workflow";
import { LocalDate } from "@/components/local-date";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const viewer = await getViewer();
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("notifications")
    .select("id, title, body, kind, read_at, created_at, video_id")
    .order("created_at", { ascending: false })
    .limit(100);
  const unread = (items ?? []).filter((n) => !n.read_at).length;

  const hrefFor = (n: { video_id: string | null; kind: string }) => {
    if (!n.video_id) return null;
    if (viewer.role === "client") return `/review/${n.video_id}`;
    if (viewer.role === "videographer") return `/shoots/${n.video_id}`;
    return ["comment", "version_ready", "version_sent", "approved", "changes_requested"].includes(n.kind)
      ? `/review/${n.video_id}`
      : `/videos/${n.video_id}`;
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        description="New versions, comments, approvals and footage arrivals."
        actions={
          unread > 0 ? (
            <form action={markNotificationsRead}>
              <Button type="submit" variant="secondary">
                Mark all as read
              </Button>
            </form>
          ) : null
        }
      />
      {!items?.length ? (
        <EmptyState title="You're all caught up" />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">
          {items.map((n) => {
            const href = hrefFor(n);
            const inner = (
              <div className="flex gap-3 px-5 py-3.5">
                <span
                  className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-accent")}
                  aria-label={n.read_at ? undefined : "Unread"}
                />
                <div className="min-w-0 flex-1">
                  <div className={cx("text-sm", n.read_at ? "text-ink-2" : "font-medium text-ink")}>{n.title}</div>
                  {n.body && <div className="mt-0.5 line-clamp-2 text-[13px] text-muted">{n.body}</div>}
                </div>
                <span className="shrink-0 text-xs text-muted">
                  <LocalDate value={n.created_at} preset="short" />
                </span>
              </div>
            );
            return (
              <li key={n.id}>
                {href ? (
                  <Link href={href} className="block hover:bg-surface-2">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
