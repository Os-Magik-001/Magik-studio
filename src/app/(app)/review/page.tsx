import Link from "next/link";
import type { Metadata } from "next";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { VideoStatusBadge } from "@/components/status";
import { FORMAT_LABEL } from "@/lib/workflow";

export const metadata: Metadata = { title: "Your videos" };

export default async function ClientHome() {
  const viewer = await getViewer();
  const supabase = await createClient();
  const [{ data: videos }, { data: client }] = await Promise.all([
    supabase
      .from("videos")
      .select("id, title, status, format, updated_at, scripts(status), versions(id, status, number)")
      .order("updated_at", { ascending: false }),
    viewer.clientId
      ? supabase.from("clients").select("name").eq("id", viewer.clientId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const rows = (videos ?? []).map((v) => {
    const scriptWaiting = v.scripts?.status === "client_review";
    const versionWaiting = v.versions.find((x) => x.status === "client_review");
    return { ...v, needsYou: scriptWaiting || !!versionWaiting, scriptWaiting, versionWaiting };
  });
  const needsYou = rows.filter((r) => r.needsYou);

  return (
    <>
      <PageHeader
        eyebrow={client?.name}
        title="Your videos"
        description="Watch each cut, comment right on the moment you want changed, and approve when it's right."
      />
      {rows.length === 0 ? (
        <EmptyState title="No videos yet">Your projects will show up here as soon as they start.</EmptyState>
      ) : (
        <div className="flex flex-col gap-8">
          {needsYou.length > 0 && (
            <section>
              <h2 className="kicker mb-3">Waiting for you</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {needsYou.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/review/${v.id}${v.versionWaiting ? `?v=${v.versionWaiting.id}` : ""}`}
                      className="block rounded-xl border border-accent/40 bg-accent-soft p-4 transition-colors hover:border-accent"
                    >
                      <div className="font-medium text-ink">{v.title}</div>
                      <div className="mt-1 text-[13px] text-ink-2">
                        {v.versionWaiting
                          ? `Version ${v.versionWaiting.number} is ready to review`
                          : "The script is ready for your approval"}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h2 className="kicker mb-3">All videos</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-xl frost">
              {rows.map((v) => (
                <li key={v.id}>
                  <Link href={`/review/${v.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-surface-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{v.title}</span>
                    <span className="text-[13px] text-muted">{FORMAT_LABEL[v.format]}</span>
                    {v.needsYou && <Badge tone="accent">Needs you</Badge>}
                    <VideoStatusBadge status={v.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
