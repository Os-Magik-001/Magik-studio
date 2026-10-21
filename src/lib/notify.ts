import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type Audience = {
  videoId: string;
  // Who on the video to tell. Admins are always included for staff events.
  editor?: boolean;
  videographer?: boolean;
  clients?: boolean;
  admins?: boolean;
  exclude?: string;
};

export async function notify(
  audience: Audience,
  message: { kind: string; title: string; body?: string },
) {
  const admin = createAdminClient();
  const { data: video } = await admin
    .from("videos")
    .select("id, client_id, editor_id, videographer_id")
    .eq("id", audience.videoId)
    .single();
  if (!video) return;

  const ids = new Set<string>();
  if (audience.editor && video.editor_id) ids.add(video.editor_id);
  if (audience.videographer && video.videographer_id) ids.add(video.videographer_id);

  if (audience.clients) {
    const { data } = await admin.from("profiles").select("id").eq("client_id", video.client_id);
    data?.forEach((p) => ids.add(p.id));
  }
  if (audience.admins) {
    const { data } = await admin.from("profiles").select("id").eq("role", "admin");
    data?.forEach((p) => ids.add(p.id));
  }
  if (audience.exclude) ids.delete(audience.exclude);
  if (ids.size === 0) return;

  await admin.from("notifications").insert(
    [...ids].map((user_id) => ({
      user_id,
      video_id: video.id,
      kind: message.kind,
      title: message.title,
      body: message.body ?? null,
    })),
  );
}

// Onboarding news (an account opened, a contract signed, a setup finished) for the client's
// seller and the studio managers. Not tied to a video.
export async function notifySales(clientId: string, message: { kind: string; title: string; body?: string }) {
  const admin = createAdminClient();
  const [{ data: client }, { data: admins }] = await Promise.all([
    admin.from("clients").select("seller_id").eq("id", clientId).maybeSingle(),
    admin.from("profiles").select("id").eq("role", "admin"),
  ]);
  const ids = new Set((admins ?? []).map((a) => a.id));
  if (client?.seller_id) ids.add(client.seller_id);
  if (ids.size === 0) return;
  await admin.from("notifications").insert(
    [...ids].map((user_id) => ({ user_id, video_id: null, kind: message.kind, title: message.title, body: message.body ?? null })),
  );
}
