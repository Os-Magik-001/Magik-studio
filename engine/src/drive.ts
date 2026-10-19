// Footage that lives in Google Drive, turned into a smaller working copy (4K at most,
// high quality) that the rest of the engine uses. A file that fits on disk with room to
// spare is downloaded first, in parallel byte ranges: ffmpeg reading a camera MP4 straight
// from Drive jumps between its sound and picture, and every jump opened a new connection
// (0.3 MB/s on Canon files, against 3+ MB/s for a plain download). Camera files of tens of
// gigabytes, more than this machine has free, never land on disk: ffmpeg reads them from
// Drive. Working copies are cached so revisions don't fetch again.
//
// Mirrors the app's src/lib/drive.ts for the service-account handshake; the engine
// runs outside the app, so it keeps its own copy.

import { spawn } from "node:child_process";
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, open, readdir, rename, rm, stat, statfs, utimes } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { config } from "./config.ts";
import { run } from "./exec.ts";
import { probe } from "./media.ts";

type ServiceAccount = { client_email: string; private_key: string };

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

let cached: { token: string; expires: number } | null = null;

async function accessToken() {
  if (cached && cached.expires > Date.now() + 120_000) return cached.token;
  const sa = serviceAccount();
  if (!sa) throw new Error("This footage is in Google Drive, but the engine has no Google service account key (GOOGLE_SERVICE_ACCOUNT_FILE).");
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
  if (!res.ok) throw new Error("Google rejected the engine's Drive service account key.");
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: body.access_token, expires: Date.now() + body.expires_in * 1000 };
  return cached.token;
}

type DriveMeta = { id: string; name: string; size?: string; md5Checksum?: string; modifiedTime?: string };

// `what` names the file in errors: footage, a reference video.
export async function driveMeta(id: string, what = "footage file"): Promise<DriveMeta> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true&fields=id,name,size,md5Checksum,modifiedTime`,
    { headers: { authorization: `Bearer ${await accessToken()}` } },
  );
  if (res.status === 404 || res.status === 403) {
    throw new Error(`The engine can't open a ${what} in Google Drive. Check it's shared with ${serviceAccount()?.client_email}.`);
  }
  if (!res.ok) throw new Error(`Google Drive returned an error (${res.status}) for a ${what}.`);
  return res.json() as Promise<DriveMeta>;
}

const mediaUrl = (id: string) => `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`;

// Errors that another try won't fix (no access, gone): everything else is retried.
class Permanent extends Error {}

// Downloads `size` bytes of `url` into `out` in parallel byte ranges, each retried on
// its own, so a dropped connection doesn't restart a 700 MB file.
export async function downloadRanges(
  url: string,
  headers: () => Promise<Record<string, string>>,
  size: number,
  out: string,
  onProgress: (fraction: number) => void = () => {},
  { chunk = 16 * 1024 ** 2, parallel = 4, retryMs = 2000 } = {},
) {
  const file = await open(out, "w");
  const stop = new AbortController();
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < size && !stop.signal.aborted) {
      const start = next;
      const end = Math.min(size, start + chunk) - 1;
      next = end + 1;
      for (let attempt = 1; ; attempt++) {
        try {
          const res = await fetch(url, {
            headers: { ...(await headers()), range: `bytes=${start}-${end}` },
            signal: AbortSignal.any([stop.signal, AbortSignal.timeout(120_000)]),
          });
          if (res.status !== 206) {
            await res.body?.cancel();
            const message = `Google Drive returned ${res.status} while downloading the footage.`;
            throw res.status === 429 || res.status >= 500 ? new Error(message) : new Permanent(message);
          }
          const bytes = Buffer.from(await res.arrayBuffer());
          if (bytes.length !== end - start + 1) throw new Error("Google Drive cut a download short.");
          await file.write(bytes, 0, bytes.length, start);
          done += bytes.length;
          onProgress(done / size);
          break;
        } catch (err) {
          if (stop.signal.aborted || err instanceof Permanent || attempt >= 4) throw err;
          await new Promise((r) => setTimeout(r, attempt * retryMs));
        }
      }
    }
  };
  // The first error is the one to report: the others are the downloads it stopped.
  let failure: unknown = null;
  try {
    await Promise.all(
      Array.from({ length: parallel }, () =>
        worker().catch((err) => {
          failure ??= err;
          stop.abort();
        }),
      ),
    );
  } finally {
    await file.close();
  }
  if (failure) throw failure;
}

// A localhost relay that adds a fresh token to every request. ffmpeg seeks around
// camera files with range requests, and a long fetch outlives one token (an hour).
async function relay(id: string) {
  const media = mediaUrl(id);
  const server = http.createServer(async (req, res) => {
    const abort = new AbortController();
    res.on("close", () => abort.abort());
    try {
      const headers: Record<string, string> = { authorization: `Bearer ${await accessToken()}` };
      if (req.headers.range) headers.range = req.headers.range;
      const upstream = await fetch(media, { headers, signal: abort.signal });
      const pass: Record<string, string> = {};
      for (const h of ["content-length", "content-range", "accept-ranges", "content-type"]) {
        const v = upstream.headers.get(h);
        if (v) pass[h] = v;
      }
      res.writeHead(upstream.status, pass);
      if (req.method === "HEAD" || !upstream.body) return void res.end();
      await pipeline(Readable.fromWeb(upstream.body as never), res);
    } catch {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/media`, close: () => new Promise<void>((r) => server.close(() => r())) };
}

// Hardware HEVC on a Mac keeps 4K small and fast; elsewhere, high-quality H.264.
// q 70 keeps skin and hair texture (about 25 Mbps for 4K); q 58 measured 3 Mbps
// and smeared faces, which punch-ins then magnify.
const ENCODE =
  process.platform === "darwin"
    ? ["-c:v", "hevc_videotoolbox", "-q:v", "70", "-tag:v", "hvc1"]
    : ["-c:v", "libx264", "-preset", "veryfast", "-crf", "19"];
// Part of every cached file name: bump it when ENCODE changes so old copies aren't reused.
const COPY_VERSION = "q70";

// The same pass also writes a small preview copy (960 px, 10 fps) for contact sheets
// and transcription: decoding the 4K copy again for those took minutes.
const PREVIEW = "scale='if(gte(iw,ih),960,-2)':'if(gte(iw,ih),-2,960)',fps=10";
const PREVIEW_ENCODE = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "28", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k"];

// A Drive file's bytes (music tracks the studio keeps in Drive).
export async function fetchDriveFile(id: string) {
  return fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`, {
    headers: { authorization: `Bearer ${await accessToken()}` },
    signal: AbortSignal.timeout(5 * 60_000),
  });
}

export const previewOf = (file: string) => file.replace(/\.mp4$/, ".preview.mp4");

function transcode(input: string, output: string, preview: string, duration: number, onProgress: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const ff = spawn(config.ffmpeg, [
      "-v", "error", "-nostats", "-y",
      // ffmpeg refuses these on a file on disk.
      ...(/^https?:/.test(input) ? ["-reconnect", "1", "-reconnect_on_network_error", "1", "-reconnect_on_http_error", "5xx", "-reconnect_delay_max", "30"] : []),
      "-i", input,
      // Long side capped at 3840: enough for 9:16 crops and punch-ins from 4K.
      "-filter_complex", `[0:v:0]split=2[h][l];[h]scale='if(gte(iw,ih),min(3840,iw),-2)':'if(gte(iw,ih),-2,min(3840,ih))'[hq];[l]${PREVIEW}[lo]`,
      "-progress", "pipe:1",
      "-map", "[hq]", "-map", "0:a:0?", ...ENCODE, "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", output,
      "-map", "[lo]", "-map", "0:a:0?", ...PREVIEW_ENCODE, preview,
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    ff.stderr.on("data", (d) => (err = (err + d).slice(-4000)));
    ff.stdout.on("data", (d: Buffer) => {
      const m = d.toString().match(/out_time_us=(\d+)/g)?.at(-1);
      if (m && duration > 0) onProgress(Math.min(1, Number(m.split("=")[1]) / 1e6 / duration));
    });
    ff.on("error", (e) => reject(new Error(`ffmpeg could not start: ${e.message}`)));
    ff.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`Couldn't read the footage from Google Drive: ${err.trim().split("\n").slice(-3).join(" | ")}`)),
    );
  });
}

// Every video file behind a Drive link: the file itself, or a folder's videos (and its subfolders').
export function listDriveVideos(id: string): Promise<{ id: string; name: string }[]> {
  return listDriveFiles(id, (f) => f.mimeType.startsWith("video/") || /\.(mp4|mov|m4v|mxf|mts|avi|mkv)$/i.test(f.name));
}

// Every file behind a Drive link that `keep` accepts: the file itself, or a folder's files (and its subfolders').
export async function listDriveFiles(id: string, keep: (f: { name: string; mimeType: string }) => boolean, limit = 500): Promise<{ id: string; name: string; parent: string }[]> {
  const get = async (q: string) => {
    const res = await fetch(`https://www.googleapis.com/drive/v3/${q}`, { headers: { authorization: `Bearer ${await accessToken()}` } });
    if (!res.ok) throw new Error(`Google Drive returned ${res.status}: share the footage with ${serviceAccount()?.client_email}.`);
    return res.json();
  };
  const root = await get(`files/${id}?supportsAllDrives=true&fields=id,name,mimeType`);
  if (root.mimeType !== "application/vnd.google-apps.folder") return keep(root) ? [{ id: root.id, name: root.name, parent: "" }] : [];
  const out: { id: string; name: string; parent: string }[] = [];
  const queue = [{ id: root.id as string, name: root.name as string }];
  while (queue.length && out.length < limit) {
    const folder = queue.shift()!;
    const page = await get(`files?q=${encodeURIComponent(`'${folder.id}' in parents and trashed = false`)}&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=1000&orderBy=name&fields=files(id,name,mimeType)`);
    for (const f of page.files) {
      if (f.mimeType === "application/vnd.google-apps.folder") queue.push({ id: f.id, name: f.name });
      else if (keep(f)) out.push({ id: f.id, name: f.name, parent: folder.name });
    }
  }
  return out;
}

// The working copy of a Drive file, made on first use. Keyed by the file's checksum,
// so replacing the file in Drive makes a fresh copy.
export async function driveWorkingCopy(id: string, onProgress: (fraction: number) => void = () => {}) {
  const meta = await driveMeta(id);
  const version = (meta.md5Checksum ?? meta.modifiedTime ?? "v").replace(/[^\w]/g, "").slice(0, 16);
  await mkdir(config.cacheDir, { recursive: true });
  const file = path.join(config.cacheDir, `${id}-${version}-${COPY_VERSION}.mp4`);
  if (await stat(file).catch(() => null)) {
    // Copies cached before previews existed get one made from the copy (slower, once).
    if (!(await stat(previewOf(file)).catch(() => null))) await makePreview(file);
    const now = new Date();
    await utimes(file, now, now); // mark as recently used
    await utimes(previewOf(file), now, now);
    return { file, preview: previewOf(file), name: meta.name, cached: true };
  }

  const size = Number(meta.size ?? 0);
  if (size > 0 && size + DISK_MARGIN < (await freeBytes())) {
    const original = `${file}.source`;
    try {
      const headers = async () => ({ authorization: `Bearer ${await accessToken()}` });
      await downloadRanges(mediaUrl(id), headers, size, original, (f) => onProgress(f * DOWNLOAD_SHARE));
      await workingCopy(original, file, (f) => onProgress(DOWNLOAD_SHARE + f * (1 - DOWNLOAD_SHARE)));
    } finally {
      await rm(original, { force: true });
    }
    return { file, preview: previewOf(file), name: meta.name, cached: false };
  }

  const source = await relay(id);
  try {
    await workingCopy(source.url, file, onProgress);
  } finally {
    await source.close();
  }
  return { file, preview: previewOf(file), name: meta.name, cached: false };
}

// Room an original must leave on disk to be downloaded; bigger files stream from Drive.
const DISK_MARGIN = 5 * 1024 ** 3;
// How much of a file's progress is the download (the rest is making the working copy).
const DOWNLOAD_SHARE = 0.75;

async function freeBytes() {
  const s = await statfs(config.cacheDir);
  return s.bavail * s.bsize;
}

async function makePreview(file: string) {
  const partial = `${previewOf(file)}.partial.mp4`;
  try {
    await run(config.ffmpeg, ["-v", "error", "-y", "-i", file, "-map", "0:v:0", "-map", "0:a:0?", "-vf", PREVIEW, ...PREVIEW_ENCODE, partial]);
    await rename(partial, previewOf(file));
  } catch (err) {
    await rm(partial, { force: true });
    throw err;
  }
}

// Streams `input` (a URL or file) into a working copy at `output`, atomically.
export async function workingCopy(input: string, output: string, onProgress: (fraction: number) => void = () => {}) {
  const partial = `${output}.partial.mp4`;
  const partialPreview = `${previewOf(output)}.partial.mp4`;
  try {
    const { duration } = await probe(input);
    await transcode(input, partial, partialPreview, duration, onProgress);
    await rename(partialPreview, previewOf(output));
    await rename(partial, output);
  } catch (err) {
    await rm(partial, { force: true });
    await rm(partialPreview, { force: true });
    throw err;
  }
}

// Keeps the cache under ENGINE_CACHE_GB, dropping the least recently used copies.
export async function pruneCache(keep: Set<string>) {
  const entries = await readdir(config.cacheDir).catch(() => [] as string[]);
  const files = await Promise.all(
    entries.map(async (name) => {
      const file = path.join(config.cacheDir, name);
      const s = await stat(file);
      return { file, size: s.size, used: s.mtimeMs };
    }),
  );
  let total = files.reduce((n, f) => n + f.size, 0);
  for (const f of files.sort((a, b) => a.used - b.used)) {
    if (total <= config.cacheBytes) break;
    if (keep.has(f.file)) continue;
    await rm(f.file, { force: true });
    total -= f.size;
  }
}
