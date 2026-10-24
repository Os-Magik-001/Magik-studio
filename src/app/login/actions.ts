"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fail, text, type ActionResult } from "@/lib/action-result";

export async function signIn(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = text(formData, "email").toLowerCase();
  const password = formData.get("password");
  const next = text(formData, "next") || "/";
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Enter a valid email address.");
  if (typeof password !== "string" || !password) return fail("Enter your password.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.status === 429) return fail("Too many attempts. Wait a minute and try again.");
    if (error.code === "user_banned") return fail("This account is paused. Ask your studio manager to resume it.");
    return fail("Wrong email or password.");
  }
  redirect(sameSite(next));
}

// Only a page of Magik OS: "/\evil.com", "//evil.com" or "/<tab>/evil.com" would leave the site.
function sameSite(next: string) {
  if (!next.startsWith("/")) return "/";
  try {
    const url = new URL(next, "http://magik.local");
    return url.origin === "http://magik.local" ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}
