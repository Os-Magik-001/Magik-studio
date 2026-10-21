"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { visibleVideo } from "@/lib/access";
import { notify } from "@/lib/notify";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASPECTS, FORMAT_LABEL, type VideoFormat } from "@/lib/workflow";
import { done, fail, optionalText, text, type ActionResult } from "@/lib/action-result";
import { passwordProblem } from "@/lib/passwords";
import type { Role } from "@/lib/auth";
import type { Database } from "@/lib/database.types";

const list = (v: string) =>
  v
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

// ---------------------------------------------------------------- clients

export async function createClientAccount(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("admin");
  const name = text(formData, "name");
  if (!name) return fail("Give the client a name.");

  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").insert({ name }).select("id").single();
  if (error) return fail("Couldn't create the client.");
  await supabase.from("brand_kits").insert({ client_id: data.id });
  redirect(`/clients/${data.id}`);
}

export async function updateClientSettings(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("admin");
  const clientId = text(formData, "clientId");
  const name = text(formData, "name");
  const revisionLimit = Number(text(formData, "revisionLimit"));
  if (!name) return fail("The client needs a name.");
  if (!Number.isInteger(revisionLimit) || revisionLimit < 0 || revisionLimit > 20) {
    return fail("Revision rounds must be a whole number from 0 to 20.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ name, revision_limit: revisionLimit })
    .eq("id", clientId);
  if (error) return fail("Couldn't save the client.");
  refresh();
  return done("Saved.");
}

export async function setClientEditor(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("admin");
  const clientId = text(formData, "clientId");
  const userId = text(formData, "userId");
  const assign = text(formData, "assign") === "1";
  const supabase = await createClient();
  const { error } = assign
    ? await supabase.from("client_team").upsert({ client_id: clientId, user_id: userId })
    : await supabase.from("client_team").delete().eq("client_id", clientId).eq("user_id", userId);
  if (error) return fail("Couldn't update the client team.");
  refresh();
  return done();
}

export async function saveBrandKit(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("admin", "editor");
  const clientId = text(formData, "clientId");
  const supabase = await createClient();
  const { error } = await supabase.from("brand_kits").upsert({
    client_id: clientId,
    colors: list(text(formData, "colors")),
    fonts: list(text(formData, "fonts")),
    music_mood: optionalText(formData, "musicMood"),
    style_rules: optionalText(formData, "styleRules"),
    edit_style: text(formData, "editStyle") === "clean" ? "clean" : "dynamic",
    graphics: text(formData, "graphics") === "designed" ? "designed" : "templates",
    ...(text(formData, "logoPath") ? { logo_path: text(formData, "logoPath") } : {}),
  });
  if (error) return fail("Couldn't save the brand kit.");
  refresh();
  return done("Brand kit saved. Claude follows it on every script and edit.");
}

export async function setBrandLogo(input: { clientId: string; path: string }): Promise<ActionResult> {
  await requireRole("admin", "editor");
  if (!input.path.startsWith(`${input.clientId}/`)) return fail("Upload didn't match this client.");
  const supabase = await createClient();
  const { data: kit } = await supabase
    .from("brand_kits")
    .select("logo_path")
    .eq("client_id", input.clientId)
    .maybeSingle();
  const { error } = await supabase
    .from("brand_kits")
    .upsert({ client_id: input.clientId, logo_path: input.path });
  if (error) return fail("Couldn't save the logo.");
  if (kit?.logo_path && kit.logo_path !== input.path) {
    await createAdminClient().storage.from("brand").remove([kit.logo_path]);
  }
  refresh();
  return done();
}

// ---------------------------------------------------------------- team

const ROLES: Role[] = ["admin", "editor", "videographer", "client", "seller"];

export async function addTeamMember(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("admin");
  const email = text(formData, "email").toLowerCase();
  const fullName = optionalText(formData, "fullName");
  const role = text(formData, "role") as Role;
  const clientId = optionalText(formData, "clientId");
  const password = formData.get("password");

  if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Enter a valid email address.");
  if (!ROLES.includes(role)) return fail("Pick a role.");
  if (role === "client" && !clientId) return fail("Pick which client this person belongs to.");
  const weak = passwordProblem(password);
  if (weak) return fail(weak);

  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: password as string,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });
  if (error || !created.user) {
    return fail(
      error?.code === "email_exists"
        ? "Someone with that email already has an account."
        : error?.code === "weak_password"
          ? "That password is too weak. Pick a longer one."
          : "Couldn't create the account.",
    );
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    email,
    full_name: fullName,
    role,
    client_id: role === "client" ? clientId : null,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return fail("Couldn't save the profile.");
  }
  refresh();
  return done(`${fullName ?? email} can now sign in with ${email} and the password you set. Share it with them privately.`);
}

// Only the studio manager resets passwords; the person can change it on their Account page.
export async function resetMemberPassword(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("admin");
  const userId = text(formData, "userId");
  const password = formData.get("password");
  const weak = passwordProblem(password);
  if (weak) return fail(weak);

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("email").eq("id", userId).maybeSingle();
  if (!profile) return fail("Unknown person.");
  const { error } = await admin.auth.admin.updateUserById(userId, { password: password as string });
  if (error) return fail(error.code === "weak_password" ? "That password is too weak." : "Couldn't reset the password.");
  return done(`New password set for ${profile.email}. Share it with them privately.`);
}

// ---------------------------------------------------------------- videos

export async function createVideo(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin");
  const clientId = text(formData, "clientId");
  const title = text(formData, "title");
  const format = text(formData, "format") as VideoFormat;
  const aspect = text(formData, "aspect");
  if (!title) return fail("Give the video a title.");
  if (!(format in FORMAT_LABEL)) return fail("Pick a format.");
  if (!ASPECTS.includes(aspect as (typeof ASPECTS)[number])) return fail("Pick an aspect ratio.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("videos")
    .insert({
      client_id: clientId,
      title,
      format,
      aspect,
      brief: optionalText(formData, "brief"),
      editor_id: optionalText(formData, "editorId"),
      videographer_id: optionalText(formData, "videographerId"),
      due_on: optionalText(formData, "dueOn"),
      created_by: viewer.id,
    })
    .select("id")
    .single();
  if (error) return fail("Couldn't create the video.");

  await createAdminClient().from("scripts").insert({ video_id: data.id });
  await notify(
    { videoId: data.id, editor: true, videographer: true, exclude: viewer.id },
    { kind: "assigned", title: `New video: ${title}`, body: "You've been assigned to it." },
  );
  redirect(`/videos/${data.id}`);
}

export async function updateVideo(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  const videoId = text(formData, "videoId");
  const video = await visibleVideo(videoId);
  if (!video) return fail("Video not found.");

  const patch: Database["public"]["Tables"]["videos"]["Update"] = {
    title: text(formData, "title") || video.title,
    brief: optionalText(formData, "brief"),
    due_on: optionalText(formData, "dueOn"),
  };
  const format = text(formData, "format");
  if (format in FORMAT_LABEL) patch.format = format as VideoFormat;
  const aspect = text(formData, "aspect");
  if (ASPECTS.includes(aspect as (typeof ASPECTS)[number])) patch.aspect = aspect;

  // Only the studio manager reassigns people.
  if (viewer.role === "admin") {
    patch.editor_id = optionalText(formData, "editorId");
    patch.videographer_id = optionalText(formData, "videographerId");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("videos").update(patch).eq("id", videoId);
  if (error) return fail("Couldn't save the video.");

  if (viewer.role === "admin") {
    if (patch.editor_id && patch.editor_id !== video.editor_id) {
      await notify({ videoId, editor: true }, { kind: "assigned", title: `You're editing: ${video.title}` });
    }
    if (patch.videographer_id && patch.videographer_id !== video.videographer_id) {
      await notify({ videoId, videographer: true }, { kind: "assigned", title: `You're shooting: ${video.title}` });
    }
  }
  refresh();
  return done("Saved.");
}

export async function deleteVideo(formData: FormData) {
  await requireRole("admin");
  const videoId = text(formData, "videoId");
  const video = await visibleVideo(videoId);
  if (!video) return;
  const admin = createAdminClient();
  const [{ data: footage }, { data: versions }] = await Promise.all([
    admin.from("footage").select("storage_path").eq("video_id", videoId),
    admin.from("versions").select("storage_path").eq("video_id", videoId),
  ]);
  const uploads = (footage ?? []).flatMap((f) => (f.storage_path ? [f.storage_path] : []));
  if (uploads.length) await admin.storage.from("footage").remove(uploads);
  if (versions?.length) await admin.storage.from("versions").remove(versions.map((v) => v.storage_path));
  await createClient().then((s) => s.from("videos").delete().eq("id", videoId));
  redirect(`/clients/${video.client_id}`);
}

export async function markDelivered(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  const videoId = text(formData, "videoId");
  const video = await visibleVideo(videoId);
  if (!video) return fail("Video not found.");
  if (video.status !== "approved") return fail("Only approved videos can be delivered.");
  await createAdminClient().from("videos").update({ status: "delivered" }).eq("id", videoId);
  await notify(
    { videoId, clients: true, editor: true, admins: true, exclude: viewer.id },
    { kind: "delivered", title: `Delivered: ${video.title}` },
  );
  refresh();
  return done();
}

// ---------------------------------------------------------------- shoots

export async function scheduleShoot(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  const videoId = text(formData, "videoId");
  const video = await visibleVideo(videoId);
  if (!video) return fail("Video not found.");

  const startsAt = text(formData, "startsAt");
  const endsAt = optionalText(formData, "endsAt");
  const tz = Number(text(formData, "tzOffset") || "0");
  if (!startsAt) return fail("Pick when the shoot starts.");
  // datetime-local has no zone; the browser sends its offset so we store the right instant.
  const toIso = (local: string) => new Date(Date.parse(local + "Z") + tz * 60_000).toISOString();
  const starts = toIso(startsAt);
  const ends = endsAt ? toIso(endsAt) : null;
  if (ends && ends <= starts) return fail("The shoot has to end after it starts.");

  const supabase = await createClient();
  const { error } = await supabase.from("shoots").insert({
    video_id: videoId,
    starts_at: starts,
    ends_at: ends,
    location: optionalText(formData, "location"),
    needs: optionalText(formData, "needs"),
  });
  if (error) return fail("Couldn't schedule the shoot.");

  await notify(
    { videoId, videographer: true, exclude: viewer.id },
    { kind: "shoot_scheduled", title: `Shoot scheduled: ${video.title}` },
  );
  refresh();
  return done("Shoot scheduled.");
}

export async function deleteShoot(formData: FormData) {
  await requireRole("admin", "editor");
  const supabase = await createClient();
  await supabase.from("shoots").delete().eq("id", text(formData, "shootId"));
  refresh();
}
