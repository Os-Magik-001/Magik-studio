"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { feedToken } from "@/lib/calendar-feed";
import type { Json } from "@/lib/database.types";
import { readPreferences, type Preferences } from "@/lib/preferences";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { done, fail, optionalText, type ActionResult } from "@/lib/action-result";

export async function updateMyName(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  const fullName = optionalText(formData, "fullName");
  if (fullName && fullName.length > 80) return fail("Keep your name under 80 characters.");
  // Profiles are admin-managed under RLS; people may only change their own name.
  const { error } = await createAdminClient().from("profiles").update({ full_name: fullName }).eq("id", viewer.id);
  if (error) return fail("Couldn't save your name.");
  refresh();
  return done("Saved.");
}

export async function changeMyPassword(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  const current = formData.get("current");
  const next = formData.get("password");
  const confirm = formData.get("confirm");
  if (typeof current !== "string" || !current) return fail("Enter your current password.");
  if (typeof next !== "string" || next.length < 8) return fail("Your new password needs at least 8 characters.");
  if (next.length > 72) return fail("Passwords can be at most 72 characters.");
  if (next !== confirm) return fail("The new passwords don't match.");

  const supabase = await createClient();
  // Re-check the current password so a borrowed session can't change it.
  const { error: wrong } = await supabase.auth.signInWithPassword({ email: viewer.email, password: current });
  if (wrong) return fail("Your current password isn't right.");
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) {
    return fail(
      error.code === "same_password"
        ? "Pick a password you haven't used here."
        : error.code === "weak_password"
          ? "That password is too weak. Pick a longer one."
          : "Couldn't change your password.",
    );
  }
  return done("Password changed.");
}

// Saves some of the person's settings (the rest stay as they were). Returns all of them.
export async function savePreferences(patch: Preferences): Promise<Preferences> {
  const viewer = await getViewer();
  const next = readPreferences({ ...viewer.preferences, ...readPreferences(patch) });
  await createAdminClient().from("profiles").update({ preferences: next as unknown as Json }).eq("id", viewer.id);
  return next;
}

// Signs the person out on every computer and phone, this one included.
export async function signOutEverywhere() {
  await getViewer();
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}

// The person's private calendar link (a new one replaces the old one when asked).
export async function calendarLink(fresh = false): Promise<{ https: string; webcal: string }> {
  const viewer = await getViewer();
  const token = await feedToken(viewer.id, fresh);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const path = `/api/calendar/${token}.ics`;
  return { https: `${proto}://${host}${path}`, webcal: `webcal://${host}${path}` };
}
