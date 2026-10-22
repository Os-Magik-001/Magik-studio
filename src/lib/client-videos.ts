import "server-only";
import type { Viewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { downloadUrls, signedUrls } from "@/lib/storage";
import type { ScriptStatus, VersionStatus, VideoFormat, VideoStatus } from "@/lib/workflow";

// A client's videos as their Pipeline and Your videos apps show them: where each one is, what
// it's waiting on, the latest cut they can watch and download. RLS keeps drafts out.

export type ClientStage = "script" | "shoot" | "edit" | "review" | "approved" | "posted";

export const CLIENT_STAGES: { key: ClientStage; label: string; hint: string }[] = [
  { key: "script", label: "Script", hint: "We write it, you approve it" },
  { key: "shoot", label: "Shoot", hint: "We film it" },
  { key: "edit", label: "Editing", hint: "We cut it" },
  { key: "review", label: "Your review", hint: "You watch, comment, approve" },
  { key: "approved", label: "Approved", hint: "Ready to go out" },
  { key: "posted", label: "Delivered", hint: "Out in the world" },
];

export type ClientVideo = {
  id: string;
  title: string;
  status: VideoStatus;
  format: VideoFormat;
  aspect: string;
  stage: ClientStage;
  // One line on where it is, in the client's words.
  line: string;
  needsYou: "script" | "cut" | null;
  scriptStatus: ScriptStatus | null;
  version: { id: string; number: number; status: VersionStatus; createdAt: string } | null;
  preview: string | null;
  download: string | null;
  shootAt: string | null;
  postAt: string | null;
  platforms: string[];
  updatedAt: string;
};

const stageOf = (s: VideoStatus): ClientStage =>
  s === "script" ? "script" : s === "shoot" ? "shoot" : s === "footage_in" || s === "editing" || s === "editor_check" ? "edit" : s === "client_review" ? "review" : s === "approved" ? "approved" : "posted";

export async function clientVideos(viewer: Viewer, withMedia: boolean): Promise<{ client: string | null; videos: ClientVideo[] }> {
  const supabase = await createClient();
  const now = new Date(Date.now() - 6 * 3600_000).toISOString();
  const [{ data: videos }, { data: client }, { data: shoots }] = await Promise.all([
    supabase
      .from("videos")
      .select("id, title, status, format, aspect, post_at, post_platforms, updated_at, scripts(status), versions(id, number, status, storage_path, created_at, sent_at)")
      .order("updated_at", { ascending: false }),
    viewer.clientId ? supabase.from("clients").select("name").eq("id", viewer.clientId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("shoots").select("video_id, starts_at").gte("starts_at", now).order("starts_at"),
  ]);
  const nextShoot = new Map<string, string>();
  for (const s of shoots ?? []) if (!nextShoot.has(s.video_id)) nextShoot.set(s.video_id, s.starts_at);

  const latest = (vs: { id: string; number: number; status: VersionStatus; storage_path: string; created_at: string; sent_at: string | null }[]) => [...vs].sort((a, b) => b.number - a.number)[0] ?? null;
  const rows = (videos ?? []).map((v) => ({ v, last: latest(v.versions ?? []) }));
  const paths = rows.map((r) => r.last?.storage_path).filter((p): p is string => !!p);
  const [previews, downloads] = withMedia
    ? await Promise.all([signedUrls("versions", paths), downloadUrls("versions", rows.filter((r) => r.last).map((r) => ({ path: r.last!.storage_path, name: `${r.v.title} v${r.last!.number}` })))])
    : [new Map<string, string>(), new Map<string, string>()];

  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Toronto", month: "short", day: "numeric" });
  return {
    client: client?.name ?? null,
    videos: rows.map(({ v, last }) => {
      const script = v.scripts?.status ?? null;
      const stage = stageOf(v.status);
      const shootAt = nextShoot.get(v.id) ?? null;
      let needsYou: ClientVideo["needsYou"] = null;
      let line: string;
      if (script === "client_review" && (stage === "script" || stage === "shoot")) {
        needsYou = "script";
        line = "Your script is ready: read it and approve it";
      } else if (last?.status === "client_review") {
        needsYou = "cut";
        line = `Version ${last.number} is ready for you`;
      } else if (stage === "script") line = script === "changes_requested" ? "We're updating the script with your notes" : script === "approved" ? "Script approved, shoot coming up" : "We're writing your script";
      else if (stage === "shoot") line = shootAt ? `Shoot on ${fmt(shootAt)}` : "We're planning the shoot";
      else if (stage === "edit") line = last?.status === "changes_requested" ? "We're making your changes" : "We're editing your video";
      else if (stage === "review") line = last?.status === "changes_requested" ? "We're making your changes" : "In review";
      else if (stage === "approved") line = v.post_at ? `Approved · posting ${fmt(v.post_at)}` : "Approved";
      else line = v.post_at ? `Delivered · posted ${fmt(v.post_at)}` : "Delivered";
      return {
        id: v.id,
        title: v.title,
        status: v.status,
        format: v.format,
        aspect: v.aspect,
        stage,
        line,
        needsYou,
        scriptStatus: script,
        version: last ? { id: last.id, number: last.number, status: last.status, createdAt: last.sent_at ?? last.created_at } : null,
        preview: last ? (previews.get(last.storage_path) ?? null) : null,
        download: last ? (downloads.get(last.storage_path) ?? null) : null,
        shootAt,
        postAt: v.post_at,
        platforms: v.post_platforms ?? [],
        updatedAt: v.updated_at,
      };
    }),
  };
}
