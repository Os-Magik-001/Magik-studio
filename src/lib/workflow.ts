import type { Database } from "@/lib/database.types";

type Enums = Database["public"]["Enums"];
export type VideoStatus = Enums["video_status"];
export type ScriptStatus = Enums["script_status"];
export type VersionStatus = Enums["version_status"];
export type VideoFormat = Enums["video_format"];

// Script → Shoot → Footage in → Editing → Editor check → Client review → Approved → Delivered
export const VIDEO_STATUSES: { value: VideoStatus; label: string }[] = [
  { value: "script", label: "Script" },
  { value: "shoot", label: "Shoot" },
  { value: "footage_in", label: "Footage in" },
  { value: "editing", label: "Editing" },
  { value: "editor_check", label: "Editor check" },
  { value: "client_review", label: "Client review" },
  { value: "approved", label: "Approved" },
  { value: "delivered", label: "Delivered" },
];

export const videoStatusLabel = (s: VideoStatus) =>
  VIDEO_STATUSES.find((x) => x.value === s)?.label ?? s;

export const videoStatusIndex = (s: VideoStatus) =>
  VIDEO_STATUSES.findIndex((x) => x.value === s);

export const SCRIPT_STATUS_LABEL: Record<ScriptStatus, string> = {
  draft: "Draft",
  client_review: "Waiting for client",
  changes_requested: "Changes requested",
  approved: "Approved",
};

export const VERSION_STATUS_LABEL: Record<VersionStatus, string> = {
  draft: "Editor check",
  fixes_requested: "Fixes requested",
  client_review: "With client",
  changes_requested: "Changes requested",
  approved: "Approved",
};

export const FORMAT_LABEL: Record<VideoFormat, string> = {
  social_short: "Social short",
  ad: "Ad",
  podcast_clip: "Podcast clip",
};

export const ASPECTS = ["9:16", "1:1", "16:9"] as const;

export const ROLE_LABEL = {
  admin: "Studio manager",
  editor: "Editor",
  videographer: "Videographer",
  client: "Client",
} as const;

export function formatTimecode(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const f = Math.floor((ms % 1000) / 100);
  return `${m}:${String(s).padStart(2, "0")}.${f}`;
}

export function formatBytes(n: number | null | undefined) {
  if (!n) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export type ShotItem = { text: string; done?: boolean };

export function parseShotList(value: unknown): ShotItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => (typeof x === "string" ? { text: x } : x))
    .filter((x): x is ShotItem => !!x && typeof x.text === "string");
}
