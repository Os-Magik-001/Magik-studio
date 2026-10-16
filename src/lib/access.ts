import "server-only";
import { createClient } from "@/lib/supabase/server";

// Loads a video through RLS, so a null result means the viewer can't see it.
export async function visibleVideo(videoId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(videoId)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("videos")
    .select("id, client_id, title, status, format, aspect, brief, editor_id, videographer_id, due_on")
    .eq("id", videoId)
    .maybeSingle();
  return data;
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
