"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth";
import { parseReferenceLink } from "@/lib/reference-links";
import { createAdminClient } from "@/lib/supabase/admin";
import { done, fail, optionalText, text, type ActionResult } from "@/lib/action-result";

// The studio's reference library: videos new clients pick from in their setup ("videos to
// match"). Managers and editors curate it.

const UUID = /^[0-9a-f-]{36}$/i;
const IMAGE: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

const tagList = (v: string) =>
  [...new Set(v.split(/[,\n#]/).map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 8);

// TikTok gives a cover through its public oEmbed; kept in our storage (its links expire).
async function tiktokCover(url: string): Promise<{ bytes: ArrayBuffer; type: string } | null> {
  try {
    const meta = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(5000) });
    if (!meta.ok) return null;
    const { thumbnail_url } = (await meta.json()) as { thumbnail_url?: string };
    if (!thumbnail_url?.startsWith("https://")) return null;
    const img = await fetch(thumbnail_url, { signal: AbortSignal.timeout(8000) });
    const type = img.headers.get("content-type")?.split(";")[0] ?? "";
    if (!img.ok || !IMAGE[type]) return null;
    return { bytes: await img.arrayBuffer(), type };
  } catch {
    return null;
  }
}

export async function addLibraryItem(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  const link = parseReferenceLink(text(formData, "link"));
  if ("error" in link) return fail(link.error);
  const title = text(formData, "title").slice(0, 120);
  if (!title) return fail("Give it a title clients will understand, like “Fast cuts, bold captions”.");
  const admin = createAdminClient();
  const id = crypto.randomUUID();

  let coverPath: string | null = null;
  const file = formData.get("cover");
  const upload = file instanceof File && file.size ? { bytes: await file.arrayBuffer(), type: file.type } : link.platform === "tiktok" ? await tiktokCover(link.url) : null;
  if (upload) {
    if (!IMAGE[upload.type]) return fail("The cover must be a PNG, JPG or WebP image.");
    if (upload.bytes.byteLength > 4 * 1024 * 1024) return fail("The cover is over 4 MB.");
    coverPath = `library/${id}.${IMAGE[upload.type]}`;
    const { error } = await admin.storage.from("references").upload(coverPath, upload.bytes, { contentType: upload.type, upsert: true });
    if (error) coverPath = null;
  }

  const { error } = await admin.from("reference_library").insert({
    id,
    url: link.url,
    platform: link.platform,
    title,
    note: optionalText(formData, "note")?.slice(0, 600) ?? null,
    tags: tagList(text(formData, "tags")),
    cover_path: coverPath,
    created_by: viewer.id,
  });
  if (error) {
    if (coverPath) await admin.storage.from("references").remove([coverPath]);
    return fail(error.code === "23505" ? "This video is already in the library." : "Couldn't add the video.");
  }
  refresh();
  return done("Added. New clients can pick it in their setup.");
}

export async function updateLibraryItem(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("admin", "editor");
  const id = text(formData, "id");
  if (!UUID.test(id)) return fail("Video not found.");
  const title = text(formData, "title").slice(0, 120);
  if (!title) return fail("Give it a title.");
  const { error } = await createAdminClient()
    .from("reference_library")
    .update({ title, note: optionalText(formData, "note")?.slice(0, 600) ?? null, tags: tagList(text(formData, "tags")) })
    .eq("id", id);
  if (error) return fail("Couldn't save.");
  refresh();
  return done("Saved.");
}

export async function setLibraryItemActive(formData: FormData) {
  await requireRole("admin", "editor");
  const id = text(formData, "id");
  if (!UUID.test(id)) return;
  await createAdminClient().from("reference_library").update({ active: text(formData, "active") === "1" }).eq("id", id);
  refresh();
}

export async function deleteLibraryItem(formData: FormData) {
  await requireRole("admin", "editor");
  const id = text(formData, "id");
  if (!UUID.test(id)) return;
  const admin = createAdminClient();
  const { data } = await admin.from("reference_library").select("cover_path").eq("id", id).maybeSingle();
  await admin.from("reference_library").delete().eq("id", id);
  if (data?.cover_path) await admin.storage.from("references").remove([data.cover_path]);
  refresh();
}
