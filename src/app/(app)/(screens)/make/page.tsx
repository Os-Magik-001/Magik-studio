import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FORMAT_LABEL } from "@/lib/workflow";
import { AutoRefresh } from "@/components/auto-refresh";
import { LocalDate } from "@/components/local-date";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { WindowPage } from "@/components/desktop/window-page";
import { madeStatus } from "./status";
import { NewVideoForm } from "./forms";

export const metadata: Metadata = { title: "Make a video" };

export default async function MakePage() {
  await requireRole("admin", "editor");
  const supabase = await createClient();
  const [{ data: videos }, { data: clients }] = await Promise.all([
    supabase
      .from("videos")
      .select("id, title, format, aspect, updated_at, client:clients(name), versions(number, created_at), edit_jobs(status, progress, created_at), footage(id)")
      .eq("internal", true)
      .order("updated_at", { ascending: false }),
    supabase.from("clients").select("id, name").order("name"),
  ]);
  const rows = (videos ?? []).map((v) => ({ ...v, state: madeStatus(v) }));

  return (
    <WindowPage>
      <PageHeader
        title="Make a video"
        description="Footage in, finished video out. The edit engine cuts it, scores it and sets its titles and captions, without the client steps: no brief, no script approval, no client review. Only the team sees these videos."
      />
      {rows.some((r) => r.state.busy) && <AutoRefresh seconds={10} />}
      <div className="grid items-start gap-6 @min-[64rem]:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="@min-[64rem]:order-2">
          <CardHeader title="New video" description="Name it, then add the footage on its page." />
          <div className="p-5">
            <NewVideoForm clients={clients ?? []} />
          </div>
        </Card>
        <Card className="min-w-0">
          <CardHeader title="Videos" description={rows.length ? `${rows.length} made here` : undefined} />
          {!rows.length ? (
            <div className="p-5">
              <EmptyState title="Nothing made yet">Start a video on the right: name it, add the footage, say what you want, and the engine makes it.</EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((v) => (
                <li key={v.id}>
                  <Link href={`/make/${v.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-white/[0.04]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{v.title}</p>
                      <p className="mt-0.5 truncate text-[12.5px] text-muted">
                        {v.client?.name ?? "The studio"} · {FORMAT_LABEL[v.format]} · {v.aspect} · <LocalDate value={v.updated_at} preset="short" />
                      </p>
                    </div>
                    <Badge tone={v.state.tone}>{v.state.label}</Badge>
                    <ChevronRight size={15} className="shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </WindowPage>
  );
}
