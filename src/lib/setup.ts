import "server-only";
import type { Viewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Clients set up through onboarding finish the setup assistant (/setup) before the desktop.
// Clients from before onboarding existed have no onboarding row and go straight in.
export async function setupPending(viewer: Viewer) {
  if (viewer.role !== "client" || !viewer.clientId) return false;
  const supabase = await createClient();
  const { data } = await supabase.from("onboardings").select("completed_at").eq("client_id", viewer.clientId).maybeSingle();
  return !!data && !data.completed_at;
}
