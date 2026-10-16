import Link from "next/link";
import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import { requireRole, displayName } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { VIDEO_STATUSES, FORMAT_LABEL } from "@/lib/workflow";
import { Avatar, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { formatCalendarDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const viewer = await requireRole("admin", "editor");
  const supabase = await createClient();
  const { data: videos } = await supabase
    .from("videos")
    .select(
      "id, title, status, format, due_on, updated_at, client:clients(id, name), editor:profiles!videos_editor_id_fkey(full_name, email)",
    )
    .order("updated_at", { ascending: false });

  const all = videos ?? [];
  const active = all.filter((v) => v.status !== "delivered");

  return (
    <>
      <PageHeader
        eyebrow={viewer.role === "admin" ? "Every client" : "Your clients"}
        title="Pipeline"
        description="Where every video stands, from script to delivery."
        actions={
          viewer.role === "admin" ? (
            <LinkButton href="/clients" variant="primary">
              New video
            </LinkButton>
          ) : null
        }
      />
      {all.length === 0 ? (
        <EmptyState title="No videos yet">
          {viewer.role === "admin"
            ? "Create a client, then add their first video."
            : "When the studio manager assigns you a client, their videos show up here."}
        </EmptyState>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8">
          <div className="grid auto-cols-[248px] grid-flow-col gap-3">
            {VIDEO_STATUSES.map((s) => {
              const items = (s.value === "delivered" ? all : active).filter((v) => v.status === s.value);
              return (
                <section key={s.value} aria-label={s.label} className="flex flex-col gap-2">
                  <h2 className="flex items-center justify-between px-1 text-[13px] font-medium text-ink-2">
                    {s.label}
                    <span className="text-muted">{items.length}</span>
                  </h2>
                  <div className="flex min-h-24 flex-col gap-2 rounded-md bg-surface-2/60 p-2">
                    {items.map((v) => {
                      const editor = v.editor ? displayName(v.editor) : null;
                      return (
                        <Link
                          key={v.id}
                          href={`/videos/${v.id}`}
                          className="rounded-md border border-line bg-surface p-3 transition-colors hover:border-line-strong"
                        >
                          <div className="text-xs text-muted">{v.client?.name}</div>
                          <div className="mt-0.5 text-sm font-medium text-ink">{v.title}</div>
                          <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-muted">
                            <span>{FORMAT_LABEL[v.format]}</span>
                            <span className="flex items-center gap-2">
                              {v.due_on && (
                                <span className="inline-flex items-center gap-1">
                                  <CalendarClock size={12} aria-hidden />
                                  {formatCalendarDate(v.due_on)}
                                </span>
                              )}
                              {editor && (
                                <span title={`Editor: ${editor}`}>
                                  <Avatar name={editor} size={20} />
                                </span>
                              )}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
