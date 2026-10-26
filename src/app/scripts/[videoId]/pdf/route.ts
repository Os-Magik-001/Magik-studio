import { getViewer } from "@/lib/auth";
import { clientVideo } from "@/lib/access";
import { asShootPlan } from "@/lib/agent-types";
import { readBeats } from "@/lib/script-view";
import { renderScriptPdf } from "@/lib/script-pdf";
import { parseShotList } from "@/lib/workflow";
import { createClient } from "@/lib/supabase/server";

// A video's script as a PDF (@/lib/script-pdf). RLS decides what the viewer may read: the studio
// every version, the client and the videographer the script once it has gone to the client.
export async function GET(_: Request, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  const viewer = await getViewer();
  const video = await clientVideo(videoId);
  if (!video) return new Response("Script not found.", { status: 404 });
  const supabase = await createClient();
  const [{ data: script }, { data: client }] = await Promise.all([
    supabase.from("scripts").select("body, beats, shot_list, shoot_plan, status, updated_at").eq("video_id", videoId).maybeSingle(),
    supabase.from("clients").select("name").eq("id", video.client_id).maybeSingle(),
  ]);
  if (!script?.body.trim()) return new Response("This script isn't ready yet.", { status: 404 });

  const name = client?.name ?? "Magik Studio";
  const pdf = await renderScriptPdf({
    client: name,
    title: video.title,
    status: script.status,
    updatedAt: script.updated_at,
    beats: readBeats(script.beats, script.body),
    body: script.body,
    shots: parseShotList(script.shot_list).map((s) => s.text),
    plan: asShootPlan(script.shoot_plan),
    withPlan: viewer.role !== "client",
  });
  const file = `${name} - ${video.title} - Script.pdf`.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${file.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(file)}`,
      "cache-control": "private, no-store",
    },
  });
}
