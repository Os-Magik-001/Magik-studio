"use server";

import { refresh } from "next/cache";
import { getViewer, requireRole } from "@/lib/auth";
import { visibleVideo, visibleVersion } from "@/lib/access";
import { notify } from "@/lib/notify";
import { objectExists } from "@/lib/storage";
import { DriveError, driveConfigured, parseDriveLink, resolveDriveVideos } from "@/lib/drive";
import { claudeConfigured } from "@/lib/claude";
import { adaptScript, describeDesigns } from "@/lib/agents";
import { templateById } from "@/lib/design-templates";
import { approvalAfter, designChoices, direct, isDesigned, keepCurrent, record, reviseWithScriptwriter, sameText, sameVersion, withTicks, writeScript, type CurrentScript, type Version } from "@/lib/scripts";
import { asFindings } from "@/lib/agent-types";
import { clientMemory } from "@/lib/memory";
import { motionLibrary } from "@/lib/motion-prompts";
import { describeReferences, loadReferences } from "@/lib/references";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTimecode, parseShotList, videoStatusIndex, type VideoStatus } from "@/lib/workflow";
import { parseTypography } from "@/lib/typography";
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

export async function saveDesignTemplates(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("admin", "editor");
  const videoId = text(formData, "videoId");
  if (!(await visibleVideo(videoId))) return fail("Video not found.");
  const ids = [...new Set(formData.getAll("templates").map(String))].filter((id) => templateById(id) || /^prompt:[0-9a-f-]{36}$/i.test(id)).slice(0, 6);
  const { error } = await (await createClient()).from("scripts").upsert({ video_id: videoId, design_templates: ids });
  if (error) return fail("Couldn't save the templates.");
  refresh();
  return done(ids.length ? `${ids.length} template${ids.length > 1 ? "s" : ""} chosen: the motion director follows ${ids.length > 1 ? "them" : "it"}.` : "No template chosen: the motion director picks.");
}

export async function directMotion(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("admin", "editor");
  if (!claudeConfigured()) return fail("The agents aren't connected yet: ANTHROPIC_API_KEY is missing.");
  const videoId = text(formData, "videoId");
  const video = await visibleVideo(videoId);
  if (!video) return fail("Video not found.");

  const supabase = await createClient();
  const admin = createAdminClient();
  const [{ data: client }, { data: kit }, { data: script }, { data: strategy }, { data: report }, memory, motion, references] = await Promise.all([
    supabase.from("clients").select("name").eq("id", video.client_id).single(),
    supabase.from("brand_kits").select("style_rules").eq("client_id", video.client_id).maybeSingle(),
    supabase.from("scripts").select("*").eq("video_id", videoId).maybeSingle(),
    admin.from("brand_strategies").select("niche, business, audience, needs, pillars, charte").eq("client_id", video.client_id).maybeSingle(),
    admin.from("trend_reports").select("findings").eq("client_id", video.client_id).eq("status", "done").order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    clientMemory(video.client_id, { except: videoId }),
    motionLibrary([video.title, video.brief].filter(Boolean).join(" ")),
    loadReferences(video.client_id, videoId),
  ]);
  if (!script || (!script.body.trim() && !script.edit_prompt?.trim())) return fail("Write the script first: the motion director designs from it.");

  let brief;
  try {
    brief = await direct(videoId, {
      clientName: client?.name ?? "Client",
      title: video.title,
      format: video.format.replace("_", " "),
      aspect: video.aspect,
      brief: video.brief,
      script: script.body,
      shots: parseShotList(script.shot_list).map((s) => s.text),
      editPrompt: script.edit_prompt,
      chosen: await designChoices(script.design_templates, supabase),
      strategy,
      findings: asFindings(report?.findings),
      styleRules: kit?.style_rules ?? null,
      memory: memory.text,
      motion: motion.text,
      references: describeReferences(references, "motion"),
    }, supabase);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "The motion director couldn't finish.");
  }
  refresh();
  return done(`The motion director designed ${brief.scenes.length} scene${brief.scenes.length > 1 ? "s" : ""}. The engine's motion designer builds them in the edit.`);
}

// ---------------------------------------------------------------- script

export async function saveScript(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  const videoId = text(formData, "videoId");
  if (!(await visibleVideo(videoId))) return fail("Video not found.");

  const shots = text(formData, "shots")
    .split("\n")
    .map((s) => s.replace(/^\s*[-*•\d.)]+\s*/, "").trim())
    .filter(Boolean);

  const supabase = await createClient();
  const { data: current } = await supabase.from("scripts").select("*").eq("video_id", videoId).maybeSingle();
  if (current?.status === "approved") return fail("This script is approved. It can't be edited.");

  const version: Version = {
    body: text(formData, "body"),
    shot_list: withTicks(shots, current?.shot_list),
    shoot_plan: current?.shoot_plan ?? null,
    edit_prompt: optionalText(formData, "editPrompt"),
    // The beats stay only while the text is still theirs; a hand edit makes the text the script.
    beats: current && sameText(current.body, text(formData, "body")) ? current.beats : null,
  };
  const { error } = await supabase.from("scripts").upsert({
    video_id: videoId,
    body: version.body,
    shot_list: version.shot_list,
    edit_prompt: version.edit_prompt,
    beats: version.beats,
    // Editing a script the client asked to change puts it back in draft.
    status: "draft",
  });
  if (error) return fail("Couldn't save the script.");
  if (current ? !sameVersion(current, version) : version.body || version.edit_prompt) await recordHandEdit(videoId, viewer.id, current, version);
  refresh();
  return done("Script saved.");
}

// Saves by the same person a few minutes apart are one version, not a version per click.
async function recordHandEdit(videoId: string, by: string, before: CurrentScript | null, version: Version) {
  await keepCurrent(before);
  const admin = createAdminClient();
  const { data: last } = await admin
    .from("script_revisions")
    .select("id, kind, created_by, created_at")
    .eq("video_id", videoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last?.kind === "edited" && last.created_by === by && Date.now() - Date.parse(last.created_at) < 15 * 60_000) {
    await admin.from("script_revisions").update({ ...version, created_at: new Date().toISOString() }).eq("id", last.id);
  } else {
    await record(videoId, "edited", by, { version });
  }
}

// The scriptwriter: the brand strategy, the latest trend research and the brief become the
// script, the videographer's shoot plan and the edit prompt (@/lib/scripts writeScript).
export async function draftScriptWithClaude(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  if (!claudeConfigured()) return fail("The agents aren't connected yet: ANTHROPIC_API_KEY is missing.");
  const videoId = text(formData, "videoId");
  if (!(await visibleVideo(videoId))) return fail("Video not found.");

  let made;
  try {
    made = await writeScript(videoId, { by: viewer.id, notes: text(formData, "notes"), db: await createClient() });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "The scriptwriter couldn't draft the script.");
  }
  refresh();
  const designed = made.design === "done" ? " The motion director designed the scenes." : made.design === "failed" ? " The motion director couldn't design it: press Design the motion." : "";
  const remembered = made.remembered ? ` It remembered the client's ${made.remembered} other video${made.remembered > 1 ? "s" : ""}.` : "";
  return done(
    made.hasStrategy
      ? `Script, shoot plan and edit prompt are ready.${designed}${remembered} Review them before sending to the client.`
      : `Script ready.${designed}${remembered} Run the brand strategist on the client page for sharper scripts.`,
  );
}

// The studio asks the scriptwriter for changes on what it delivered, like notes in a
// writers' room. Each round is a new version in the thread, so it can be undone.
export async function reviseScriptWithClaude(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  if (!claudeConfigured()) return fail("The agents aren't connected yet: ANTHROPIC_API_KEY is missing.");
  const videoId = text(formData, "videoId");
  if (!(await visibleVideo(videoId))) return fail("Video not found.");

  let made;
  try {
    made = await reviseWithScriptwriter(videoId, { by: viewer.id, asked: text(formData, "request"), useClientNote: formData.get("useClientNote") === "1", db: await createClient() });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "The scriptwriter couldn't make the changes.");
  }
  refresh();
  const designed = made.design === "done" ? " The motion director updated the design." : made.design === "failed" ? " The design couldn't follow: press Design the motion." : "";
  return done(made.backToClient ? `Done. The script itself changed, so it needs the client's approval again.${designed}` : `Done. The changes are saved.${designed}`);
}

export async function restoreScriptRevision(formData: FormData) {
  const viewer = await requireRole("admin", "editor");
  const admin = createAdminClient();
  const { data: earlier } = await admin
    .from("script_revisions")
    .select("id, video_id, body, shot_list, shoot_plan, edit_prompt, beats")
    .eq("id", text(formData, "revisionId"))
    .neq("kind", "client")
    .maybeSingle();
  if (!earlier || earlier.body === null || !(await visibleVideo(earlier.video_id))) return;
  const supabase = await createClient();
  const { data: script } = await supabase.from("scripts").select("*").eq("video_id", earlier.video_id).maybeSingle();
  if (!script) return;

  await keepCurrent(script);
  const version: Version = {
    body: earlier.body,
    shot_list: withTicks(parseShotList(earlier.shot_list).map((s) => s.text), script.shot_list),
    shoot_plan: earlier.shoot_plan,
    edit_prompt: earlier.edit_prompt,
    beats: earlier.beats,
  };
  const { error } = await supabase
    .from("scripts")
    .update({ ...version, ...(await approvalAfter(script, version.body, viewer.id)) })
    .eq("video_id", earlier.video_id);
  if (error) return;
  await record(earlier.video_id, "restored", viewer.id, { version, restoredFrom: earlier.id });
  refresh();
}

// Fast track: the studio already has the script (and often the footage). Keep the
// script as it is, let the scriptwriter brief the engine from it, skip the client's
// approval if asked, and start the edit right away when the footage is in.
export async function fastTrackScript(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  const videoId = text(formData, "videoId");
  const video = await visibleVideo(videoId);
  if (!video) return fail("Video not found.");
  const body = text(formData, "script");
  if (!body) return fail("Paste the script first.");
  const writePrompt = formData.get("writePrompt") === "on";
  const skipApproval = formData.get("skipApproval") === "on";
  const startEdit = formData.get("startEdit") === "on";
  if (writePrompt && !claudeConfigured()) return fail("The agents aren't connected yet: ANTHROPIC_API_KEY is missing.");

  const supabase = await createClient();
  const admin = createAdminClient();
  const [{ data: client }, { data: kit }, { data: current }, { data: strategy }, { data: report }, { count: footageCount }, { count: openJobs }] = await Promise.all([
    supabase.from("clients").select("name").eq("id", video.client_id).single(),
    supabase.from("brand_kits").select("style_rules, graphics").eq("client_id", video.client_id).maybeSingle(),
    supabase.from("scripts").select("*").eq("video_id", videoId).maybeSingle(),
    admin.from("brand_strategies").select("niche, business, audience, needs, pillars, charte").eq("client_id", video.client_id).maybeSingle(),
    admin.from("trend_reports").select("id, findings").eq("client_id", video.client_id).eq("status", "done").order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("footage").select("id", { count: "exact", head: true }).eq("video_id", videoId),
    admin.from("edit_jobs").select("id", { count: "exact", head: true }).eq("video_id", videoId).in("status", ["queued", "running"]),
  ]);

  let editPrompt = optionalText(formData, "editPrompt") ?? current?.edit_prompt ?? null;
  let shots = current?.shot_list ?? [];
  const chosen = await designChoices(current?.design_templates, supabase);
  const references = writePrompt ? await loadReferences(video.client_id, videoId) : [];
  const brandInput = {
    clientName: client?.name ?? "Client",
    strategy,
    findings: asFindings(report?.findings),
    styleRules: kit?.style_rules ?? null,
    memory: writePrompt ? (await clientMemory(video.client_id, { except: videoId })).text : null,
    motion: writePrompt ? (await motionLibrary([video.title, video.brief, body].filter(Boolean).join(" "))).text : null,
  };
  if (writePrompt) {
    try {
      const adapted = await adaptScript({
        title: video.title,
        format: video.format.replace("_", " "),
        aspect: video.aspect,
        brief: video.brief,
        script: body,
        notes: optionalText(formData, "editPrompt") ?? undefined,
        designs: describeDesigns(chosen),
        references: describeReferences(references, "script"),
        ...brandInput,
      });
      editPrompt = adapted.edit_prompt;
      shots = adapted.shots.map((s) => ({ text: s }));
    } catch (e) {
      return fail(e instanceof Error ? e.message : "The scriptwriter couldn't write the edit prompt.");
    }
  }

  await keepCurrent(current);
  const { error } = await supabase.from("scripts").upsert({
    video_id: videoId,
    body,
    shot_list: shots,
    edit_prompt: editPrompt,
    beats: null,
    trend_report_id: writePrompt ? report?.id ?? null : null,
    drafted_by_claude: false,
    status: skipApproval ? "approved" : "draft",
    approved_at: skipApproval ? new Date().toISOString() : null,
    approved_by: skipApproval ? viewer.id : null,
  });
  if (error) return fail("Couldn't save the script.");
  // With Claude on, the motion director designs the scenes before the edit starts.
  if (writePrompt && isDesigned(kit?.graphics, current?.design_templates)) {
    await direct(videoId, {
      ...brandInput,
      title: video.title,
      format: video.format.replace("_", " "),
      aspect: video.aspect,
      brief: video.brief,
      script: body,
      shots: parseShotList(shots).map((s) => s.text),
      editPrompt,
      chosen,
      references: describeReferences(references, "motion"),
    }, supabase).catch(() => null);
  }
  await record(videoId, "pasted", viewer.id, {
    request: writePrompt ? optionalText(formData, "editPrompt") : null,
    reply: writePrompt ? "I wrote the edit prompt and the shot list from your script." : null,
    version: { body, shot_list: shots, shoot_plan: current?.shoot_plan ?? null, edit_prompt: editPrompt, beats: null },
  });
  if (skipApproval) await advance(videoId, footageCount ? "footage_in" : "shoot");

  let started = false;
  if (startEdit && footageCount && !openJobs) {
    const { error: jobError } = await admin.from("edit_jobs").insert({ video_id: videoId, source: "launch", instructions: editPrompt, requested_by: viewer.id });
    if (jobError) return fail("The script is saved, but the edit couldn't start.");
    await admin.from("videos").update({ footage_complete_at: new Date().toISOString() }).eq("id", videoId);
    await advance(videoId, "editing");
    started = true;
  }
  refresh();
  if (started) return done("Script saved and the edit started with it.");
  if (startEdit && !footageCount) return done("Script saved. Add the footage, then launch the edit.");
  if (startEdit && openJobs) return done("Script saved. An edit is already running.");
  return done(writePrompt ? "Script saved and the edit prompt is ready." : "Script saved.");
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
  await record(videoId, "client", viewer.id, { request: note });
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

// Big camera files go to Google Drive; the editor pastes the file or folder link.
export async function addDriveFootage(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor", "videographer");
  const videoId = text(formData, "videoId");
  const video = await visibleVideo(videoId);
  if (!video) return fail("Video not found.");
  if (!driveConfigured()) return fail("Google Drive isn't connected yet. Ask an admin to add the service account key.");
  const link = text(formData, "link");
  if (link.includes("@") && !link.includes("drive.google.com")) {
    return fail("That's an email address. Share the folder with it in Google Drive, then paste the folder's link here (Share → Copy link).");
  }
  const id = parseDriveLink(link);
  if (!id) return fail("That doesn't look like a Google Drive link. In Drive: right-click the folder → Share → Copy link.");

  let files;
  try {
    files = await resolveDriveVideos(id);
  } catch (err) {
    return fail(err instanceof DriveError ? err.message : "Couldn't reach Google Drive. Try again.");
  }
  if (!files.length) return fail("No video files in that folder.");

  const admin = createAdminClient();
  const { data: existing } = await admin.from("footage").select("drive_file_id").eq("video_id", videoId).not("drive_file_id", "is", null);
  const known = new Set(existing?.map((f) => f.drive_file_id));
  const fresh = files.filter((f) => !known.has(f.id));
  if (!fresh.length) return done("Those files are already on this video.");

  const { error } = await admin.from("footage").insert(
    fresh.map((f) => ({
      video_id: videoId,
      source: "drive" as const,
      drive_file_id: f.id,
      drive_url: f.webViewLink,
      file_name: f.name,
      size_bytes: f.size,
      content_type: f.mimeType,
      uploaded_by: viewer.id,
    })),
  );
  if (error) return fail("Couldn't add the footage.");

  const summary = fresh.length === 1 ? fresh[0].name : `${fresh.length} files from Google Drive`;
  await advance(videoId, "footage_in");
  await notify({ videoId, editor: true, exclude: viewer.id }, { kind: "footage_in", title: `Footage arrived: ${video.title}`, body: summary });
  refresh();
  return done(fresh.length === 1 ? `Added ${fresh[0].name}.` : `Added ${fresh.length} files.`);
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
  // Drive footage stays in Drive; only the link is removed.
  if (data.storage_path) await admin.storage.from("footage").remove([data.storage_path]);
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
  // For now an edit can start before the client approves the script (or without one).
  const { count: footageCount } = await admin.from("footage").select("id", { count: "exact", head: true }).eq("video_id", videoId);
  if (!footageCount) return fail("Add the raw footage first.");

  // The fonts and colors the editor picked: saved on the video, so fixes and client changes
  // keep them too.
  if (formData.has("typography")) {
    let posted: unknown = null;
    try {
      posted = JSON.parse(text(formData, "typography"));
    } catch {}
    const typography = parseTypography(posted);
    if (!typography) return fail("Pick the fonts and colors again.");
    const { error: typeError } = await admin.from("videos").update({ typography }).eq("id", videoId);
    if (typeError) return fail("Couldn't save the fonts and colors.");
  }

  const { error } = await admin.from("edit_jobs").insert({
    video_id: videoId,
    source: "launch",
    instructions: optionalText(formData, "notes"),
    requested_by: viewer.id,
  });
  if (error) return fail("Couldn't start the edit.");
  await advance(videoId, "editing");
  refresh();
  return done("Edit queued for the edit engine.");
}

// The videographer says all the footage is in: the engine starts the edit right away,
// with the scriptwriter's edit prompt.
export async function markFootageComplete(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor", "videographer");
  const videoId = text(formData, "videoId");
  const video = await visibleVideo(videoId);
  if (!video) return fail("Video not found.");

  const admin = createAdminClient();
  const [{ count: footageCount }, { count: openJobs }, { data: script }] = await Promise.all([
    admin.from("footage").select("id", { count: "exact", head: true }).eq("video_id", videoId),
    admin.from("edit_jobs").select("id", { count: "exact", head: true }).eq("video_id", videoId).in("status", ["queued", "running"]),
    admin.from("scripts").select("edit_prompt").eq("video_id", videoId).maybeSingle(),
  ]);
  if (!footageCount) return fail("Upload or link the footage first.");

  await admin.from("videos").update({ footage_complete_at: new Date().toISOString() }).eq("id", videoId);
  if (!openJobs) {
    const { error } = await admin.from("edit_jobs").insert({
      video_id: videoId,
      source: "launch",
      instructions: script?.edit_prompt ?? null,
      requested_by: viewer.id,
    });
    if (error) return fail("Couldn't start the edit.");
  }
  await advance(videoId, "editing");
  await notify(
    { videoId, editor: true, admins: true, exclude: viewer.id },
    { kind: "footage_in", title: `Footage complete: ${video.title}`, body: "The edit engine started the edit." },
  );
  refresh();
  return done(openJobs ? "Marked complete. An edit is already running." : "Thanks! The edit engine started the edit.");
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

export async function retryEditJob(formData: FormData) {
  await requireRole("admin", "editor");
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("edit_jobs")
    .select("id, video_id")
    .eq("id", text(formData, "jobId"))
    .eq("status", "failed")
    .maybeSingle();
  if (!job) return;
  const admin = createAdminClient();
  const { count } = await admin
    .from("edit_jobs")
    .select("id", { count: "exact", head: true })
    .eq("video_id", job.video_id)
    .in("status", ["queued", "running"]);
  if (count) return;
  await admin
    .from("edit_jobs")
    .update({ status: "queued", error: null, progress: null, finished_at: null })
    .eq("id", job.id);
  await setStatus(job.video_id, "editing");
  refresh();
}

// The editor attaches a rendered draft by hand (the Claude engine records its own).
// It always starts in "editor check": clients never see a draft the editor hasn't sent.
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
  if (!instructions) return fail("Tell the edit engine what to fix.");

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
  return done("Sent back to the edit engine.");
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
