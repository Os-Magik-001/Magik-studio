import { createWriteStream } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
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

// Every video the engine writes is tagged as HD colour (BT.709, TV range). Without the
// primaries and transfer tags, Safari and QuickTime show it differently from Chrome, and
// ffmpeg reads it back two or three levels darker: a freeze frame, a cut-out or a design
// frame taken from the cut then sat darker than the picture around it.
export const BT709 = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"];

// Exact colour conversion. ffmpeg's fast YUV-to-RGB path is off by two levels (up to four in
// the shadows) on 1080-wide frames, our reel width, so looks, cards, cut-outs, freeze frames
// and design frames came out darker than the picture they sit in. As `-sws_flags` for a
// simple command; a complex graph needs it as its first line (`sws_flags=…;`).
export const SWS = "bicubic+accurate_rnd+full_chroma_int";

// A clip whose colour tags are blank is read as HD video, like the tagged clips around it:
// a setparams filter to put first on its stream, or "" when there is nothing to fill (fully
// tagged, HDR, or an SD or other matrix, which stay as they are).
export async function fillColorTags(file: string) {
  const { stdout } = await run(config.ffprobe, [
    "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,color_space,color_transfer,color_primaries", "-of", "json", file,
  ]);
  const s = (JSON.parse(stdout) as { streams?: { width?: number; height?: number; color_space?: string; color_transfer?: string; color_primaries?: string }[] }).streams?.[0] ?? {};
  const blank = (v?: string) => !v || v === "unknown" || v === "unspecified";
  const matrix = blank(s.color_space) ? (Math.min(s.width ?? 0, s.height ?? 0) >= 720 ? "bt709" : null) : s.color_space;
  if (matrix !== "bt709" || /arib-std-b67|smpte2084/.test(s.color_transfer ?? "")) return "";
  const fill = [
    blank(s.color_space) && "colorspace=bt709",
    blank(s.color_primaries) && "color_primaries=bt709",
    blank(s.color_transfer) && "color_trc=bt709",
  ].filter(Boolean);
  return fill.length ? `setparams=${fill.join(":")},` : "";
}

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

// A copy of `file` at `out` that is at most `maxBytes`: the picture encoded again at the
// bitrate that fits (two passes, so it lands just under), the sound kept as it is.
// Storage on Supabase's free plan takes files up to 50 MB.
export async function fitUnder(file: string, out: string, maxBytes: number) {
  const { duration } = await probe(file);
  const { stdout } = await run(config.ffprobe, ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=bit_rate", "-of", "csv=p=0", file]);
  const audio = Number(stdout.trim()) || 192_000;
  // 4% for the container and the encoder's aim.
  const video = Math.floor(((maxBytes * 8) / duration) * 0.96 - audio);
  if (video < 500_000) throw new Error(`The draft is too long to fit the ${Math.round(maxBytes / 1e6)} MB upload limit.`);
  const passlog = `${out}.pass`;
  // No colour options here: the draft's BT.709 tags carry over by themselves, and naming them
  // throws a two-pass encode's aim off (a 1.4 MB target came out at 2.2 MB).
  const encode = ["-v", "error", "-y", "-i", file, "-c:v", "libx264", "-preset", "veryfast", "-b:v", String(video), "-pix_fmt", "yuv420p", "-passlogfile", passlog];
  try {
    await run(config.ffmpeg, [...encode, "-pass", "1", "-an", "-f", "null", "-"]);
    await run(config.ffmpeg, [...encode, "-pass", "2", "-c:a", "copy", "-movflags", "+faststart", out]);
  } finally {
    for (const f of await readdir(path.dirname(out))) if (f.startsWith(path.basename(passlog))) await rm(path.join(path.dirname(out), f), { force: true });
  }
  const { size } = await stat(out);
  if (size > maxBytes) throw new Error(`The draft is still ${(size / 1e6).toFixed(1)} MB after encoding it again, over the ${Math.round(maxBytes / 1e6)} MB upload limit.`);
  return out;
}

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

// A clip's integrated loudness (LUFS; gated, so silences don't pull it down), or null
// when it has no measurable sound. Measured once per file.
const loudness = new Map<string, Promise<number | null>>();
export function clipLoudness(file: string) {
  if (!loudness.has(file)) {
    loudness.set(
      file,
      run(config.ffmpeg, ["-hide_banner", "-i", file, "-vn", "-af", "loudnorm=print_format=json", "-f", "null", "-"]).then(
        ({ stderr }) => {
          const i = Number(stderr.match(/"input_i"\s*:\s*"(-?[\d.]+)"/)?.[1]);
          return Number.isFinite(i) && i > -60 ? i : null;
        },
        () => null,
      ),
    );
  }
  return loudness.get(file)!;
}
