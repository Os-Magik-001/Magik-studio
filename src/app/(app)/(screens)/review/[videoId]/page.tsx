import { videoTitle } from "@/lib/titles";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getViewer, displayName } from "@/lib/auth";
import { visibleVideo } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { parseShotList } from "@/lib/workflow";
import { asShootPlan } from "@/lib/agent-types";
import { readBeats } from "@/lib/script-view";
import { EmptyState, PageHeader } from "@/components/ui";
import { VideoStatusBadge } from "@/components/status";
import { ReviewRoom, type ReviewComment, type ReviewVersion } from "@/components/review/review-room";
import { ScriptReview } from "@/components/review/script-review";
import { ScriptDocument } from "@/components/scripts/script-document";
import { WindowPage } from "@/components/desktop/window-page";

export async function generateMetadata({ params }: { params: Promise<{ videoId: string }> }): Promise<Metadata> {
  return videoTitle((await params).videoId, "Review", "Review · ");
}

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ videoId: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const [{ videoId }, { v }] = await Promise.all([params, searchParams]);
  const viewer = await getViewer();
  const video = await visibleVideo(videoId);
  if (!video) notFound();

  const supabase = await createClient();
  // RLS hides drafts from clients, so this is exactly what the viewer may see.
  const [{ data: versions }, { data: client }, { data: script }] = await Promise.all([
    supabase
      .from("versions")
      .select("id, number, status, storage_path, notes, made_by, created_at, sent_at")
      .eq("video_id", videoId)
      .order("number", { ascending: true }),
    supabase.from("clients").select("name, revision_limit").eq("id", video.client_id).single(),
    supabase.from("scripts").select("body, beats, shot_list, shoot_plan, status, client_note, approved_at").eq("video_id", videoId).maybeSingle(),
  ]);

  const list = versions ?? [];
  const selected = list.find((x) => x.id === v) ?? list[list.length - 1];
  const urls = await signedUrls("versions", list.map((x) => x.storage_path));

  const { data: rawComments } = selected
    ? await supabase
        .from("comments")
        .select("id, body, timecode_ms, drawing, resolved, internal, created_at, parent_id, author:profiles(id, full_name, email, role)")
        .eq("version_id", selected.id)
        .order("created_at")
    : { data: [] };

  const comments: ReviewComment[] = (rawComments ?? []).map((c) => ({
    id: c.id,
    body: c.body,
    timecodeMs: c.timecode_ms,
    drawing: (c.drawing as ReviewComment["drawing"]) ?? null,
    resolved: c.resolved,
    internal: c.internal,
    createdAt: c.created_at,
    parentId: c.parent_id,
    authorId: c.author?.id ?? "",
    authorName: c.author ? displayName(c.author) : "Someone",
    authorIsClient: c.author?.role === "client",
  }));

  const reviewVersions: ReviewVersion[] = list.map((x) => ({
    id: x.id,
    number: x.number,
    status: x.status,
    url: urls.get(x.storage_path) ?? null,
    notes: x.notes,
    createdAt: x.sent_at ?? x.created_at,
  }));

  const changeRounds = list.filter((x) => x.status === "changes_requested").length;
  const isClient = viewer.role === "client";
  const isStaffEditor = viewer.role === "admin" || viewer.role === "editor";
  const latestId = list[list.length - 1]?.id;
  // The script waiting for approval comes first; once approved, it stays below the cuts to read.
  const scriptCard = script?.body.trim() ? (
    <ScriptReview videoId={video.id} canDecide={(isClient || viewer.role === "admin") && script.status === "client_review"} status={script.status} approvedAt={script.approved_at}>
      <ScriptDocument beats={readBeats(script.beats, script.body)} body={script.body} plan={asShootPlan(script.shoot_plan)} shots={parseShotList(script.shot_list).map((s) => s.text)} />
    </ScriptReview>
  ) : null;
  const scriptFirst = script?.status === "client_review" || !selected;

  return (
    <WindowPage>
      <PageHeader
        eyebrow={
          isClient ? (
            <Link href="/review" className="hover:text-ink">
              Your videos
            </Link>
          ) : (
            <Link href={`/videos/${video.id}`} className="hover:text-ink">
              {client?.name} · back to video
            </Link>
          )
        }
        title={video.title}
        actions={<VideoStatusBadge status={video.status} />}
      />

      {scriptCard && scriptFirst && <div className="mb-6">{scriptCard}</div>}

      {!selected ? (
        <EmptyState title={isClient ? "Nothing to review yet" : "No versions yet"}>
          {isClient
            ? "We'll let you know as soon as your first cut is ready."
            : "Upload a draft on the video page to start the review."}
        </EmptyState>
      ) : (
        <ReviewRoom
          key={selected.id}
          videoId={video.id}
          versions={reviewVersions}
          selectedId={selected.id}
          comments={comments}
          viewerId={viewer.id}
          aspect={video.aspect}
          permissions={{
            canDecide: (isClient || viewer.role === "admin") && selected.status === "client_review",
            canDraftCheck: isStaffEditor && selected.status === "draft" && selected.id === latestId,
            canResolve: isStaffEditor,
            isClient,
          }}
          revisions={{ used: changeRounds, included: client?.revision_limit ?? 0 }}
        />
      )}
      {scriptCard && !scriptFirst && <div className="mt-6">{scriptCard}</div>}
    </WindowPage>
  );
}
