"use server";

import { getViewer } from "@/lib/auth";
import { EVENT_COLORS, POST_PLATFORMS } from "@/lib/calendar";
import { deliver } from "@/lib/notify";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// The Calendar app's changes. Events are written as the signed-in person (RLS: their own, or
// any for a studio manager); the invitee lists with the server's key, after that check.

export type EventInput = {
  id?: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string | null;
  description?: string | null;
  color: string;
  attendees?: string[];
  clientId?: string | null;
  videoId?: string | null;
};

type Result = { ok: true; id: string } | { ok: false; error: string };

const UUID = /^[0-9a-f-]{36}$/i;
const validInstant = (s: string) => typeof s === "string" && Number.isFinite(Date.parse(s));

export async function saveEvent(input: EventInput): Promise<Result> {
  const viewer = await getViewer();
  const title = String(input.title ?? "").trim().slice(0, 200);
  if (!title) return { ok: false, error: "Give the event a title." };
  if (!validInstant(input.start) || !validInstant(input.end)) return { ok: false, error: "Pick when it starts and ends." };
  const start = new Date(input.start).toISOString();
  const end = new Date(input.end).toISOString();
  if (end < start) return { ok: false, error: "It can't end before it starts." };
  const color = (EVENT_COLORS as readonly string[]).includes(input.color) ? input.color : "blue";
  // A client shares their events with the studio (their own company), nobody else's.
  const clientId = viewer.role === "client" ? (input.clientId ? viewer.clientId : null) : input.clientId && UUID.test(input.clientId) ? input.clientId : null;
  const videoId = input.videoId && UUID.test(input.videoId) ? input.videoId : null;
  const row = {
    title,
    starts_at: start,
    ends_at: end,
    all_day: !!input.allDay,
    location: input.location?.trim().slice(0, 300) || null,
    description: input.description?.trim().slice(0, 4000) || null,
    color,
    client_id: clientId,
    video_id: videoId,
  };

  const supabase = await createClient();
  let id = input.id && UUID.test(input.id) ? input.id : null;
  if (id) {
    const { data, error } = await supabase.from("calendar_events").update(row).eq("id", id).select("id").maybeSingle();
    if (error || !data) return { ok: false, error: "Couldn't save the event." };
  } else {
    const { data, error } = await supabase.from("calendar_events").insert({ ...row, owner_id: viewer.id }).select("id").single();
    if (error || !data) return { ok: false, error: "Couldn't save the event." };
    id = data.id;
  }

  // Invitees: the studio's team only, never for a client's own events.
  if (viewer.role !== "client" && Array.isArray(input.attendees)) {
    const admin = createAdminClient();
    const wanted = [...new Set(input.attendees.filter((a) => typeof a === "string" && UUID.test(a) && a !== viewer.id))].slice(0, 50);
    const { data: staff } = wanted.length ? await admin.from("profiles").select("id").in("id", wanted).neq("role", "client") : { data: [] };
    const keep = new Set((staff ?? []).map((p) => p.id));
    const { data: before } = await admin.from("calendar_attendees").select("user_id").eq("event_id", id);
    const had = new Set((before ?? []).map((a) => a.user_id));
    const gone = [...had].filter((u) => !keep.has(u));
    const added = [...keep].filter((u) => !had.has(u));
    if (gone.length) await admin.from("calendar_attendees").delete().eq("event_id", id).in("user_id", gone);
    if (added.length) {
      await admin.from("calendar_attendees").insert(added.map((user_id) => ({ event_id: id!, user_id })));
      const when = new Date(start).toLocaleString("en-CA", { timeZone: "America/Toronto", weekday: "short", month: "short", day: "numeric", ...(row.all_day ? {} : { hour: "numeric", minute: "2-digit" }) });
      await deliver(added.map((user_id) => ({ user_id, kind: "calendar_invite", title: `${viewer.fullName ?? viewer.email} invited you: ${title}`, body: `${when}${row.location ? ` · ${row.location}` : ""}` })));
    }
  }
  return { ok: true, id };
}

export async function moveEvent(id: string, start: string, end: string): Promise<Result> {
  await getViewer();
  if (!UUID.test(id) || !validInstant(start) || !validInstant(end) || end < start) return { ok: false, error: "Couldn't move the event." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .update({ starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "You can't move this event." };
  return { ok: true, id };
}

export async function deleteEvent(id: string): Promise<Result> {
  await getViewer();
  if (!UUID.test(id)) return { ok: false, error: "Unknown event." };
  const supabase = await createClient();
  const { error, count } = await supabase.from("calendar_events").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { ok: false, error: "You can't delete this event." };
  return { ok: true, id };
}

// When (and where) a video goes out: the studio sets it, the client sees it in their calendar.
export async function setPostDate(videoId: string, postAt: string | null, platforms?: string[]): Promise<Result> {
  const viewer = await getViewer();
  if (viewer.role !== "admin" && viewer.role !== "editor") return { ok: false, error: "Only the studio sets posting dates." };
  if (!UUID.test(videoId) || (postAt !== null && !validInstant(postAt))) return { ok: false, error: "Pick a date." };
  const patch: { post_at: string | null; post_platforms?: string[] } = { post_at: postAt ? new Date(postAt).toISOString() : null };
  if (platforms) patch.post_platforms = platforms.filter((p) => (POST_PLATFORMS as readonly string[]).includes(p));
  const supabase = await createClient();
  const { data, error } = await supabase.from("videos").update(patch).eq("id", videoId).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: "Couldn't save the posting date." };
  return { ok: true, id: videoId };
}
