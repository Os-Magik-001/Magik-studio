"use server";

import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type SpotlightHit = { kind: "client" | "video"; id: string; title: string; subtitle: string; href: string };

// Spotlight's search over what the viewer may see (RLS decides): clients and videos.
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
  return hits;
}

// The menu bar's and the dock's unread badge.
export async function unreadCount(): Promise<number> {
  await getViewer();
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return count ?? 0;
}
