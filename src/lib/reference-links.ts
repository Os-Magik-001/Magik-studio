// Reference videos: the links the studio pastes ("make it like this"), what it wants from each,
// and where each link comes from. Shared by the forms and the server.

export type ReferencePlatform = "instagram" | "tiktok" | "youtube" | "vimeo" | "drive" | "file" | "other";

export const PLATFORM_LABEL: Record<ReferencePlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  vimeo: "Vimeo",
  drive: "Google Drive",
  file: "Video file",
  other: "Link",
};

// The engine downloads and watches these. YouTube and Vimeo don't allow downloads: the agents
// get their title and the studio's note.
export const WATCHABLE: ReferencePlatform[] = ["instagram", "tiktok", "drive", "file", "other"];

export const REFERENCE_FOCUS = [
  { value: "hook", label: "Hook" },
  { value: "structure", label: "Structure" },
  { value: "script", label: "Script & tone" },
  { value: "pacing", label: "Pacing & cuts" },
  { value: "text", label: "Captions & text" },
  { value: "graphics", label: "Graphics & transitions" },
  { value: "sound", label: "Music & sound" },
  { value: "look", label: "Look & camera" },
] as const;

export const focusLabel = (value: string) => REFERENCE_FOCUS.find((f) => f.value === value)?.label ?? value;

const VIDEO_FILE = /\.(mp4|mov|m4v|webm)$/i;

// A pasted link as the engine reads it: the canonical address (no tracking parameters) and its
// platform, or why it can't be a reference.
export function parseReferenceLink(input: string): { url: string; platform: ReferencePlatform } | { error: string } {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return { error: "That isn't a link. Paste the reel's or video's address (https://…)." };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { error: "The link should start with https://" };
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const parts = u.pathname.split("/").filter(Boolean);

  if (host === "instagram.com" || host === "instagr.am") {
    const at = parts.findIndex((p) => ["p", "reel", "reels", "tv"].includes(p));
    const code = at >= 0 ? parts[at + 1] : undefined;
    if (!code || !/^[\w-]{5,}$/.test(code)) return { error: "Link one reel or post (instagram.com/reel/…), not a profile or a page." };
    return { url: `https://www.instagram.com/reel/${code}/`, platform: "instagram" };
  }
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
    // Short links (vm.tiktok.com/…, tiktok.com/t/…) stay as they are: the scraper follows them.
    const video = parts.findIndex((p) => p === "video" || p === "photo");
    if (video > 0 && /^\d+$/.test(parts[video + 1] ?? "") && parts[video - 1]?.startsWith("@")) {
      return { url: `https://www.tiktok.com/${parts[video - 1]}/${parts[video]}/${parts[video + 1]}`, platform: "tiktok" };
    }
    if (host === "vm.tiktok.com" || host === "vt.tiktok.com" || parts[0] === "t") return { url: `https://${host}${u.pathname}`, platform: "tiktok" };
    return { error: "Link one TikTok video (tiktok.com/@account/video/…), not a profile." };
  }
  if (host === "youtube.com" || host === "youtu.be" || host === "music.youtube.com") {
    const id = host === "youtu.be" ? parts[0] : parts[0] === "shorts" || parts[0] === "live" ? parts[1] : u.searchParams.get("v");
    if (!id || !/^[\w-]{6,}$/.test(id)) return { error: "Link one YouTube video, not a channel or a playlist." };
    return { url: parts[0] === "shorts" ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`, platform: "youtube" };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = parts.find((p) => /^\d+$/.test(p));
    if (!id) return { error: "Link one Vimeo video." };
    return { url: `https://vimeo.com/${id}`, platform: "vimeo" };
  }
  if (host === "drive.google.com" || host === "docs.google.com") {
    if (parts.includes("folders")) return { error: "Link the video file itself, not a folder (right-click the file → Share → Copy link)." };
    const id = parts[0] === "file" && parts[1] === "d" ? parts[2] : u.searchParams.get("id");
    if (!id || !/^[\w-]{10,}$/.test(id)) return { error: "That doesn't look like a Google Drive file link." };
    return { url: `https://drive.google.com/file/d/${id}/view`, platform: "drive" };
  }
  // A direct link to a file keeps its query: signed links need it.
  if (VIDEO_FILE.test(u.pathname)) return { url: u.toString(), platform: "file" };
  return { url: u.toString(), platform: "other" };
}
