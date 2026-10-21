import { videoTitle } from "@/lib/titles";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, ExternalLink, Trash2 } from "lucide-react";
import { requireRole, displayName } from "@/lib/auth";
import { visibleVideo } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { driveServiceEmail } from "@/lib/drive";
import { claudeConfigured } from "@/lib/claude";
import { FORMAT_LABEL, formatBytes, parseShotList, type RevisionKind } from "@/lib/workflow";
import { nextStep, stepStates, type PipelineFacts } from "@/lib/pipeline";
import { Badge, EmptyState, LinkButton, PageHeader, buttonClass, cx } from "@/components/ui";
import { ScriptStatusBadge, VersionStatusBadge, VideoStatusBadge } from "@/components/status";
import { NextStepBanner, StepCard, StepNav } from "@/components/pipeline";
import { deleteFootage, cancelEditJob, restoreScriptRevision, retryEditJob } from "@/app/actions/workflow";
import { AutoRefresh } from "@/components/auto-refresh";
import { DesignBriefView, ShootPlanView, SoundView } from "@/components/agents/views";
import { ReferenceList } from "@/components/references/list";
import { AddReferenceForm } from "@/components/references/add-form";
import { DESIGN_TEMPLATES } from "@/lib/design-templates";
import { asDesignBrief, asShootPlan, asSoundReport } from "@/lib/agent-types";
import { LocalDate } from "@/components/local-date";
import { deleteShoot, deleteVideo } from "@/app/actions/studio";
import {
  DeliverButton,
  DesignTemplatesForm,
  DirectMotionForm,
  DraftUpload,
  FootageDrop,
  FastTrackForm,
  LaunchEditForm,
  ReviseScriptForm,
  ScheduleShootForm,
  ScriptEditor,
  VideoDetailsForm,
} from "./forms";

export async function generateMetadata({ params }: { params: Promise<{ videoId: string }> }): Promise<Metadata> {
  return videoTitle((await params).videoId, "Video");
}

const JOB_SOURCE = { launch: "First edit", editor_fix: "Editor fixes", client_changes: "Client changes" } as const;
const JOB_STATUS = {
  queued: { label: "Waiting for Claude", tone: "accent" },
  running: { label: "Claude is editing", tone: "accent" },
  done: { label: "Done", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
} as const;

const nowIso = () => new Date().toISOString();

export default async function VideoPage({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  const viewer = await requireRole("admin", "editor");
  const video = await visibleVideo(videoId);
  if (!video) notFound();

  const supabase = await createClient();
  const [
    { data: client },
    { data: script },
    { data: shoots },
    { data: footage },
    { data: jobs },
    { data: versions },
    { data: staff },
    { data: strategy },
    { data: thread },
    { count: otherVideos },
    { data: kit },
    { data: savedPrompts },
    { data: references },
  ] = await Promise.all([
      supabase.from("clients").select("id, name, revision_limit").eq("id", video.client_id).single(),
      supabase.from("scripts").select("*").eq("video_id", videoId).maybeSingle(),
      supabase.from("shoots").select("*").eq("video_id", videoId).order("starts_at"),
      supabase.from("footage").select("*").eq("video_id", videoId).order("created_at"),
      supabase.from("edit_jobs").select("*").eq("video_id", videoId).order("created_at", { ascending: false }),
      supabase
        .from("versions")
        .select("id, number, status, made_by, notes, created_at, file_name, sound")
        .eq("video_id", videoId)
        .order("number", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email, role").in("role", ["editor", "videographer"]),
      supabase.from("brand_strategies").select("client_id").eq("client_id", video.client_id).maybeSingle(),
      supabase
        .from("script_revisions")
        .select("id, kind, request, reply, created_at, created_by, restored_from")
        .eq("video_id", videoId)
        .order("created_at"),
      supabase.from("videos").select("id", { count: "exact", head: true }).eq("client_id", video.client_id).neq("id", videoId),
      supabase.from("brand_kits").select("graphics").eq("client_id", video.client_id).maybeSingle(),
      supabase.from("motion_prompts").select("id, title, creator, notes, tags").order("created_at", { ascending: false }),
      supabase
        .from("reference_videos")
        .select("id, video_id, url, platform, focus, note, status, progress, error, watched, title, owner, duration, stats, analysis, sheets")
        .eq("client_id", video.client_id)
        .or(`video_id.eq.${videoId},video_id.is.null`)
        .order("created_at", { ascending: false }),
    ]);

  const refs = [...(references ?? [])].sort((a, b) => Number(!!b.video_id) - Number(!!a.video_id));
  const [footageUrls, sheetUrls] = await Promise.all([
    signedUrls("footage", (footage ?? []).flatMap((f) => (f.storage_path ? [f.storage_path] : []))),
    signedUrls("references", refs.flatMap((r) => r.sheets.slice(0, 1))),
  ]);
  const openJobs = (jobs ?? []).filter((j) => j.status === "queued" || j.status === "running");
  const changeRounds = (versions ?? []).filter((v) => v.status === "changes_requested").length;
  const latest = versions?.[0];
  const scored = versions?.find((v) => asSoundReport(v.sound));
  const sound = asSoundReport(scored?.sound);
  const people = (role: string) =>
    (staff ?? []).filter((p) => p.role === role).map((p) => ({ id: p.id, name: displayName(p) }));
  const scriptStatus = script?.status ?? "draft";
  const shootPlan = asShootPlan(script?.shoot_plan);
  const designTemplates = script?.design_templates ?? [];
  const designed = kit?.graphics === "designed" || designTemplates.length > 0;
  const designBrief = asDesignBrief(script?.design_brief);
  const watching = refs.some((r) => r.status === "queued" || r.status === "running");

  // Where the video stands: the same reading as the Pipeline board.
  const now = nowIso();
  const lastJob = jobs?.[0];
  const facts: PipelineFacts = {
    status: video.status,
    hasBrief: !!video.brief?.trim(),
    script: script ? { status: script.status, hasBody: !!script.body.trim(), hasPrompt: !!script.edit_prompt?.trim() } : null,
    nextShoot: shoots?.find((s) => s.starts_at >= now)?.starts_at ?? null,
    footage: footage?.length ?? 0,
    footageComplete: !!video.footage_complete_at,
    job: openJobs[0] ? { status: openJobs[0].status as "queued" | "running", progress: openJobs[0].progress } : lastJob?.status === "failed" ? { status: "failed", progress: null } : null,
    version: latest ? { number: latest.number, status: latest.status } : null,
  };
  const next = nextStep(facts);
  const states = stepStates({ ...facts, designed, hasDesign: !!designBrief, hasSound: !!sound, references: refs.length });

  const entries = thread ?? [];
  const peopleIds = [...new Set([...entries.map((e) => e.created_by), script?.approved_by].filter((id): id is string => !!id))];
  const { data: authors } = peopleIds.length
    ? await supabase.from("profiles").select("id, full_name, email, role").in("id", peopleIds)
    : { data: [] };
  const names = new Map((authors ?? []).map((p) => [p.id, displayName(p)]));
  const approvedByClient = script?.status === "approved" && authors?.find((p) => p.id === script.approved_by)?.role === "client";
  // The forms below hold the script in their fields: each starts over when the script changed
  // somewhere else (the scriptwriter, a restore, another form), never after its own save.
  const changedElsewhere = (own: RevisionKind) => {
    const last = entries.filter((e) => e.kind !== "client" && e.kind !== own).at(-1);
    return last ? `${last.id}:${last.created_at}` : "";
  };
  const reviewHref = latest ? `/review/${video.id}?v=${latest.id}` : null;

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
            {reviewHref && (
              <LinkButton href={reviewHref} variant="primary">
                Open review
              </LinkButton>
            )}
            {video.status === "approved" && <DeliverButton videoId={video.id} />}
          </>
        }
      />
      <div className="mb-4">
        <NextStepBanner next={next} href={next.step === "review" && reviewHref && video.status === "editor_check" ? reviewHref : `#${next.step}`} />
      </div>
      <StepNav states={states} />
      {(openJobs.length > 0 || watching) && <AutoRefresh seconds={6} />}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* 1. Brief & references */}
          <StepCard
            step="brief"
            state={states.brief}
            title="Brief & references"
            description="What the video is for, and reels or videos to learn from. The scriptwriter, the motion director, the editor and the sound designer all work from the references."
          >
            <div className="flex flex-col gap-5">
              <div className="rounded-xl bg-surface-2 p-4">
                <div className="kicker mb-1.5">Brief</div>
                {video.brief?.trim() ? (
                  <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{video.brief}</p>
                ) : (
                  <p className="text-sm text-muted">No brief yet. Write it under Details: the scriptwriter starts from it.</p>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-medium text-ink">References {refs.length > 0 && <span className="text-muted">({refs.length})</span>}</h3>
                  <span className="text-xs text-muted">The engine watches each one, then Claude breaks it down for the agents.</span>
                </div>
                {refs.length > 0 ? (
                  <ReferenceList items={refs} sheetUrls={sheetUrls} scoped />
                ) : (
                  <p className="text-[13px] text-muted">No references yet. Add a reel or a video you want this one to feel like.</p>
                )}
                <details className="group rounded-xl border border-line p-4" open={refs.length === 0}>
                  <summary className="cursor-pointer text-[13px] font-medium text-accent">Add a reference</summary>
                  <div className="mt-4">
                    <AddReferenceForm videoId={video.id} clientId={video.client_id} clientName={client?.name ?? "the client"} />
                  </div>
                </details>
              </div>
            </div>
          </StepCard>

          {/* 2. Script */}
          <StepCard
            step="script"
            state={states.script}
            title="Script & shot list"
            description="The scriptwriter drafts from the brief, the brand kit and the references; you finalize; the client approves before the shoot."
            actions={<ScriptStatusBadge status={scriptStatus} />}
          >
            {openJobs.length === 0 && (
              <details className="mb-5 rounded-xl border border-line p-4">
                <summary className="cursor-pointer text-[13px] font-medium text-ink">
                  Already have the script? <span className="text-accent">Fast track</span>
                </summary>
                <p className="mt-2 text-xs text-muted">Paste it, import it from a PDF, Word or text file, or keep the one below. The engine edits from it without the agents rewriting it.</p>
                <div className="mt-4">
                  <FastTrackForm key={changedElsewhere("pasted")} videoId={video.id} script={script?.body ?? ""} footageCount={footage?.length ?? 0} hasStrategy={!!strategy} />
                </div>
              </details>
            )}
            {script?.status === "changes_requested" && script.client_note && (
              <div className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
                <div className="font-medium">The client asked for changes</div>
                <p className="mt-1 whitespace-pre-wrap">{script.client_note}</p>
              </div>
            )}
            {script?.status === "approved" ? (
              <div className="flex flex-col gap-4">
                <p className="text-[13px] text-success">
                  Approved by {approvedByClient ? "the client" : "the studio"}
                  {script.approved_at && <LocalDate value={script.approved_at} preset="date" prefix=" on " />}.
                </p>
                <div className="whitespace-pre-wrap rounded-xl bg-surface-2 p-4 text-sm leading-relaxed text-ink">{script.body}</div>
                <ShotList shots={parseShotList(script.shot_list)} />
                {script.edit_prompt && (
                  <div>
                    <div className="kicker mb-2">Edit prompt</div>
                    <div className="whitespace-pre-wrap rounded-xl bg-surface-2 p-4 text-[13px] leading-relaxed text-ink-2">{script.edit_prompt}</div>
                  </div>
                )}
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
                editPrompt={script?.edit_prompt ?? ""}
                hasStrategy={!!strategy}
                version={changedElsewhere("edited")}
                designed={designed}
              />
            )}
            {(script?.body.trim() || script?.edit_prompt?.trim() || entries.length > 0) && (
              <ScriptThread
                videoId={video.id}
                entries={entries}
                names={names}
                clientNote={script?.status === "changes_requested" ? script.client_note : null}
                approvedByClient={approvedByClient}
                remembers={otherVideos ?? 0}
              />
            )}
            {shootPlan && (
              <details className="mt-5 rounded-xl border border-line p-4">
                <summary className="cursor-pointer text-sm font-medium text-ink">Shoot plan for the videographer ({shootPlan.scenes.length} scenes)</summary>
                <div className="mt-4">
                  <ShootPlanView plan={shootPlan} />
                </div>
              </details>
            )}
          </StepCard>

          {/* 3. Motion design */}
          <StepCard
            step="design"
            state={states.design}
            title="Motion design"
            description={
              designed
                ? "The motion director (agent 5) writes a design prompt for every scene; in the edit, the engine's motion designer codes the graphics from it."
                : "The engine uses its own motion templates. Choose design templates to have this video's graphics designed by the motion director, or make it the client's default in its brand kit."
            }
            actions={designed ? <Badge tone="accent">Designed</Badge> : undefined}
          >
            <div className="flex flex-col gap-6">
              <DesignTemplatesForm
                videoId={video.id}
                templates={DESIGN_TEMPLATES.map(({ id, title, category, summary }) => ({ id, title, category, summary }))}
                saved={(savedPrompts ?? []).map((p) => ({ id: `prompt:${p.id}`, title: p.title, category: "Saved", summary: [p.creator && `by ${p.creator}`, p.notes ?? p.tags.join(", ")].filter(Boolean).join(" · ") }))}
                chosen={designTemplates}
              />
              {designed && (
                <div className="flex flex-col gap-4 border-t border-line pt-5">
                  {designBrief && <DesignBriefView brief={designBrief} chosen={designTemplates} />}
                  <DirectMotionForm videoId={video.id} again={!!designBrief} ready={!!(script?.body.trim() || script?.edit_prompt?.trim())} />
                </div>
              )}
            </div>
          </StepCard>

          {/* 4. Shoot & footage */}
          <StepCard
            step="shoot"
            state={states.shoot}
            title="Shoot & footage"
            description={`${footage?.length ?? 0} footage ${footage?.length === 1 ? "file" : "files"}${video.footage_complete_at ? " · marked complete" : ""}`}
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-3">
                <h3 className="text-[13px] font-medium text-ink-2">Shoot</h3>
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
              <div className="flex flex-col gap-3">
                <h3 className="text-[13px] font-medium text-ink-2">Raw footage</h3>
                {footage?.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 text-[13px]">
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
                  </div>
                ))}
                <FootageDrop videoId={video.id} driveEmail={driveServiceEmail()} />
              </div>
            </div>
          </StepCard>

          {/* 5. Edit */}
          <StepCard step="edit" state={states.edit} title="Edit with Claude" description="Launch the edit with any notes. Fix requests and client changes go back to Claude the same way.">
            <div className="flex flex-col gap-5">
              {openJobs.length === 0 && (
                <LaunchEditForm key={script?.updated_at} videoId={video.id} prompt={script?.edit_prompt ?? undefined} disabledReason={!footage?.length ? "Add the raw footage first (step 4)." : undefined} />
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
                      {j.instructions && <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-[13px] text-ink-2">{j.instructions}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {openJobs.length > 0 && (
                <details className="rounded-xl bg-surface-2 p-4 text-[13px] text-ink-2">
                  <summary className="cursor-pointer font-medium text-ink">Upload a render yourself instead</summary>
                  <p className="mt-2">
                    Claude is working on this edit; this page updates when the draft is ready. If you&apos;d rather cut it by hand, upload the render here. Either way it goes to editor check, never
                    straight to the client.
                  </p>
                  <div className="mt-3">
                    <DraftUpload videoId={video.id} />
                  </div>
                </details>
              )}
            </div>
          </StepCard>

          {/* 6. Sound */}
          <StepCard
            step="sound"
            state={states.sound}
            title="Sound"
            description={
              sound
                ? `What the sound designer chose for v${scored?.number}.`
                : "After the editor locks each cut, the sound designer (agent 4) picks the music from every library, lines it up with the cut, adds sound effects and the trending sound to post with."
            }
            actions={
              <Link href="/sounds" className="text-[13px] text-accent hover:underline">
                Libraries
              </Link>
            }
          >
            {sound ? <SoundView sound={sound} /> : null}
          </StepCard>

          {/* 7. Review & delivery */}
          <StepCard
            step="review"
            state={states.review}
            title="Review & delivery"
            description={
              <>
                {changeRounds} of {client?.revision_limit ?? 0} included revision rounds used
                {client && changeRounds > client.revision_limit && <span className="text-warning"> · extra rounds are billable</span>}
              </>
            }
            actions={video.status === "approved" ? <DeliverButton videoId={video.id} /> : undefined}
            bodyClassName={versions?.length ? "" : undefined}
          >
            {!versions?.length ? (
              <EmptyState title="No versions yet">Drafts appear here once the edit is back.</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {versions.map((v) => (
                  <li key={v.id}>
                    <Link href={`/review/${video.id}?v=${v.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-surface-2">
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
          </StepCard>
        </div>

        <div className="flex flex-col gap-6">
          <section className="frost rounded-[22px] lg:sticky lg:top-20">
            <div className="border-b border-white/[0.07] px-5 py-4">
              <h2 className="text-[15px] font-semibold text-ink">Details</h2>
            </div>
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
          </section>

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

type ThreadEntry = {
  id: string;
  kind: RevisionKind;
  request: string | null;
  reply: string | null;
  created_at: string;
  created_by: string | null;
  restored_from: string | null;
};

// The scriptwriter's thread: every version of the script, what was asked and what it
// answered, with a way back to any version.
function ScriptThread({
  videoId,
  entries,
  names,
  clientNote,
  approvedByClient,
  remembers,
}: {
  videoId: string;
  entries: ThreadEntry[];
  names: Map<string, string>;
  clientNote: string | null;
  approvedByClient: boolean;
  remembers: number;
}) {
  const current = entries.filter((e) => e.kind !== "client").at(-1)?.id;
  const meta = (e: ThreadEntry, align: "start" | "end" | "center") => (
    <div className={cx("flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted", { start: "self-start", end: "self-end", center: "self-center" }[align])}>
      <LocalDate value={e.created_at} preset="short" />
      {e.id === current ? (
        <Badge tone="accent">Current</Badge>
      ) : (
        e.kind !== "client" && (
          <form action={restoreScriptRevision}>
            <input type="hidden" name="revisionId" value={e.id} />
            <button className="font-medium text-accent hover:underline">Go back to this version</button>
          </form>
        )
      )}
    </div>
  );
  const studio = (e: ThreadEntry) => (e.created_by && names.get(e.created_by)) || "The studio";
  const restoredAt = (e: ThreadEntry) => {
    const at = entries.find((x) => x.id === e.restored_from)?.created_at;
    return at ? <LocalDate value={at} preset="short" prefix="the version of " /> : "an earlier version";
  };

  return (
    <div className="mt-6 border-t border-line pt-5">
      <h3 className="text-sm font-medium text-ink">Ask the scriptwriter for changes</h3>
      <p className="mt-1 text-xs text-muted">
        It changes only what you ask and keeps the rest. Every version stays here, so you can go back to any of them.
        {remembers > 0 && ` It remembers this client's ${remembers} other video${remembers > 1 ? "s" : ""}.`}
      </p>
      {entries.length > 0 && (
        <ol className="mt-4 flex flex-col gap-4">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-col gap-1.5">
              {e.kind === "revised" && (
                <>
                  <Bubble who={studio(e)} side="right">{e.request}</Bubble>
                  <Bubble who="Scriptwriter" side="left">{e.reply ?? "Done."}</Bubble>
                  {meta(e, "start")}
                </>
              )}
              {e.kind === "client" && (
                <>
                  <Bubble who={`${e.created_by ? names.get(e.created_by) ?? "Client" : "Client"} · client`} side="right">{e.request}</Bubble>
                  {meta(e, "end")}
                </>
              )}
              {e.kind === "written" && (
                <>
                  {e.request && <Bubble who={studio(e)} side="right">{e.request}</Bubble>}
                  <Bubble who="Scriptwriter" side="left">{e.reply ? `New version: ${e.reply}` : "Wrote this version."}</Bubble>
                  {meta(e, "start")}
                </>
              )}
              {e.kind === "pasted" && (
                <>
                  <p className="self-center text-xs text-muted">{studio(e)} pasted the studio&apos;s script{e.request ? `: “${e.request}”` : ""}</p>
                  {e.reply && <Bubble who="Scriptwriter" side="left">{e.reply}</Bubble>}
                  {meta(e, e.reply ? "start" : "center")}
                </>
              )}
              {e.kind === "edited" && (
                <>
                  <p className="self-center text-xs text-muted">{e.created_by ? `${studio(e)} edited it by hand` : "The script before these changes"}</p>
                  {meta(e, "center")}
                </>
              )}
              {e.kind === "restored" && (
                <>
                  <p className="self-center text-xs text-muted">
                    {studio(e)} went back to {restoredAt(e)}
                  </p>
                  {meta(e, "center")}
                </>
              )}
            </li>
          ))}
        </ol>
      )}
      <ReviseScriptForm videoId={videoId} clientNote={clientNote} approvedByClient={approvedByClient} />
    </div>
  );
}

function Bubble({ who, side, children }: { who: string; side: "left" | "right"; children: ReactNode }) {
  return (
    <div
      className={cx(
        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
        side === "right" ? "self-end rounded-br-md bg-accent-soft text-ink" : "self-start rounded-bl-md bg-surface-2 text-ink-2",
      )}
    >
      <div className="mb-0.5 text-[11px] font-medium text-muted">{who}</div>
      <p className="whitespace-pre-wrap">{children}</p>
    </div>
  );
}
