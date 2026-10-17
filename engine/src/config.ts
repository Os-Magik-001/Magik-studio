import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/database.types.ts";

function required(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(`Missing environment variable ${names.join(" or ")}`);
}

export const config = {
  supabaseUrl: required("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  secretKey: required("SUPABASE_SECRET_KEY"),
  workDir: process.env.ENGINE_WORK_DIR ?? path.join(os.tmpdir(), "magik-engine"),
  // Working copies of Google Drive footage, kept between jobs so revisions don't fetch again.
  cacheDir: process.env.ENGINE_CACHE_DIR ?? path.join(os.tmpdir(), "magik-engine-cache"),
  cacheBytes: Number(process.env.ENGINE_CACHE_GB ?? 20) * 1024 ** 3,
  pollMs: Number(process.env.ENGINE_POLL_MS ?? 10_000),
  ffmpeg: process.env.FFMPEG_PATH ?? "ffmpeg",
  ffprobe: process.env.FFPROBE_PATH ?? "ffprobe",
  // Optional speech-to-text with whisper.cpp: path to a ggml model file.
  whisperModel: process.env.WHISPER_CPP_MODEL ?? null,
  whisperBin: process.env.WHISPER_CPP_BIN ?? "whisper-cli",
  // Spoken language, or "auto" to detect it per clip.
  whisperLanguage: process.env.WHISPER_LANGUAGE ?? "auto",
  // Optional Silero VAD model: skips silence and music, where Whisper invents words.
  whisperVadModel: process.env.WHISPER_VAD_MODEL ?? null,
  model: process.env.ENGINE_MODEL ?? "claude-opus-5-5",
  // Hard cap on how much footage one job may send to Claude, in frames.
  maxFrames: Number(process.env.ENGINE_MAX_FRAMES ?? 216),
};

// Service-role client: the engine runs trusted, outside any user session.
export const db = createClient<Database>(config.supabaseUrl, config.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type Tables = Database["public"]["Tables"];
