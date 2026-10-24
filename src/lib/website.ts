import "server-only";
import { cacheLife } from "next/cache";
import type { Viewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliver } from "@/lib/notify";

// The client's website made with Magik (clients.site_*), shown in their Website app.

export type SiteStatus = "none" | "building" | "live";

export const siteStatus = (s: string | null | undefined): SiteStatus => (s === "building" || s === "live" ? s : "none");

// Whether a site lets itself be shown inside another page (X-Frame-Options, CSP frame-ancestors).
// Checked at most every hour per address.
export async function canEmbed(url: string): Promise<boolean> {
  "use cache";
  cacheLife("hours");
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(3500), headers: { "user-agent": "MagikOS-preview" } });
    const xfo = (res.headers.get("x-frame-options") ?? "").toLowerCase();
    if (xfo.includes("deny") || xfo.includes("sameorigin")) return false;
    const csp = (res.headers.get("content-security-policy") ?? "").toLowerCase();
    const fa = /frame-ancestors([^;]*)/.exec(csp)?.[1]?.trim();
    if (fa && !fa.split(/\s+/).includes("*")) return false;
    return res.ok;
  } catch {
    return false;
  }
}

// A client without a website from Magik hears about it once, in their notifications.
export async function ensureWebsiteNotice(viewer: Viewer) {
  if (viewer.role !== "client" || !viewer.clientId) return;
  try {
    const admin = createAdminClient();
    const [{ data: client }, { count }] = await Promise.all([
      admin.from("clients").select("site_status").eq("id", viewer.clientId).maybeSingle(),
      admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", viewer.id).eq("kind", "website_missing"),
    ]);
    if (!client || siteStatus(client.site_status) !== "none" || (count ?? 0) > 0) return;
    // Through deliver(), so it keeps to what the client muted (Messages from the studio).
    await deliver([
      {
        user_id: viewer.id,
        client_id: viewer.clientId,
        kind: "website_missing",
        title: "You don't have a website with Magik yet",
        body: "A website that matches your videos brings your clients one click closer. Open Website to tell the studio you're interested.",
      },
    ]);
  } catch {}
}
