"use server";

import { refresh } from "next/cache";
import { getViewer, requireRole } from "@/lib/auth";
import { visibleVideo, visibleVersion } from "@/lib/access";
import { notify } from "@/lib/notify";
import { objectExists } from "@/lib/storage";
import { draftScript, claudeConfigured } from "@/lib/claude";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTimecode, videoStatusIndex, type VideoStatus } from "@/lib/workflow";
import { done, fail, optionalText, text, type ActionResult } from "@/lib/action-result";

// Moves a video forward, never backwards (e.g. a late footage upload doesn't undo "editing").
async function advance(videoId: string, to: VideoStatus) {
  const admin = createAdminClient();
  const { data } = await admin.from("videos").select("status").eq("id", videoId).single();
  if (data && videoStatusIndex(data.status) < videoStatusIndex(to)) {
    await admin.from("videos").update({ status: to }).eq("id", videoId);
  }
}

const setStatus = (videoId: string, status: VideoStatus) =>
  createAdminClient().from("videos").update({ status }).eq("id", videoId);

// ---------------------------------------------------------------- script

export async function saveScript(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("admin", "editor");
  const videoId = text(formData, "videoId");
  if (!(await visibleVideo(videoId))) return fail("Video not found.");

  const shots = text(formData, "shots")
    .split("\n")
    .map((s) => s.replace(/^\s*[-*•\d.)]+\s*/, "").trim())
    .filter(Boolean)
    .map((s) => ({ text: s }));

  const supabase = await createClient();
  const { data: current } = await supabase.from("scripts").select("status").eq("video_id", videoId).maybeSingle();
  if (current?.status === "approved") return fail("This script is approved. It can't be edited.");

  const { error } = await supabase.from("scripts").upsert({
    video_id: videoId,
    body: text(formData, "body"),
    shot_list: shots,
    // Editing a script the client asked to change puts it back in draft.
    status: "draft",
  });
  if (error) return fail("Couldn't save the script.");
  refresh();
  return done("Script saved.");
}

export async function draftScriptWithClaude(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("admin", "editor");
  if (!claudeConfigured()) {
    return fail("Claude isn't connected yet. Add ANTHROPIC_API_KEY to the environment.");
  }
  const videoId = text(formData, "videoId");
  const video = await visibleVideo(videoId);
  if (!video) return fail("Video not found.");
  if (!video.brief?.trim()) return fail("Add the client's brief first. Claude writes the script from it.");

  const supabase = await createClient();
  const [{ data: client }, { data: kit }, { data: script }] = await Promise.all([
    supabase.from("clients").select("name").eq("id", video.client_id).single(),
    supabase.from("brand_kits").select("*").eq("client_id", video.client_id).maybeSingle(),
    supabase.from("scripts").select("status, client_note").eq("video_id", videoId).maybeSingle(),
  ]);
  if (script?.status === "approved") return fail("This script is already approved.");

  try {
    const draft = await draftScript({
      clientName: client?.name ?? "Client",
      title: video.title,
      format: video.format.replace("_", " "),
      aspect: video.aspect,
      brief: video.brief,
      editorNotes: [text(formData, "notes"), script?.client_note && `The client asked for: ${script.client_note}`]
        .filter(Boolean)
        .join("\n"),
      brandKit: kit
        ? { colors: kit.colors, fonts: kit.fonts, musicMood: kit.music_mood, styleRules: kit.style_rules }
        : null,
    });
    const { error } = await supabase.from("scripts").upsert({
      video_id: videoId,
      body: draft.script,
      shot_list: draft.shots.map((s) => ({ text: s })),
      status: "draft",
      drafted_by_claude: true,
    });
    if (error) return fail("Claude wrote a draft but it couldn't be saved.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Claude couldn't draft the script.");
  }
  refresh();
  return done("Claude drafted the script. Review it before sending it to the client.");
}

export async function sendScriptToClient(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  const videoId = text(formData, "videoId");
  const video = await visibleVideo(videoId);
  if (!video) return fail("Video not found.");

  const admin = createAdminClient();
  const { data: script } = await admin.from("scripts").select("body, status").eq("video_id", videoId).single();
  if (!script?.body.trim()) return fail("Write the script before sending it.");
  if (script.status === "approved") return fail("Already approved.");

  await admin.from("scripts").update({ status: "client_review", client_note: null }).eq("video_id", videoId);
  await notify(
    { videoId, clients: true, exclude: viewer.id },
    { kind: "script_ready", title: `Script ready for your approval: ${video.title}` },
  );
  refresh();
  return done("Sent to the client for approval.");
}

export async function decideScript(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("client", "admin");
  const videoId = text(formData, "videoId");
  const decision = text(formData, "decision");
  const note = optionalText(formData, "note");
  const video = await visibleVideo(videoId);
  if (!video) return fail("Video not found.");

  const admin = createAdminClient();
  const { data: script } = await admin.from("scripts").select("status").eq("video_id", videoId).single();
  if (script?.status !== "client_review") return fail("This script isn't waiting for approval.");

  if (decision === "approve") {
    await admin
      .from("scripts")
      .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: viewer.id })
      .eq("video_id", videoId);
    await advance(videoId, "shoot");
    await notify(
      { videoId, editor: true, videographer: true, admins: true, exclude: viewer.id },
      { kind: "script_approved", title: `Script approved: ${video.title}`, body: "Ready to shoot." },
    );
    refresh();
    return done("Script approved. The shoot can go ahead.");
  }

  if (!note) return fail("Tell us what to change.");
  await admin.from("scripts").update({ status: "changes_requested", client_note: note }).eq("video_id", videoId);
  await notify(
    { videoId, editor: true, exclude: viewer.id },
    { kind: "script_changes", title: `Script changes requested: ${video.title}`, body: note },
  );
  refresh();
  return done("Thanks. Your notes went to the editor.");
}

export async function toggleShot(formData: FormData) {
  const viewer = await getViewer();
  if (viewer.role === "client") return;
  const videoId = text(formData, "videoId");
  const index = Number(text(formData, "index"));
  if (!(await visibleVideo(videoId))) return;
  const admin = createAdminClient();
  const { data } = await admin.from("scripts").select("shot_list, status").eq("video_id", videoId).single();
  if (!data || !Array.isArray(data.shot_list)) return;
  const shots = data.shot_list as { text: string; done?: boolean }[];
  if (!shots[index]) return;
  shots[index] = { ...shots[index], done: !shots[index].done };
  await admin.from("scripts").update({ shot_list: shots }).eq("video_id", videoId);
  refresh();
}

// ---------------------------------------------------------------- footage

export async function registerFootage(input: {
  videoId: string;
  path: string;
  fileName: string;
  size: number;
  contentType: string;
}): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor", "videographer");
  const video = await visibleVideo(input.videoId);
  if (!video) return fail("Video not found.");
  if (!input.path.startsWith(`${input.videoId}/`) || !(await objectExists("footage", input.path))) {
    return fail("The upload didn't finish. Try again.");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("footage").insert({
    video_id: input.videoId,
    storage_path: input.path,
    file_name: input.fileName,
    size_bytes: input.size,
    content_type: input.contentType || null,
    uploaded_by: viewer.id,
  });
  if (error) return fail("Couldn't record the upload.");

  await advance(input.videoId, "footage_in");
  await notify(
    { videoId: input.videoId, editor: true, exclude: viewer.id },
    { kind: "footage_in", title: `Footage arrived: ${video.title}`, body: input.fileName },
  );
  refresh();
  return done();
}

export async function deleteFootage(formData: FormData) {
  await requireRole("admin", "editor");
  const supabase = await createClient();
  const { data } = await supabase
    .from("footage")
    .select("id, storage_path")
    .eq("id", text(formData, "footageId"))
    .maybeSingle();
  if (!data) return;
  const admin = createAdminClient();
  await admin.storage.from("footage").remove([data.storage_path]);
  await admin.from("footage").delete().eq("id", data.id);
  refresh();
}

// ---------------------------------------------------------------- Claude edit jobs

export async function launchEdit(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  const videoId = text(formData, "videoId");
  const video = await visibleVideo(videoId);
  if (!video) return fail("Video not found.");

  const admin = createAdminClient();
  const [{ count: footageCount }, { data: script }] = await Promise.all([
    admin.from("footage").select("id", { count: "exact", head: true }).eq("video_id", videoId),
    admin.from("scripts").select("status").eq("video_id", videoId).maybeSingle(),
  ]);
  if (!footageCount) return fail("Upload the raw footage first.");
  if (script?.status !== "approved") return fail("The client has to approve the script before the edit.");

  const { error } = await admin.from("edit_jobs").insert({
    video_id: videoId,
    source: "launch",
    instructions: optionalText(formData, "notes"),
    requested_by: viewer.id,
  });
  if (error) return fail("Couldn't start the edit.");
  await advance(videoId, "editing");
  refresh();
  return done("Edit queued for Claude.");
}

export async function cancelEditJob(formData: FormData) {
  await requireRole("admin", "editor");
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("edit_jobs")
    .select("id")
    .eq("id", text(formData, "jobId"))
    .in("status", ["queued", "running"])
    .maybeSingle();
  if (!job) return;
  await createAdminClient()
    .from("edit_jobs")
    .update({ status: "cancelled", finished_at: new Date().toISOString() })
    .eq("id", job.id);
  refresh();
}

// The editor (or, later, the Claude engine) attaches a rendered draft. It always
// starts in "editor check": clients never see a draft the editor hasn't sent.
export async function registerDraftVersion(input: {
  videoId: string;
  path: string;
  fileName: string;
  madeBy: "claude" | "editor";
  notes?: string;
}): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  const video = await visibleVideo(input.videoId);
  if (!video) return fail("Video not found.");
  if (!input.path.startsWith(`${input.videoId}/`) || !(await objectExists("versions", input.path))) {
    return fail("The upload didn't finish. Try again.");
  }

  const admin = createAdminClient();
  const { data: last } = await admin
    .from("versions")
    .select("number")
    .eq("video_id", input.videoId)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: version, error } = await admin
    .from("versions")
    .insert({
      video_id: input.videoId,
      number: (last?.number ?? 0) + 1,
      storage_path: input.path,
      file_name: input.fileName,
      made_by: input.madeBy,
      notes: input.notes?.trim() || null,
      created_by: viewer.id,
    })
    .select("id, number")
    .single();
  if (error || !version) return fail("Couldn't save the version.");

  await admin
    .from("edit_jobs")
    .update({ status: "done", finished_at: new Date().toISOString(), result_version_id: version.id })
    .eq("video_id", input.videoId)
    .in("status", ["queued", "running"]);
  await setStatus(input.videoId, "editor_check");
  await notify(
    { videoId: input.videoId, editor: true, admins: true, exclude: viewer.id },
    { kind: "version_ready", title: `v${version.number} ready for editor check: ${video.title}` },
  );
  refresh();
  return done(`v${version.number} added.`, { versionId: version.id });
}

export async function requestFixes(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  const version = await visibleVersion(text(formData, "versionId"));
  if (!version) return fail("Version not found.");
  if (version.status !== "draft") return fail("Only drafts in editor check can be sent back.");
  const instructions = text(formData, "instructions");
  if (!instructions) return fail("Tell Claude what to fix.");

  const admin = createAdminClient();
  await admin.from("versions").update({ status: "fixes_requested", decided_at: new Date().toISOString() }).eq("id", version.id);
  await admin.from("edit_jobs").insert({
    video_id: version.video_id,
    base_version_id: version.id,
    source: "editor_fix",
    instructions: await withTimecodedComments(version.id, instructions),
    requested_by: viewer.id,
  });
  await setStatus(version.video_id, "editing");
  refresh();
  return done("Sent back to Claude.");
}

export async function sendVersionToClient(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  const version = await visibleVersion(text(formData, "versionId"));
  if (!version) return fail("Version not found.");
  if (version.status !== "draft") return fail("This version isn't waiting for the editor.");

  const admin = createAdminClient();
  const { data: latest } = await admin
    .from("versions")
    .select("id")
    .eq("video_id", version.video_id)
    .order("number", { ascending: false })
    .limit(1)
    .single();
  if (latest?.id !== version.id) return fail("Only the newest version can go to the client.");

  await admin.from("versions").update({ status: "client_review", sent_at: new Date().toISOString() }).eq("id", version.id);
  await setStatus(version.video_id, "client_review");
  const video = await visibleVideo(version.video_id);
  await notify(
    { videoId: version.video_id, clients: true, admins: true, exclude: viewer.id },
    { kind: "version_sent", title: `v${version.number} is ready to review: ${video?.title ?? ""}` },
  );
  refresh();
  return done("Sent to the client.");
}

// ---------------------------------------------------------------- client review

export async function addComment(input: {
  versionId: string;
  body: string;
  timecodeMs: number | null;
  drawing: unknown;
  parentId?: string | null;
}): Promise<ActionResult> {
  const viewer = await getViewer();
  const version = await visibleVersion(input.versionId);
  if (!version) return fail("Version not found.");
  const body = input.body.trim();
  if (!body) return fail("Write a comment.");
  if (body.length > 4000) return fail("Keep comments under 4,000 characters.");

  // Staff notes made before the client sees the version stay internal.
  const internal = viewer.role !== "client" && (version.status === "draft" || version.status === "fixes_requested");
  const supabase = await createClient();
  const { error } = await supabase.from("comments").insert({
    version_id: version.id,
    author_id: viewer.id,
    internal,
    body,
    parent_id: input.parentId ?? null,
    timecode_ms: input.timecodeMs === null ? null : Math.max(0, Math.round(input.timecodeMs)),
    drawing: (input.drawing ?? null) as never,
  });
  if (error) return fail("Couldn't post the comment.");

  const video = await visibleVideo(version.video_id);
  await notify(
    viewer.role === "client"
      ? { videoId: version.video_id, editor: true, exclude: viewer.id }
      : { videoId: version.video_id, clients: !internal && version.status === "client_review", editor: true, exclude: viewer.id },
    {
      kind: "comment",
      title: `New comment on ${video?.title ?? "a video"} v${version.number}`,
      body: body.slice(0, 140),
    },
  );
  refresh();
  return done();
}

export async function setCommentResolved(formData: FormData) {
  await requireRole("admin", "editor");
  const supabase = await createClient();
  const { data: comment } = await supabase
    .from("comments")
    .select("id")
    .eq("id", text(formData, "commentId"))
    .maybeSingle();
  if (!comment) return;
  await createAdminClient()
    .from("comments")
    .update({ resolved: text(formData, "resolved") === "1" })
    .eq("id", comment.id);
  refresh();
}

async function withTimecodedComments(versionId: string, extra: string | null) {
  const admin = createAdminClient();
  const { data: comments } = await admin
    .from("comments")
    .select("body, timecode_ms, resolved, drawing")
    .eq("version_id", versionId)
    .eq("resolved", false)
    .order("timecode_ms", { ascending: true, nullsFirst: true });
  const lines = (comments ?? []).map(
    (c) =>
      `- ${c.timecode_ms === null ? "General" : `At ${formatTimecode(c.timecode_ms)}`}: ${c.body}${c.drawing ? " (marked on frame)" : ""}`,
  );
  return [extra, lines.length ? `Comments on this version:\n${lines.join("\n")}` : null]
    .filter(Boolean)
    .join("\n\n");
}

export async function decideVersion(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("client", "admin");
  const version = await visibleVersion(text(formData, "versionId"));
  if (!version) return fail("Version not found.");
  if (version.status !== "client_review") return fail("This version isn't waiting for your decision.");
  const decision = text(formData, "decision");
  const note = optionalText(formData, "note");
  const video = await visibleVideo(version.video_id);
  if (!video) return fail("Video not found.");

  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (decision === "approve") {
    await admin.from("versions").update({ status: "approved", decided_at: now }).eq("id", version.id);
    await setStatus(version.video_id, "approved");
    await notify(
      { videoId: version.video_id, editor: true, admins: true, exclude: viewer.id },
      { kind: "approved", title: `Approved: ${video.title} v${version.number}` },
    );
    refresh();
    return done("Approved. Thank you!");
  }

  const { count: openComments } = await admin
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("version_id", version.id)
    .eq("resolved", false)
    .eq("internal", false);
  if (!note && !openComments) return fail("Leave a comment on the moment you want changed, or add a note.");

  await admin.from("versions").update({ status: "changes_requested", decided_at: now }).eq("id", version.id);
  // Client comments go straight back to Claude; the editor checks the next version.
  await admin.from("edit_jobs").insert({
    video_id: version.video_id,
    base_version_id: version.id,
    source: "client_changes",
    instructions: await withTimecodedComments(version.id, note ? `Client note: ${note}` : null),
    requested_by: viewer.id,
  });
  await setStatus(version.video_id, "editing");
  await notify(
    { videoId: version.video_id, editor: true, admins: true, exclude: viewer.id },
    { kind: "changes_requested", title: `Changes requested: ${video.title} v${version.number}`, body: note ?? undefined },
  );
  refresh();
  return done("Got it. Your changes are with the team.");
}

// ---------------------------------------------------------------- notifications

export async function markNotificationsRead() {
  const viewer = await getViewer();
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", viewer.id)
    .is("read_at", null);
  refresh();
}
