"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { done, fail, text, type ActionResult } from "@/lib/action-result";

export async function requestSignInLink(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = text(formData, "email").toLowerCase();
  const next = text(formData, "next") || "/";
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Enter a valid email address.");

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(safeNext)}`,
    },
  });

  // Don't reveal whether an account exists.
  if (error && error.status !== 400 && error.code !== "otp_disabled" && error.code !== "signup_disabled") {
    if (error.status === 429) return fail("Too many sign-in emails. Wait a minute and try again.");
    return fail("Couldn't send the sign-in link. Try again.");
  }
  return done(`If ${email} has a Magik OS account, a sign-in link is on its way. Open it in this browser.`);
}
