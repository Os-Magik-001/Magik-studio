import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { readPreferences, type Preferences } from "@/lib/preferences";

export type Role = Database["public"]["Enums"]["user_role"];

export type Viewer = {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
  clientId: string | null;
  preferences: Preferences;
  referralCode: string;
};

export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, client_id, paused_at, preferences, referral_code")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) redirect("/login?error=no-profile");
  // A paused account can't use Magik OS until a studio manager resumes it.
  if (profile.paused_at) redirect("/paused");

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
    clientId: profile.client_id,
    preferences: readPreferences(profile.preferences),
    referralCode: profile.referral_code,
  };
});

export async function requireRole(...roles: Role[]): Promise<Viewer> {
  const viewer = await getViewer();
  if (!roles.includes(viewer.role)) notFound();
  return viewer;
}

export const isStaff = (role: Role) => role !== "client";

export function displayName(p: { full_name?: string | null; fullName?: string | null; email: string }) {
  return p.full_name ?? p.fullName ?? p.email.split("@")[0];
}
