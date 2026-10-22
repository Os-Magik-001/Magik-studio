import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { clientVideos } from "@/lib/client-videos";
import { EmptyState, PageHeader } from "@/components/ui";
import { SegmentedNav } from "@/components/segmented";
import { WindowPage } from "@/components/desktop/window-page";
import { VideoGallery } from "@/components/videos/gallery";

export const metadata: Metadata = { title: "Your videos" };

type Show = "all" | "you" | "production" | "done";

// The client's videos, as a gallery of frames.
export default async function YourVideos({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const viewer = await getViewer();
  if (viewer.role !== "client") redirect("/pipeline");
  const { show: asked } = await searchParams;
  const show: Show = asked === "you" || asked === "production" || asked === "done" ? asked : "all";
  const { client, videos } = await clientVideos(viewer, true);
  const forYou = videos.filter((v) => v.needsYou);
  const list = videos.filter((v) =>
    show === "you" ? v.needsYou : show === "production" ? ["script", "shoot", "edit"].includes(v.stage) && !v.needsYou : show === "done" ? v.stage === "approved" || v.stage === "posted" : true,
  );

  return (
    <WindowPage>
      <PageHeader eyebrow={client} title="Your videos" description="Watch each cut, comment right on the moment you want changed, approve it, and download it." />
      {videos.length === 0 ? (
        <EmptyState title="No videos yet">Your projects will show up here as soon as they start.</EmptyState>
      ) : (
        <>
          {forYou.length > 0 && (
            <ul className="mb-5 grid gap-2 @min-[40rem]:grid-cols-2">
              {forYou.slice(0, 4).map((v) => (
                <li key={v.id}>
                  <Link
                    href={`/review/${v.id}${v.needsYou === "cut" && v.version ? `?v=${v.version.id}` : ""}`}
                    className="flex items-center gap-3 rounded-[14px] border border-accent/40 bg-accent-soft px-4 py-3 transition-colors hover:border-accent"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-ink">{v.title}</span>
                      <span className="block truncate text-[12.5px] text-ink-2">{v.line}</span>
                    </span>
                    <ArrowRight size={16} className="shrink-0 text-accent" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mb-4">
            <SegmentedNav
              active={show}
              items={[
                { key: "all", label: "All", href: "/review", count: videos.length },
                { key: "you", label: "For you", href: "/review?show=you", count: forYou.length },
                { key: "production", label: "In production", href: "/review?show=production" },
                { key: "done", label: "Approved", href: "/review?show=done" },
              ]}
            />
          </div>
          {list.length ? <VideoGallery videos={list} client={client} /> : <EmptyState title="Nothing here right now." />}
        </>
      )}
    </WindowPage>
  );
}
