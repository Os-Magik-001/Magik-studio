"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth";
import { parseDriveLink } from "@/lib/drive";
import { createAdminClient } from "@/lib/supabase/admin";
import { done, fail, text, type ActionResult } from "@/lib/action-result";

// The studio adds one of its Google Drive folders as a music or sound-effect library; the
// edit engine lists and measures its files, then the sound designer searches them.
export async function addSoundLibrary(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  const name = text(formData, "name");
  const kind = text(formData, "kind") === "sfx" ? "sfx" : "music";
  const link = text(formData, "link");
  if (!name) return fail("Give the library a name.");
  if (link.includes("@") && !link.includes("drive.google.com")) {
    return fail("That's an email address. Share the folder with it in Google Drive, then paste the folder's link here (Share → Copy link).");
  }
  const folder = parseDriveLink(link);
  if (!folder) return fail("That doesn't look like a Google Drive link. In Drive: right-click the folder → Share → Copy link.");

  const { error } = await createAdminClient()
    .from("sound_libraries")
    .insert({ name, kind, source: "drive", drive_folder_id: folder, license: text(formData, "license"), created_by: viewer.id });
  if (error) return fail(error.code === "23505" ? "There's already a library with that name." : "Couldn't add the library.");
  refresh();
  return done("Added. The edit engine is listing and measuring the files; this page updates as it goes.");
}

export async function syncSoundLibrary(formData: FormData) {
  await requireRole("admin", "editor");
  await createAdminClient()
    .from("sound_libraries")
    .update({ status: "queued", progress: null, error: null })
    .eq("id", text(formData, "libraryId"))
    .eq("source", "drive")
    .in("status", ["done", "failed"]);
  refresh();
}

export async function removeSoundLibrary(formData: FormData) {
  await requireRole("admin");
  await createAdminClient().from("sound_libraries").delete().eq("id", text(formData, "libraryId")).eq("source", "drive");
  refresh();
}
