import "server-only";
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

// Google Drive, read-only, through a service account. Footage folders are shared
// with the service account's email; nothing needs to be public. The edit engine
// keeps its own copy of this (engine/src/drive.ts) because it runs outside the app.

type ServiceAccount = { client_email: string; private_key: string };

// GOOGLE_SERVICE_ACCOUNT_KEY holds the key JSON (raw or base64); locally,
// GOOGLE_SERVICE_ACCOUNT_FILE can point at the downloaded key file instead.
function serviceAccount(): ServiceAccount | null {
  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim();
    const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
    const json = raw ? (raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")) : file ? readFileSync(file, "utf8") : null;
    if (!json) return null;
    const key = JSON.parse(json) as ServiceAccount;
    return key.client_email && key.private_key ? key : null;
  } catch {
    return null;
  }
}

export const driveConfigured = () => !!serviceAccount();
export const driveServiceEmail = () => serviceAccount()?.client_email ?? null;

let cached: { token: string; expires: number } | null = null;

async function accessToken() {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const sa = serviceAccount();
  if (!sa) throw new DriveError("Google Drive isn't connected yet.");
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  if (!res.ok) throw new DriveError("Google rejected the Drive service account key.");
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: body.access_token, expires: Date.now() + body.expires_in * 1000 };
  return cached.token;
}

export class DriveError extends Error {}

export type DriveFile = { id: string; name: string; mimeType: string; size: number | null; webViewLink: string | null };

const FIELDS = "id,name,mimeType,size,webViewLink,trashed,shortcutDetails";
const FOLDER = "application/vnd.google-apps.folder";
const SHORTCUT = "application/vnd.google-apps.shortcut";
// Drive labels some camera formats (MXF, MTS) as plain binary, so go by extension too.
const VIDEO_EXT = /\.(mp4|mov|m4v|mxf|mts|m2ts|avi|mkv|webm|braw|r3d|crm)$/i;

type RawFile = { id: string; name: string; mimeType: string; size?: string; webViewLink?: string; trashed?: boolean; shortcutDetails?: { targetId: string } };

async function api<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://www.googleapis.com/drive/v3/${path}`);
  for (const [k, v] of Object.entries({ supportsAllDrives: "true", ...params })) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { authorization: `Bearer ${await accessToken()}` } });
  if (res.status === 404 || res.status === 403) {
    throw new DriveError(`The engine can't see this in Google Drive. Share it with ${driveServiceEmail()} (Viewer is enough).`);
  }
  if (!res.ok) throw new DriveError(`Google Drive returned an error (${res.status}). Try again.`);
  return res.json() as Promise<T>;
}

// Accepts the links Drive hands out for files and folders, or a bare id.
export function parseDriveLink(input: string): string | null {
  const s = input.trim();
  const m =
    s.match(/\/(?:file\/d|folders|document\/d)\/([\w-]{10,})/) ??
    s.match(/[?&]id=([\w-]{10,})/) ??
    s.match(/^([\w-]{20,})$/);
  return m?.[1] ?? null;
}

const toFile = (f: RawFile): DriveFile => ({
  id: f.id,
  name: f.name,
  mimeType: f.mimeType,
  size: f.size ? Number(f.size) : null,
  webViewLink: f.webViewLink ?? null,
});

const isVideo = (f: RawFile) => f.mimeType.startsWith("video/") || VIDEO_EXT.test(f.name);

// The video files behind a link: the file itself, or every video in the folder
// and its subfolders (camera cards nest clips several folders deep).
export async function resolveDriveVideos(id: string, limit = 200): Promise<DriveFile[]> {
  let root = await api<RawFile>(`files/${id}`, { fields: FIELDS });
  if (root.mimeType === SHORTCUT && root.shortcutDetails) root = await api<RawFile>(`files/${root.shortcutDetails.targetId}`, { fields: FIELDS });
  if (root.trashed) throw new DriveError("That item is in the Drive trash.");
  if (root.mimeType !== FOLDER) {
    if (!isVideo(root)) throw new DriveError(`"${root.name}" isn't a video file.`);
    return [toFile(root)];
  }

  const found: DriveFile[] = [];
  const queue: { id: string; depth: number }[] = [{ id: root.id, depth: 0 }];
  while (queue.length && found.length < limit) {
    const folder = queue.shift()!;
    let pageToken: string | undefined;
    do {
      const page = await api<{ files: RawFile[]; nextPageToken?: string }>("files", {
        q: `'${folder.id}' in parents and trashed = false`,
        fields: `nextPageToken,files(${FIELDS})`,
        pageSize: "1000",
        orderBy: "name",
        includeItemsFromAllDrives: "true",
        ...(pageToken ? { pageToken } : {}),
      });
      for (const f of page.files) {
        if (f.mimeType === FOLDER && folder.depth < 5) queue.push({ id: f.id, depth: folder.depth + 1 });
        else if (isVideo(f)) found.push(toFile(f));
      }
      pageToken = page.nextPageToken;
    } while (pageToken && found.length < limit);
  }
  return found.slice(0, limit);
}
