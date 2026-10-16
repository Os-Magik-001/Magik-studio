"use server";

import { refresh } from "next/cache";
import { getViewer } from "@/lib/auth";
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
