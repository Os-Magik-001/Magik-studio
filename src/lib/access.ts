import "server-only";
import { createClient } from "@/lib/supabase/server";

// Loads a video through RLS, so a null result means the viewer can't see it.
export async function visibleVideo(videoId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(videoId)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("videos")
    .select("id, client_id, internal, title, status, format, aspect, brief, editor_id, videographer_id, due_on, footage_complete_at, post_at, post_platforms")
    .eq("id", videoId)
    .maybeSingle();
  return data;
}

// A client's video, for the client steps (brief, script, shoot, review). Videos made in Make a
// video (team only, maybe with no client) aren't one.
export async function clientVideo(videoId: string) {
  const video = await visibleVideo(videoId);
  return video?.client_id && !video.internal ? { ...video, client_id: video.client_id } : null;
}

export async function visibleVersion(versionId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(versionId)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("versions")
    .select("id, video_id, number, status, storage_path")
    .eq("id", versionId)
    .maybeSingle();
  return data;
}
