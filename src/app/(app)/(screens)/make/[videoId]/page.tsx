import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download, ExternalLink, Trash2 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { visibleVideo } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedUrls } from "@/lib/storage";
import { driveServiceEmail } from "@/lib/drive";
import { friendlyError } from "@/lib/errors";
import { FORMAT_LABEL, formatBytes } from "@/lib/workflow";
import { parseTypography, typographyFromKit } from "@/lib/typography";
import { videoTitle } from "@/lib/titles";
import { AutoRefresh } from "@/components/auto-refresh";
import { LocalDate } from "@/components/local-date";
import { Badge, Card, CardHeader, EmptyState, PageHeader, buttonClass, cx } from "@/components/ui";
import { WindowPage } from "@/components/desktop/window-page";
import { deleteVideo } from "@/app/actions/studio";
import { cancelEditJob, deleteFootage, retryEditJob } from "@/app/actions/workflow";
import { FootageDrop } from "@/app/(app)/(screens)/videos/[videoId]/forms";
import { madeStatus } from "../status";
import { MakeForm } from "./forms";

export async function generateMetadata({ params }: { params: Promise<{ videoId: string }> }): Promise<Metadata> {
  const { videoId } = await params;
  return videoTitle(videoId, "Make a video");
}

const TWO_HOURS = 2 * 3600;
const slug = (s: string) => s.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_").slice(0, 60) || "video";

export default async function MadeVideoPage({ params, searchParams }: { params: Promise<{ videoId: string }>; searchParams: Promise<{ v?: string }> }) {
  const [{ videoId }, { v }] = await Promise.all([params, searchParams]);
  const viewer = await requireRole("admin", "editor");
  const video = await visibleVideo(videoId);
  if (!video) notFound();
  // A client's video goes through the client steps on its own page.
  if (!video.internal) redirect(`/videos/${videoId}`);

  const supabase = await createClient();
  const clientId = video.client_id;
  const none = Promise.resolve({ data: null });
  const [{ data: client }, { data: kit }, { data: footage }, { data: jobs }, { data: versions }, { data: script }, { data: typed }] = await Promise.all([
    clientId ? supabase.from("clients").select("name").eq("id", clientId).maybeSingle() : none,
    clientId ? supabase.from("brand_kits").select("fonts, colors").eq("client_id", clientId).maybeSingle() : none,
    supabase.from("footage").select("*").eq("video_id", videoId).order("created_at"),
    supabase.from("edit_jobs").select("*").eq("video_id", videoId).order("created_at", { ascending: false }).limit(10),
    supabase.from("versions").select("id, number, storage_path, file_name, notes, created_at").eq("video_id", videoId).order("number", { ascending: false }),
    supabase.from("scripts").select("body").eq("video_id", videoId).maybeSingle(),
    // Fonts and colors: this video's, else the latest the team picked for the same client.
    supabase
      .from("videos")
      .select("id, typography")
      .match(clientId ? { client_id: clientId } : { id: videoId })
      .not("typography", "is", null)
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);

  const all = versions ?? [];
  const shown = all.find((x) => x.id === v) ?? all[0] ?? null;
  const state = madeStatus({ versions: all, edit_jobs: jobs ?? [], footage: footage ?? [] });
  const open = (jobs ?? []).find((j) => j.status === "queued" || j.status === "running");
  const failed = state.label === "Failed" ? jobs?.[0] : null;

  const admin = createAdminClient();
  const [footageUrls, play, download] = await Promise.all([
    signedUrls("footage", (footage ?? []).flatMap((f) => (f.storage_path ? [f.storage_path] : []))),
    shown ? signedUrls("versions", [shown.storage_path]).then((m) => m.get(shown.storage_path) ?? null) : null,
    shown
      ? admin.storage
          .from("versions")
          .createSignedUrl(shown.storage_path, TWO_HOURS, { download: `${slug(video.title)}_v${shown.number}.mp4` })
          .then(({ data }) => data?.signedUrl ?? null)
      : null,
  ]);

  const kitTypography = kit && (kit.fonts.length || kit.colors.length) ? typographyFromKit(kit) : null;
  const type = {
    initial: parseTypography((typed ?? []).find((t) => t.id === videoId)?.typography) ?? parseTypography(typed?.[0]?.typography) ?? kitTypography ?? typographyFromKit(null),
    brandKit: kitTypography,
    title: video.title,
    clientName: client?.name ?? "Magik Studio",
  };
  const portrait = video.aspect === "9:16";

  return (
    <WindowPage>
      <PageHeader
        eyebrow={<Link href="/make">Make a video</Link>}
        title={video.title}
        description={`${client?.name ?? "The studio's own"} · ${FORMAT_LABEL[video.format]} · ${video.aspect}`}
        actions={
          <>
            <Badge tone={state.tone}>{state.label}</Badge>
            {viewer.role === "admin" && (
              <form action={deleteVideo}>
                <input type="hidden" name="videoId" value={video.id} />
                <button className={cx(buttonClass("ghost", "sm"), "hover:text-danger")}>
                  <Trash2 size={14} aria-hidden /> Delete
                </button>
              </form>
            )}
          </>
        }
      />
      {open && <AutoRefresh seconds={6} />}

      <div className="grid items-start gap-6 @min-[64rem]:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-w-0 flex-col gap-6">
          {(open || failed) && (
            <Card className="overflow-hidden">
              {open && (
                <div className="flex items-center gap-3 px-5 py-3.5 text-[13px]">
                  <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {open.status === "queued" ? "Waiting for the edit engine" : `Making v${(all[0]?.number ?? 0) + 1}: ${open.progress ?? "starting"}…`}
                  </span>
                  <form action={cancelEditJob}>
                    <input type="hidden" name="jobId" value={open.id} />
                    <button className="text-xs text-muted hover:text-danger">Cancel</button>
                  </form>
                </div>
              )}
              {failed && (
                <div className="flex items-start gap-3 px-5 py-3.5 text-[13px]">
                  <p className="min-w-0 flex-1 text-danger">{friendlyError(failed.error) ?? "The engine couldn't finish."}</p>
                  <form action={retryEditJob}>
                    <input type="hidden" name="jobId" value={failed.id} />
                    <button className="text-xs font-medium text-accent hover:underline">Try again</button>
                  </form>
                </div>
              )}
            </Card>
          )}

          {shown && play ? (
            <Card className="overflow-hidden">
              <div className="flex flex-col gap-4 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {all.map((x) => (
                    <Link
                      key={x.id}
                      href={`/make/${video.id}?v=${x.id}`}
                      replace
                      className={cx(
                        "inline-flex h-8 items-center rounded-full border px-3 text-[12.5px] font-medium",
                        x.id === shown.id ? "border-accent/70 bg-accent-soft text-ink" : "border-white/10 text-ink-2 hover:border-white/25 hover:text-ink",
                      )}
                    >
                      v{x.number}
                    </Link>
                  ))}
                  {download && (
                    <a href={download} className={cx(buttonClass("secondary", "sm"), "ml-auto")}>
                      <Download size={14} aria-hidden /> Download v{shown.number}
                    </a>
                  )}
                </div>
                <video
                  key={shown.id}
                  src={play}
                  controls
                  playsInline
                  preload="metadata"
                  className={cx("mx-auto rounded-[14px] bg-black", portrait ? "h-[min(64vh,680px)] max-w-full" : "w-full")}
                  style={{ aspectRatio: video.aspect.replace(":", " / ") }}
                />
                <p className="text-[12.5px] text-muted">
                  <LocalDate value={shown.created_at} preset="short" prefix={`v${shown.number} · made `} />
                  {shown.notes && <span className="mt-1 line-clamp-3 block whitespace-pre-wrap text-ink-2">{shown.notes}</span>}
                </p>
              </div>
            </Card>
          ) : open ? (
            <Card>
              <div className="p-5">
                <EmptyState title="The engine is making it">It cuts the footage, picks the music, then sets the titles and captions. The video shows here when it&apos;s ready.</EmptyState>
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader title="Make it" description="The engine cuts the footage, picks the music and sets the titles and captions." />
              <div className="p-5">
                <MakeForm videoId={video.id} changes={false} script={script?.body ?? ""} notes={jobs?.[0]?.instructions ?? ""} type={type} blocked={!footage?.length ? "Add the footage first." : undefined} />
              </div>
            </Card>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {all.length > 0 && (
            <Card>
              <CardHeader title="Changes" description={`The engine starts from v${all[0].number}.`} />
              <div className="p-5">
                <MakeForm key={all[0].id} videoId={video.id} changes script="" type={type} blocked={open ? "The engine is on it." : undefined} />
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Footage" description={footage?.length ? `${footage.length} ${footage.length === 1 ? "file" : "files"}` : "Camera files go through Google Drive."} />
            <div className="flex flex-col gap-4 p-5">
              {!!footage?.length && (
                <ul className="flex flex-col gap-2">
                  {footage.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 text-[13px]">
                      <span className="min-w-0 flex-1 truncate text-ink" title={f.file_name}>
                        {f.file_name}
                      </span>
                      <span className="text-muted">{formatBytes(f.size_bytes)}</span>
                      {f.drive_url ? (
                        <a href={f.drive_url} target="_blank" rel="noreferrer" className={buttonClass("ghost", "sm")} aria-label={`Open ${f.file_name} in Google Drive`}>
                          <ExternalLink size={14} />
                        </a>
                      ) : (
                        f.storage_path &&
                        footageUrls.get(f.storage_path) && (
                          <a href={footageUrls.get(f.storage_path)} className={buttonClass("ghost", "sm")} aria-label={`Download ${f.file_name}`}>
                            <Download size={14} />
                          </a>
                        )
                      )}
                      <form action={deleteFootage}>
                        <input type="hidden" name="footageId" value={f.id} />
                        <button aria-label={`Delete ${f.file_name}`} className="px-1 text-muted hover:text-danger">
                          <Trash2 size={14} />
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <FootageDrop videoId={video.id} driveEmail={driveServiceEmail()} />
            </div>
          </Card>
        </div>
      </div>
    </WindowPage>
  );
}
