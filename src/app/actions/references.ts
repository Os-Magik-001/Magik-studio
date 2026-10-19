"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth";
import { visibleVideo } from "@/lib/access";
import { parseReferenceLink, REFERENCE_FOCUS, WATCHABLE } from "@/lib/reference-links";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { done, fail, optionalText, text, type ActionResult } from "@/lib/action-result";

// The studio managers and editors add reels and videos as references ("make it like this") for
// one video, or for every video of a client. The engine watches each one and breaks it down; the
// scriptwriter, the motion director, the editor and the sound designer work from it.
export async function addReference(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  const videoId = optionalText(formData, "videoId");
  let clientId = text(formData, "clientId");
  if (videoId) {
    const video = await visibleVideo(videoId);
    if (!video) return fail("Video not found.");
    clientId = video.client_id;
  } else {
    if (!/^[0-9a-f-]{36}$/i.test(clientId)) return fail("Client not found.");
    const { data: client } = await (await createClient()).from("clients").select("id").eq("id", clientId).maybeSingle();
    if (!client) return fail("Client not found.");
  }

  const link = parseReferenceLink(text(formData, "link"));
  if ("error" in link) return fail(link.error);
  const focus = formData.getAll("focus").map(String).filter((f) => REFERENCE_FOCUS.some((x) => x.value === f));
  const forVideo = videoId && text(formData, "scope") !== "client" ? videoId : null;
  const { error } = await createAdminClient()
    .from("reference_videos")
    .insert({
      client_id: clientId,
      video_id: forVideo,
      url: link.url,
      platform: link.platform,
      focus,
      note: optionalText(formData, "note")?.slice(0, 2000) ?? null,
      created_by: viewer.id,
    });
  if (error) return fail(error.code === "23505" ? "That link is already a reference here." : "Couldn't add the reference.");
  refresh();
  return done(
    WATCHABLE.includes(link.platform)
      ? "Added. The engine watches it in a minute or two, then every agent works from it."
      : "Added. YouTube and Vimeo don't allow downloads, so the agents work from its title and your note.",
  );
}

// Read through RLS first: a null means the viewer can't see it.
async function visibleReference(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await (await createClient()).from("reference_videos").select("id, status, sheets").eq("id", id).maybeSingle();
  return data;
}

export async function removeReference(formData: FormData) {
  await requireRole("admin", "editor");
  const ref = await visibleReference(text(formData, "referenceId"));
  if (!ref) return;
  const admin = createAdminClient();
  if (ref.sheets.length) await admin.storage.from("references").remove(ref.sheets);
  await admin.from("reference_videos").delete().eq("id", ref.id);
  refresh();
}

export async function retryReference(formData: FormData) {
  await requireRole("admin", "editor");
  const ref = await visibleReference(text(formData, "referenceId"));
  if (!ref || ref.status !== "failed") return;
  await createAdminClient()
    .from("reference_videos")
    .update({ status: "queued", error: null, progress: null, attempts: 0, started_at: null, finished_at: null })
    .eq("id", ref.id)
    .eq("status", "failed");
  refresh();
}
