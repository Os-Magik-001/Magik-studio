import { createWriteStream } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { config, db } from "./config.ts";
import { run } from "./exec.ts";

export type Probe = {
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasVideo: boolean;
  hasAudio: boolean;
};

export async function download(bucket: string, objectPath: string, dest: string) {
  const { data, error } = await db.storage.from(bucket).createSignedUrl(objectPath, 60 * 60);
  if (error || !data) throw new Error(`Couldn't open ${bucket}/${objectPath}: ${error?.message}`);
  const res = await fetch(data.signedUrl);
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}) for ${objectPath}`);
  await mkdir(path.dirname(dest), { recursive: true });
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
}

export async function probe(file: string): Promise<Probe> {
  const { stdout } = await run(config.ffprobe, [
    "-v", "error", "-print_format", "json", "-show_format", "-show_streams", file,
  ]);
  const info = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: {
      codec_type: string;
      width?: number;
      height?: number;
      avg_frame_rate?: string;
      duration?: string;
      side_data_list?: { rotation?: number }[];
      tags?: { rotate?: string };
    }[];
  };
  const video = info.streams?.find((s) => s.codec_type === "video");
  const audio = info.streams?.find((s) => s.codec_type === "audio");
  const rotation = Math.abs(
    Number(video?.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? video?.tags?.rotate ?? 0),
  );
  const [num, den] = (video?.avg_frame_rate ?? "30/1").split("/").map(Number);
  // ffmpeg auto-rotates when decoding, so report the size people actually see.
  const sideways = rotation === 90 || rotation === 270;
  return {
    duration: Number(info.format?.duration ?? video?.duration ?? 0),
    width: (sideways ? video?.height : video?.width) ?? 0,
    height: (sideways ? video?.width : video?.height) ?? 0,
    fps: den ? num / den : 30,
    hasVideo: !!video,
    hasAudio: !!audio,
  };
}

// Output frame size for each aspect ratio the studio delivers.
const FRAME_SIZES: Record<string, [number, number]> = {
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
  "16:9": [1920, 1080],
};
export const frameSize = (aspect: string) => FRAME_SIZES[aspect] ?? FRAME_SIZES["9:16"];

export const SHEET_COLS = 3;
export const SHEET_ROWS = 3;
const CELL = 360;

// Contact sheets are how Claude watches footage: frames every `interval`
// seconds, 9 per image, read left to right, top to bottom.
export async function contactSheets(file: string, outDir: string, interval: number) {
  await mkdir(outDir, { recursive: true });
  await run(config.ffmpeg, [
    "-v", "error", "-y", "-i", file,
    "-vf",
    [
      `fps=1/${interval}`,
      `scale=${CELL}:${CELL}:force_original_aspect_ratio=decrease`,
      `pad=${CELL}:${CELL}:(ow-iw)/2:(oh-ih)/2:color=black`,
      `tile=${SHEET_COLS}x${SHEET_ROWS}:padding=6:margin=6:color=white`,
    ].join(","),
    "-q:v", "5",
    path.join(outDir, "sheet_%03d.jpg"),
  ]);
  const files = (await readdir(outDir)).filter((f) => f.startsWith("sheet_")).sort();
  return files.map((f) => path.join(outDir, f));
}
