import "server-only";
import type { Viewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// A client uses Magik OS once onboarded: their onboarding exists and is finished. Until then
// they see the setup assistant (/setup), or, without an onboarding yet, a "being prepared" note.
export async function setupPending(viewer: Viewer) {
  if (viewer.role !== "client") return false;
  if (!viewer.clientId) return true;
  const supabase = await createClient();
  const { data } = await supabase.from("onboardings").select("completed_at").eq("client_id", viewer.clientId).maybeSingle();
  return !data?.completed_at;
}
