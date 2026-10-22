import Link from "next/link";
import { CalendarClock, Check, Clapperboard, FileText, Film, Megaphone, Sparkles } from "lucide-react";
import type { Viewer } from "@/lib/auth";
import { CLIENT_STAGES, clientVideos, type ClientStage, type ClientVideo } from "@/lib/client-videos";
import { EmptyState, PageHeader, cx } from "@/components/ui";
import { WindowPage } from "@/components/desktop/window-page";

const ICON: Record<ClientStage, typeof FileText> = {
  script: FileText,
  shoot: Clapperboard,
  edit: Film,
  review: Sparkles,
  approved: Check,
  posted: Megaphone,
};

const order = CLIENT_STAGES.map((s) => s.key);

// The client's Pipeline: every video in its step, from the script to the day it goes out, and
// what's waiting for them. Each card opens the video: its script, its cuts, approve or ask for
// changes.
export async function ClientPipeline({ viewer }: { viewer: Viewer }) {
  const { client, videos } = await clientVideos(viewer, false);
  const forYou = videos.filter((v) => v.needsYou);
  const counts = new Map<ClientStage, number>();
  for (const v of videos) counts.set(v.stage, (counts.get(v.stage) ?? 0) + 1);

  return (
    <WindowPage>
      <PageHeader eyebrow={client} title="Pipeline" description="Where each of your videos is, from the script to the day it goes out. Open one to read its script, watch its cuts, approve or ask for changes." />
      {videos.length === 0 ? (
        <EmptyState title="Your first videos are on their way.">As soon as we start, each video shows up here with its script.</EmptyState>
      ) : (
        <>
          {/* the steps, with how many videos are at each */}
          <ol className="frost mb-5 grid grid-cols-3 gap-y-3 rounded-[18px] p-4 @min-[44rem]:grid-cols-6">
            {CLIENT_STAGES.map((s, i) => {
              const Icon = ICON[s.key];
              const n = counts.get(s.key) ?? 0;
              return (
                <li key={s.key} className="relative flex flex-col items-center text-center">
                  {i > 0 && <span aria-hidden className="absolute top-[18px] right-1/2 hidden h-px w-full bg-white/10 @min-[44rem]:block" />}
                  <span className={cx("relative z-10 flex h-9 w-9 items-center justify-center rounded-full", n ? "bg-accent text-black" : "bg-white/[0.08] text-muted")}>
                    <Icon size={16} aria-hidden />
                  </span>
                  <span className="mt-1.5 text-[12.5px] font-semibold text-ink">{s.label}</span>
                  <span className="text-[11.5px] text-muted">{n ? `${n} video${n > 1 ? "s" : ""}` : s.hint}</span>
                </li>
              );
            })}
          </ol>

          {forYou.length > 0 && (
            <section className="mb-5 rounded-[18px] border border-accent/35 bg-accent-soft p-4">
              <h2 className="mb-2 text-[14px] font-semibold text-accent">Waiting for you · {forYou.length}</h2>
              <ul className="grid gap-2 @min-[40rem]:grid-cols-2">
                {forYou.map((v) => (
                  <li key={v.id}>
                    <Link href={hrefOf(v)} className="flex items-center gap-3 rounded-[12px] bg-black/25 px-3 py-2.5 hover:bg-black/35">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-ink">{v.title}</span>
                        <span className="block truncate text-[12px] text-ink-2">{v.line}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-[12px] font-semibold text-black">{v.needsYou === "script" ? "Read the script" : "Watch it"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="-mx-1 overflow-x-auto pb-2">
            <div className="grid min-w-[900px] grid-cols-6 gap-3 px-1">
              {CLIENT_STAGES.map((s) => {
                const list = videos.filter((v) => v.stage === s.key);
                return (
                  <section key={s.key} aria-label={s.label} className="flex min-w-0 flex-col gap-2">
                    <header className="flex items-center justify-between px-1">
                      <h3 className="text-[12.5px] font-semibold tracking-wide text-ink-2 uppercase">{s.label}</h3>
                      <span className="text-[12px] text-muted tabular-nums">{list.length}</span>
                    </header>
                    {list.length === 0 ? (
                      <div className="rounded-[14px] border border-dashed border-white/10 px-3 py-6 text-center text-[12px] text-muted">Nothing here</div>
                    ) : (
                      list.map((v) => <Card key={v.id} v={v} />)
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        </>
      )}
    </WindowPage>
  );
}

const hrefOf = (v: ClientVideo) => `/review/${v.id}${v.needsYou === "cut" && v.version ? `?v=${v.version.id}` : ""}`;

function Card({ v }: { v: ClientVideo }) {
  const step = order.indexOf(v.stage);
  return (
    <Link href={hrefOf(v)} className={cx("frost block rounded-[14px] p-3 transition-colors hover:bg-white/[0.07]", v.needsYou && "ring-1 ring-accent/60")}>
      <p className="line-clamp-2 text-[13.5px] font-semibold text-ink">{v.title}</p>
      <p className={cx("mt-1 text-[12px]", v.needsYou ? "font-medium text-accent" : "text-ink-2")}>{v.line}</p>
      {(v.shootAt || v.postAt) && (
        <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-muted">
          <CalendarClock size={12} aria-hidden />
          {v.postAt ? `Posting ${new Date(v.postAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : `Shoot ${new Date(v.shootAt!).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
        </p>
      )}
      <span aria-label={`Step ${step + 1} of ${order.length}`} className="mt-2.5 flex gap-1">
        {order.map((k, i) => (
          <span key={k} className={cx("h-1 flex-1 rounded-full", i <= step ? "bg-accent" : "bg-white/10")} />
        ))}
      </span>
    </Link>
  );
}
