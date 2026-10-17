// Footage that lives in Google Drive. Camera files are often tens of gigabytes, more
// than this machine has free, so the original never lands on disk: ffmpeg reads it
// from Drive and writes a smaller working copy (4K at most, high quality) that the
// rest of the engine uses. Working copies are cached so revisions don't fetch again.
//
// Mirrors the app's src/lib/drive.ts for the service-account handshake; the engine
// runs outside the app, so it keeps its own copy.

import { spawn } from "node:child_process";
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readdir, rename, rm, stat, utimes } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { config } from "./config.ts";
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

async function driveMeta(id: string): Promise<DriveMeta> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true&fields=id,name,size,md5Checksum,modifiedTime`,
    { headers: { authorization: `Bearer ${await accessToken()}` } },
  );
  if (res.status === 404 || res.status === 403) {
    throw new Error(`The engine can't open a footage file in Google Drive any more. Check it's still shared with ${serviceAccount()?.client_email}.`);
  }
  if (!res.ok) throw new Error(`Google Drive returned an error (${res.status}) for a footage file.`);
  return res.json() as Promise<DriveMeta>;
}

// A localhost relay that adds a fresh token to every request. ffmpeg seeks around
// camera files with range requests, and a long fetch outlives one token (an hour).
async function relay(id: string) {
  const media = `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`;
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

function transcode(input: string, output: string, duration: number, onProgress: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const ff = spawn(config.ffmpeg, [
      "-v", "error", "-nostats", "-y",
      "-reconnect", "1", "-reconnect_on_network_error", "1", "-reconnect_on_http_error", "5xx", "-reconnect_delay_max", "30",
      "-i", input,
      "-map", "0:v:0", "-map", "0:a:0?",
      // Long side capped at 3840: enough for 9:16 crops and punch-ins from 4K.
      "-vf", "scale='if(gte(iw,ih),min(3840,iw),-2)':'if(gte(iw,ih),-2,min(3840,ih))'",
      ...ENCODE, "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k",
      "-progress", "pipe:1",
      output,
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

// The working copy of a Drive file, made on first use. Keyed by the file's checksum,
// so replacing the file in Drive makes a fresh copy.
export async function driveWorkingCopy(id: string, onProgress: (fraction: number) => void = () => {}) {
  const meta = await driveMeta(id);
  const version = (meta.md5Checksum ?? meta.modifiedTime ?? "v").replace(/[^\w]/g, "").slice(0, 16);
  await mkdir(config.cacheDir, { recursive: true });
  const file = path.join(config.cacheDir, `${id}-${version}-${COPY_VERSION}.mp4`);
  try {
    await stat(file);
    const now = new Date();
    await utimes(file, now, now); // mark as recently used
    return { file, name: meta.name, cached: true };
  } catch {
    // not cached yet
  }

  const source = await relay(id);
  try {
    await workingCopy(source.url, file, onProgress);
  } finally {
    await source.close();
  }
  return { file, name: meta.name, cached: false };
}

// Streams `input` (a URL or file) into a working copy at `output`, atomically.
export async function workingCopy(input: string, output: string, onProgress: (fraction: number) => void = () => {}) {
  const partial = `${output}.partial.mp4`;
  try {
    const { duration } = await probe(input);
    await transcode(input, partial, duration, onProgress);
    await rename(partial, output);
  } catch (err) {
    await rm(partial, { force: true });
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
