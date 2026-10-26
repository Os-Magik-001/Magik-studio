"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth";
import { visibleVideo } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASPECTS, FORMAT_LABEL, type VideoFormat } from "@/lib/workflow";
import { parseTypography } from "@/lib/typography";
import { done, fail, optionalText, text, type ActionResult } from "@/lib/action-result";

// Make a video: the team edits footage with the engine without the client steps (no brief,
// script approval, shoot or client review). These videos are the team's own (videos.internal):
// a client never sees them, even when one is for them.

export async function startMadeVideo(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  const title = text(formData, "title").slice(0, 160);
  if (!title) return fail("Give the video a name.");
  const format = text(formData, "format") as VideoFormat;
  if (!(format in FORMAT_LABEL)) return fail("Pick a format.");
  const aspect = text(formData, "aspect");
  if (!ASPECTS.includes(aspect as (typeof ASPECTS)[number])) return fail("Pick a shape.");
  const clientId = optionalText(formData, "clientId");
  if (clientId) {
    const { data: client } = await (await createClient()).from("clients").select("id").eq("id", clientId).maybeSingle();
    if (!client) return fail("Client not found.");
  }

  const { data, error } = await createAdminClient()
    .from("videos")
    .insert({
      client_id: clientId,
      internal: true,
      title,
      format,
      aspect,
      status: "footage_in",
      created_by: viewer.id,
      // An editor sees the videos assigned to them.
      editor_id: viewer.role === "editor" ? viewer.id : null,
    })
    .select("id")
    .single();
  if (error || !data) return fail("Couldn't start the video.");
  redirect(`/make/${data.id}`);
}

// Sends the video to the engine: the first edit, or changes to the latest version.
export async function makeVideo(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  const videoId = text(formData, "videoId");
  const video = await visibleVideo(videoId);
  if (!video?.internal) return fail("Video not found.");

  const admin = createAdminClient();
  const [{ count: footage }, { count: open }, { data: latest }] = await Promise.all([
    admin.from("footage").select("id", { count: "exact", head: true }).eq("video_id", videoId),
    admin.from("edit_jobs").select("id", { count: "exact", head: true }).eq("video_id", videoId).in("status", ["queued", "running"]),
    admin.from("versions").select("id").eq("video_id", videoId).order("number", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!footage) return fail("Add the footage first.");
  if (open) return fail("The engine is already making it.");
  const notes = optionalText(formData, "notes");
  if (latest && !notes) return fail("Say what to change.");

  let posted: unknown = null;
  try {
    posted = JSON.parse(text(formData, "typography"));
  } catch {}
  const typography = parseTypography(posted);
  if (!typography) return fail("Pick the fonts and colors again.");
  const { error: saveError } = await admin.from("videos").update({ typography, status: "editing" }).eq("id", videoId);
  if (saveError) return fail("Couldn't save the fonts and colors.");

  // A script or the lines, when given: the engine cuts to it.
  if (formData.has("script")) {
    const { error: scriptError } = await admin
      .from("scripts")
      .upsert({ video_id: videoId, body: text(formData, "script"), status: "approved", approved_at: new Date().toISOString(), approved_by: viewer.id, drafted_by_claude: false });
    if (scriptError) return fail("Couldn't save the script.");
  }

  const { error } = await admin.from("edit_jobs").insert({
    video_id: videoId,
    source: latest ? "editor_fix" : "launch",
    base_version_id: latest?.id ?? null,
    instructions: notes,
    requested_by: viewer.id,
  });
  if (error) return fail("Couldn't start the engine.");
  refresh();
  return done(latest ? "The engine is making the changes." : "The engine is making the video.");
}
