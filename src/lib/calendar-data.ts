import "server-only";
import type { Role, Viewer } from "@/lib/auth";
import { displayName } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Db } from "@/lib/supabase/admin";
import { EVENT_COLORS, addDays, dayStart, type CalEvent, type EventColor, type Person } from "@/lib/calendar";

// What a person's calendar shows between two instants. In the app everything is read through
// RLS (the signed-in person); the feed for Google and Apple Calendar has no session, so it reads
// with the server's key and keeps to the same rules (feedEvents).

type Access = { id: string; role: Role; clientId: string | null };

const asColor = (c: string): EventColor => ((EVENT_COLORS as readonly string[]).includes(c) ? (c as EventColor) : "blue");

const videoHref = (role: Role, id: string) => (role === "client" ? `/review/${id}` : role === "videographer" ? `/shoots/${id}` : `/videos/${id}`);

async function load(db: Db, who: Access, from: string, to: string, scope: { videoIds: string[] | null; clientIds: string[] | null; filterEvents: boolean }): Promise<CalEvent[]> {
  const role = who.role;
  const staff = role === "admin" || role === "editor" || role === "videographer";
  const sales = role === "admin" || role === "seller";
  const fromDay = from.slice(0, 10);
  const toDay = to.slice(0, 10);

  let events = db
    .from("calendar_events")
    .select("id, owner_id, title, description, location, starts_at, ends_at, all_day, color, client_id, video_id, clients(name), calendar_attendees(user_id)")
    .lt("starts_at", to)
    .gte("ends_at", from)
    .order("starts_at")
    .limit(2000);
  if (scope.filterEvents) {
    const { data: invited } = await db.from("calendar_attendees").select("event_id").eq("user_id", who.id);
    const ors = [`owner_id.eq.${who.id}`];
    if (invited?.length) ors.push(`id.in.(${invited.map((i) => i.event_id).join(",")})`);
    if (role === "admin") ors.push("client_id.not.is.null");
    else if (scope.clientIds?.length) ors.push(`client_id.in.(${scope.clientIds.join(",")})`);
    events = events.or(ors.join(","));
  }

  const noVideos = scope.videoIds !== null && scope.videoIds.length === 0;
  const only = scope.videoIds;

  let shootsQ = db.from("shoots").select("id, video_id, starts_at, ends_at, location, needs, videos(title, client_id, clients(name))").lt("starts_at", to).gte("starts_at", new Date(Date.parse(from) - 12 * 3600_000).toISOString()).limit(1000);
  if (only) shootsQ = shootsQ.in("video_id", only);
  let postsQ = db.from("videos").select("id, title, post_at, post_platforms, status, client_id, clients(name)").not("post_at", "is", null).lt("post_at", to).gte("post_at", from).limit(1000);
  if (only) postsQ = postsQ.in("id", only);
  let duesQ = db.from("videos").select("id, title, due_on, status, client_id, clients(name)").not("due_on", "is", null).gte("due_on", fromDay).lte("due_on", toDay).neq("status", "delivered").limit(1000);
  if (only) duesQ = duesQ.in("id", only);
  let invoicesQ = db.from("invoices").select("id, number, due_on, status, total_cents, currency, client_id, clients(name)").in("status", ["issued", "sent"]).not("due_on", "is", null).gte("due_on", fromDay).lte("due_on", toDay).limit(500);
  if (role === "client") invoicesQ = invoicesQ.in("client_id", scope.clientIds?.length ? scope.clientIds : ["00000000-0000-0000-0000-000000000000"]);

  const none = Promise.resolve({ data: [] as never[] });
  const [ev, shoots, posts, dues, invoices] = await Promise.all([
    events,
    role === "seller" || noVideos ? none : shootsQ,
    role === "seller" || noVideos ? none : postsQ,
    !staff || noVideos ? none : duesQ,
    sales || role === "client" ? invoicesQ : none,
  ]);

  // The names of owners and attendees.
  const ids = new Set<string>();
  for (const e of ev.data ?? []) {
    ids.add(e.owner_id);
    for (const a of e.calendar_attendees ?? []) ids.add(a.user_id);
  }
  const names = new Map<string, string>();
  if (ids.size) {
    const { data: people } = await db.from("profiles").select("id, full_name, email").in("id", [...ids]);
    for (const p of people ?? []) names.set(p.id, displayName(p));
  }

  const out: CalEvent[] = [];
  for (const e of ev.data ?? []) {
    out.push({
      id: `ev:${e.id}`,
      source: "event",
      title: e.title,
      start: e.starts_at,
      end: e.ends_at,
      allDay: e.all_day,
      color: asColor(e.color),
      location: e.location,
      description: e.description,
      href: e.video_id ? videoHref(role, e.video_id) : null,
      editable: e.owner_id === who.id || role === "admin",
      owner: names.get(e.owner_id) ?? null,
      attendees: (e.calendar_attendees ?? []).map((a) => ({ id: a.user_id, name: names.get(a.user_id) ?? "Someone" })),
      client: e.client_id ? { id: e.client_id, name: e.clients?.name ?? "" } : null,
      videoId: e.video_id,
    });
  }
  for (const s of (shoots.data ?? []) as { id: string; video_id: string; starts_at: string; ends_at: string | null; location: string | null; needs: string | null; videos: { title: string; client_id: string; clients: { name: string } | null } | null }[]) {
    out.push({
      id: `shoot:${s.id}`,
      source: "shoot",
      title: `Shoot · ${s.videos?.title ?? "Video"}`,
      start: s.starts_at,
      end: s.ends_at ?? new Date(Date.parse(s.starts_at) + 2 * 3600_000).toISOString(),
      allDay: false,
      color: "orange",
      location: s.location,
      description: role === "client" ? null : s.needs,
      href: videoHref(role, s.video_id),
      editable: false,
      owner: null,
      attendees: [],
      client: s.videos ? { id: s.videos.client_id, name: s.videos.clients?.name ?? "" } : null,
      videoId: s.video_id,
    });
  }
  for (const v of (posts.data ?? []) as { id: string; title: string; post_at: string; post_platforms: string[]; client_id: string; clients: { name: string } | null }[]) {
    out.push({
      id: `post:${v.id}`,
      source: "post",
      title: `Posting · ${v.title}`,
      start: v.post_at,
      end: new Date(Date.parse(v.post_at) + 30 * 60_000).toISOString(),
      allDay: false,
      color: "gold",
      location: v.post_platforms?.length ? v.post_platforms.join(", ") : null,
      description: null,
      href: videoHref(role, v.id),
      editable: role === "admin" || role === "editor",
      owner: null,
      attendees: [],
      client: { id: v.client_id, name: v.clients?.name ?? "" },
      videoId: v.id,
      platforms: v.post_platforms ?? [],
    });
  }
  for (const v of (dues.data ?? []) as { id: string; title: string; due_on: string; client_id: string; clients: { name: string } | null }[]) {
    out.push({
      id: `due:${v.id}`,
      source: "due",
      title: `Due · ${v.title}`,
      start: dayStart(v.due_on),
      end: dayStart(addDays(v.due_on, 1)),
      allDay: true,
      color: "red",
      location: null,
      description: v.clients?.name ?? null,
      href: videoHref(role, v.id),
      editable: false,
      owner: null,
      attendees: [],
      client: { id: v.client_id, name: v.clients?.name ?? "" },
      videoId: v.id,
    });
  }
  for (const i of (invoices.data ?? []) as { id: string; number: string; due_on: string; total_cents: number; currency: string; client_id: string; clients: { name: string } | null }[]) {
    out.push({
      id: `inv:${i.id}`,
      source: "invoice",
      title: `Invoice ${i.number} due`,
      start: dayStart(i.due_on),
      end: dayStart(addDays(i.due_on, 1)),
      allDay: true,
      color: "graphite",
      location: null,
      description: `${i.clients?.name ?? ""} · ${new Intl.NumberFormat("en-CA", { style: "currency", currency: i.currency }).format(i.total_cents / 100)}`,
      href: role === "client" ? "/account/documents" : "/onboarding/invoices",
      editable: false,
      owner: null,
      attendees: [],
      client: { id: i.client_id, name: i.clients?.name ?? "" },
      videoId: null,
    });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

// The signed-in person's calendar, through RLS.
export async function calendarEvents(viewer: Viewer, from: string, to: string) {
  const supabase = await createClient();
  return load(supabase, { id: viewer.id, role: viewer.role, clientId: viewer.clientId }, from, to, { videoIds: null, clientIds: viewer.clientId ? [viewer.clientId] : null, filterEvents: false });
}

// The same calendar for the feed, read with the server's key and the same rules as RLS
// (private.can_access_video and can_access_client).
export async function feedEvents(userId: string, from: string, to: string) {
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("id, role, client_id, paused_at").eq("id", userId).maybeSingle();
  if (!p || p.paused_at) return [];
  let videoIds: string[] | null = null;
  let clientIds: string[] | null = null;
  if (p.role === "editor") {
    const [{ data: team }, { data: assigned }] = await Promise.all([
      admin.from("client_team").select("client_id").eq("user_id", userId),
      admin.from("videos").select("id, client_id").eq("editor_id", userId),
    ]);
    clientIds = [...new Set([...(team ?? []).map((t) => t.client_id), ...(assigned ?? []).flatMap((v) => (v.client_id ? [v.client_id] : []))])];
    const { data: theirs } = clientIds.length ? await admin.from("videos").select("id").in("client_id", (team ?? []).map((t) => t.client_id)) : { data: [] };
    videoIds = [...new Set([...(assigned ?? []).map((v) => v.id), ...(theirs ?? []).map((v) => v.id)])];
  } else if (p.role === "videographer") {
    const { data } = await admin.from("videos").select("id, client_id").eq("videographer_id", userId);
    videoIds = (data ?? []).map((v) => v.id);
    clientIds = [...new Set((data ?? []).flatMap((v) => (v.client_id ? [v.client_id] : [])))];
  } else if (p.role === "client") {
    clientIds = p.client_id ? [p.client_id] : [];
    const { data } = p.client_id ? await admin.from("videos").select("id").eq("client_id", p.client_id) : { data: [] };
    videoIds = (data ?? []).map((v) => v.id);
  } else if (p.role === "seller") {
    videoIds = [];
    clientIds = [];
  }
  return load(admin, { id: userId, role: p.role, clientId: p.client_id }, from, to, { videoIds, clientIds, filterEvents: true });
}

// The people someone can invite: the studio's team (clients don't invite).
export async function invitable(viewer: Viewer): Promise<Person[]> {
  if (viewer.role === "client") return [];
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, email, role").neq("role", "client").is("paused_at", null).order("full_name");
  return (data ?? []).filter((p) => p.id !== viewer.id).map((p) => ({ id: p.id, name: displayName(p), role: p.role }));
}
