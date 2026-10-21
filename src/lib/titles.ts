import "server-only";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

// Window titles: the client's name or the video's title instead of "Client" or "Video". Read
// through RLS, so a page someone can't open doesn't leak its name.
const UUID = /^[0-9a-f-]{36}$/i;

export async function clientTitle(clientId: string, fallback: string, suffix = ""): Promise<Metadata> {
  if (!UUID.test(clientId)) return { title: fallback };
  const { data } = await (await createClient()).from("clients").select("name").eq("id", clientId).maybeSingle();
  return { title: data ? `${data.name}${suffix}` : fallback };
}

export async function videoTitle(videoId: string, fallback: string, prefix = ""): Promise<Metadata> {
  if (!UUID.test(videoId)) return { title: fallback };
  const { data } = await (await createClient()).from("videos").select("title").eq("id", videoId).maybeSingle();
  return { title: data ? `${prefix}${data.title}` : fallback };
}
