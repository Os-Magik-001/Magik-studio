import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { requireRole, displayName } from "@/lib/auth";
import { visibleVideo } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { claudeConfigured } from "@/lib/claude";
import { FORMAT_LABEL, formatBytes, parseShotList } from "@/lib/workflow";
import { Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, buttonClass } from "@/components/ui";
import { ScriptStatusBadge, StatusStepper, VersionStatusBadge, VideoStatusBadge } from "@/components/status";
import { deleteFootage, cancelEditJob, retryEditJob } from "@/app/actions/workflow";
import { AutoRefresh } from "@/components/auto-refresh";
import { LocalDate } from "@/components/local-date";
import { deleteShoot, deleteVideo } from "@/app/actions/studio";
import {
  DeliverButton,
  DraftUpload,
  FootageDrop,
  LaunchEditForm,
  ScheduleShootForm,
  ScriptEditor,
  VideoDetailsForm,
} from "./forms";

export const metadata: Metadata = { title: "Video" };

const JOB_SOURCE = { launch: "First edit", editor_fix: "Editor fixes", client_changes: "Client changes" } as const;
const JOB_STATUS = {
  queued: { label: "Waiting for Claude", tone: "accent" },
  running: { label: "Claude is editing", tone: "accent" },
  done: { label: "Done", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
} as const;

export default async function VideoPage({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  const viewer = await requireRole("admin", "editor");
  const video = await visibleVideo(videoId);
  if (!video) notFound();

  const supabase = await createClient();
  const [{ data: client }, { data: script }, { data: shoots }, { data: footage }, { data: jobs }, { data: versions }, { data: staff }] =
    await Promise.all([
      supabase.from("clients").select("id, name, revision_limit").eq("id", video.client_id).single(),
      supabase.from("scripts").select("*").eq("video_id", videoId).maybeSingle(),
      supabase.from("shoots").select("*").eq("video_id", videoId).order("starts_at"),
      supabase.from("footage").select("*").eq("video_id", videoId).order("created_at"),
      supabase.from("edit_jobs").select("*").eq("video_id", videoId).order("created_at", { ascending: false }),
      supabase
        .from("versions")
        .select("id, number, status, made_by, notes, created_at, file_name")
        .eq("video_id", videoId)
        .order("number", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email, role").in("role", ["editor", "videographer"]),
    ]);

  const footageUrls = await signedUrls("footage", (footage ?? []).map((f) => f.storage_path));
  const openJobs = (jobs ?? []).filter((j) => j.status === "queued" || j.status === "running");
  const changeRounds = (versions ?? []).filter((v) => v.status === "changes_requested").length;
  const latest = versions?.[0];
  const people = (role: string) =>
    (staff ?? []).filter((p) => p.role === role).map((p) => ({ id: p.id, name: displayName(p) }));
  const scriptStatus = script?.status ?? "draft";

  return (
    <>
      <PageHeader
        eyebrow={
          <span>
            <Link href={`/clients/${client?.id}`} className="hover:text-ink">
              {client?.name}
            </Link>{" "}
            · {FORMAT_LABEL[video.format]} · {video.aspect}
          </span>
        }
        title={video.title}
        actions={
          <>
            <VideoStatusBadge status={video.status} />
            {latest && (
              <LinkButton href={`/review/${video.id}?v=${latest.id}`} variant="primary">
                Open review
              </LinkButton>
            )}
            {video.status === "approved" && <DeliverButton videoId={video.id} />}
          </>
        }
      />
      <div className="mb-8">
        <StatusStepper status={video.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Script */}
          <Card>
            <CardHeader
              title="Script & shot list"
              description="Claude drafts from the brief and brand kit; you finalize; the client approves before the shoot."
              actions={<ScriptStatusBadge status={scriptStatus} />}
            />
            <div className="p-5">
              {script?.status === "changes_requested" && script.client_note && (
                <div className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
                  <div className="font-medium">The client asked for changes</div>
                  <p className="mt-1 whitespace-pre-wrap">{script.client_note}</p>
                </div>
              )}
              {script?.status === "approved" ? (
                <div className="flex flex-col gap-4">
                  <p className="text-[13px] text-success">
                    Approved by the client
                    {script.approved_at && <LocalDate value={script.approved_at} preset="date" prefix=" on " />}.
                  </p>
                  <div className="whitespace-pre-wrap rounded-xl bg-surface-2 p-4 text-sm leading-relaxed text-ink">
                    {script.body}
                  </div>
                  <ShotList shots={parseShotList(script.shot_list)} />
                </div>
              ) : (
                <ScriptEditor
                  videoId={video.id}
                  body={script?.body ?? ""}
                  shots={parseShotList(script?.shot_list).map((s) => s.text).join("\n")}
                  status={scriptStatus}
                  hasBrief={!!video.brief?.trim()}
                  claudeReady={claudeConfigured()}
                  draftedByClaude={!!script?.drafted_by_claude}
                />
              )}
            </div>
          </Card>

          {/* Edit */}
          <Card>
            <CardHeader
              title="Edit with Claude"
              description="Launch the edit with any notes. Fix requests and client changes go back to Claude the same way."
            />
            <div className="flex flex-col gap-5 p-5">
              {openJobs.length === 0 && (
                <LaunchEditForm
                  videoId={video.id}
                  disabledReason={
                    !footage?.length
                      ? "Upload the raw footage first."
                      : scriptStatus !== "approved"
                        ? "The client has to approve the script first."
                        : undefined
                  }
                />
              )}
              {(jobs ?? []).length > 0 && (
                <ul className="flex flex-col gap-2">
                  {(jobs ?? []).slice(0, 6).map((j) => (
                    <li key={j.id} className="rounded-xl border border-line p-3">
                      <div className="flex flex-wrap items-center gap-2 text-[13px]">
                        <span className="font-medium text-ink">{JOB_SOURCE[j.source]}</span>
                        <Badge tone={JOB_STATUS[j.status].tone}>{JOB_STATUS[j.status].label}</Badge>
                        <span className="ml-auto text-xs text-muted">
                          <LocalDate value={j.created_at} preset="short" />
                        </span>
                        {(j.status === "queued" || j.status === "running") && (
                          <form action={cancelEditJob}>
                            <input type="hidden" name="jobId" value={j.id} />
                            <button className="text-xs text-muted hover:text-danger">Cancel</button>
                          </form>
                        )}
                        {j.status === "failed" && openJobs.length === 0 && (
                          <form action={retryEditJob}>
                            <input type="hidden" name="jobId" value={j.id} />
                            <button className="text-xs font-medium text-accent hover:underline">Retry</button>
                          </form>
                        )}
                      </div>
                      {j.status === "running" && j.progress && (
                        <p className="mt-1.5 flex items-center gap-2 text-[13px] text-accent">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden />
                          {j.progress}…
                        </p>
                      )}
                      {j.status === "failed" && j.error && <p className="mt-1.5 text-[13px] text-danger">{j.error}</p>}
                      {j.instructions && (
                        <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-[13px] text-ink-2">{j.instructions}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {openJobs.length > 0 && (
                <>
                  <AutoRefresh seconds={6} />
                  <details className="rounded-xl bg-surface-2 p-4 text-[13px] text-ink-2">
                    <summary className="cursor-pointer font-medium text-ink">Upload a render yourself instead</summary>
                    <p className="mt-2">
                      Claude is working on this edit; this page updates when the draft is ready. If you&apos;d rather cut
                      it by hand, upload the render here. Either way it goes to editor check, never straight to the client.
                    </p>
                    <div className="mt-3">
                      <DraftUpload videoId={video.id} />
                    </div>
                  </details>
                </>
              )}
            </div>
          </Card>

          {/* Versions */}
          <Card>
            <CardHeader
              title="Versions"
              description={
                <>
                  {changeRounds} of {client?.revision_limit ?? 0} included revision rounds used
                  {client && changeRounds > client.revision_limit && (
                    <span className="text-warning"> · extra rounds are billable</span>
                  )}
                </>
              }
            />
            {!versions?.length ? (
              <div className="p-5">
                <EmptyState title="No versions yet">Drafts appear here once the edit is back.</EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {versions.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/review/${video.id}?v=${v.id}`}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-surface-2"
                    >
                      <span className="font-mono text-sm text-ink">v{v.number}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-muted">
                        {v.made_by === "claude" ? "Claude" : "Editor"} · <LocalDate value={v.created_at} preset="short" />
                      </span>
                      <VersionStatusBadge status={v.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Details" />
            <div className="p-5">
              <VideoDetailsForm
                isAdmin={viewer.role === "admin"}
                video={{
                  id: video.id,
                  title: video.title,
                  brief: video.brief ?? "",
                  dueOn: video.due_on ?? "",
                  format: video.format,
                  aspect: video.aspect,
                  editorId: video.editor_id ?? "",
                  videographerId: video.videographer_id ?? "",
                }}
                editors={people("editor")}
                videographers={people("videographer")}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Shoot" />
            <div className="flex flex-col gap-4 p-5">
              {shoots?.map((s) => (
                <div key={s.id} className="flex items-start gap-3 rounded-xl border border-line p-3 text-[13px]">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink">
                      <LocalDate value={s.starts_at} preset="datetime" />
                    </div>
                    {s.location && <div className="text-muted">{s.location}</div>}
                    {s.needs && <div className="mt-1 whitespace-pre-wrap text-ink-2">{s.needs}</div>}
                  </div>
                  <form action={deleteShoot}>
                    <input type="hidden" name="shootId" value={s.id} />
                    <button aria-label="Remove shoot" className="text-muted hover:text-danger">
                      <Trash2 size={14} />
                    </button>
                  </form>
                </div>
              ))}
              <ScheduleShootForm videoId={video.id} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Raw footage" description={`${footage?.length ?? 0} ${footage?.length === 1 ? "file" : "files"}`} />
            <div className="flex flex-col gap-3 p-5">
              {footage?.map((f) => (
                <div key={f.id} className="flex items-center gap-2 text-[13px]">
                  <span className="min-w-0 flex-1 truncate text-ink" title={f.file_name}>
                    {f.file_name}
                  </span>
                  <span className="text-muted">{formatBytes(f.size_bytes)}</span>
                  {footageUrls.get(f.storage_path) && (
                    <a
                      href={footageUrls.get(f.storage_path)}
                      className={buttonClass("ghost", "sm")}
                      aria-label={`Download ${f.file_name}`}
                    >
                      <Download size={14} />
                    </a>
                  )}
                  <form action={deleteFootage}>
                    <input type="hidden" name="footageId" value={f.id} />
                    <button aria-label={`Delete ${f.file_name}`} className="px-1 text-muted hover:text-danger">
                      <Trash2 size={14} />
                    </button>
                  </form>
                </div>
              ))}
              <FootageDrop videoId={video.id} />
            </div>
          </Card>

          {viewer.role === "admin" && (
            <form action={deleteVideo} className="text-right">
              <input type="hidden" name="videoId" value={video.id} />
              <button className="text-xs text-muted hover:text-danger">Delete this video and its files</button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

function ShotList({ shots }: { shots: { text: string; done?: boolean }[] }) {
  if (!shots.length) return null;
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-medium text-ink-2">Shot list</h3>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
        {shots.map((s, i) => (
          <li key={i} className={s.done ? "text-muted line-through" : undefined}>
            {s.text}
          </li>
        ))}
      </ol>
    </div>
  );
}
