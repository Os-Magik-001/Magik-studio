import type { Role } from "@/lib/auth";

// Where a notification takes each role: shared by the Notifications window and the
// notification center in the menu bar.
export function notificationHref(role: Role, n: { video_id: string | null; client_id: string | null; kind: string }): string | null {
  if (n.kind === "website_missing" || n.kind === "website") return role === "client" ? "/website" : n.client_id ? `/clients/${n.client_id}` : null;
  if (n.kind.startsWith("referral")) return "/referrals";
  if (n.kind.startsWith("calendar")) return "/calendar";
  if (n.kind.startsWith("help")) return role === "admin" ? "/help?inbox=1" : "/help";
  // News about a client's month (several videos): each role's list of them.
  if (!n.video_id && n.client_id) {
    if (role === "client") return "/pipeline";
    if (role === "videographer") return "/shoots";
    if (role === "admin" || role === "editor") return `/clients/${n.client_id}#production`;
    return role === "seller" ? "/onboarding" : null;
  }
  if (!n.video_id) return n.kind.startsWith("onboarding") && (role === "admin" || role === "seller") ? "/onboarding" : null;
  if (role === "client") return `/review/${n.video_id}`;
  if (role === "videographer") return `/shoots/${n.video_id}`;
  return ["comment", "version_ready", "version_sent", "approved", "changes_requested"].includes(n.kind) ? `/review/${n.video_id}` : `/videos/${n.video_id}`;
}
