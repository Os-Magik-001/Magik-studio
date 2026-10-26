"use server";

import { getViewer } from "@/lib/auth";
import { notificationHref } from "@/lib/notification-links";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";

export type SpotlightHit = { kind: "client" | "video" | "event"; id: string; title: string; subtitle: string; href: string };

// Spotlight's search over what the viewer may see (RLS decides): clients, videos, events.
export async function searchDesktop(query: string): Promise<SpotlightHit[]> {
  const viewer = await getViewer();
  const q = String(query ?? "").trim().slice(0, 60);
  if (q.length < 2) return [];
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const supabase = await createClient();
  const role = viewer.role;
  const hits: SpotlightHit[] = [];

  if (role === "admin" || role === "editor" || role === "seller") {
    const { data } = await supabase.from("clients").select("id, name").ilike("name", like).order("name").limit(6);
    for (const c of data ?? []) {
      hits.push({
        kind: "client",
        id: c.id,
        title: c.name,
        subtitle: role === "seller" ? "Client onboarding" : "Client folder",
        href: role === "seller" ? `/onboarding/${c.id}` : `/clients/${c.id}`,
      });
    }
  }
  if (role !== "seller") {
    const { data } = await supabase
      .from("videos")
      .select("id, title, clients(name)")
      .ilike("title", like)
      .order("updated_at", { ascending: false })
      .limit(8);
    for (const v of data ?? []) {
      hits.push({
        kind: "video",
        id: v.id,
        title: v.title,
        subtitle: v.clients?.name ?? "Video",
        href: role === "client" ? `/review/${v.id}` : role === "videographer" ? `/shoots/${v.id}` : `/videos/${v.id}`,
      });
    }
  }
  const { data: events } = await supabase
    .from("calendar_events")
    .select("id, title, starts_at")
    .ilike("title", like)
    .order("starts_at", { ascending: false })
    .limit(5);
  for (const e of events ?? []) {
    hits.push({ kind: "event", id: e.id, title: e.title, subtitle: "Calendar", href: `/calendar?date=${e.starts_at.slice(0, 10)}&event=${e.id}` });
  }
  return hits;
}

// The menu bar's and the Dock's unread badge.
export async function unreadCount(): Promise<number> {
  await getViewer();
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return count ?? 0;
}

export type FeedItem = { id: string; title: string; body: string | null; kind: string; at: string; unread: boolean; href: string | null };

// The notification center: the latest notifications, where each one leads.
export async function notificationFeed(): Promise<{ items: FeedItem[]; unread: number }> {
  const viewer = await getViewer();
  const supabase = await createClient();
  const [{ data }, { count }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, title, body, kind, read_at, created_at, video_id, client_id")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  return {
    unread: count ?? 0,
    items: (data ?? []).map((n) => ({
      id: n.id,
      title: n.title,
      body: friendlyError(n.body),
      kind: n.kind,
      at: n.created_at,
      unread: !n.read_at,
      href: notificationHref(viewer.role, n),
    })),
  };
}

// Marks one notification (or all of them) read; RLS keeps it to the viewer's own.
export async function markRead(id?: string): Promise<number> {
  const viewer = await getViewer();
  const supabase = await createClient();
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", viewer.id).is("read_at", null);
  if (id) q = q.eq("id", id);
  await q;
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return count ?? 0;
}
