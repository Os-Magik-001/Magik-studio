import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.ts";
import { exists, run } from "./exec.ts";

export type TranscriptLine = { start: number; end: number; text: string };

let available: boolean | null = null;

// Optional: with whisper.cpp installed and WHISPER_CPP_MODEL set, Claude also
// reads what's said in each clip. Without it, Claude edits from the picture.
export async function transcriptionAvailable() {
  if (available === null) available = !!config.whisperModel && (await exists(config.whisperBin));
  return available;
}

// `hint` primes Whisper with names and terms it would otherwise mishear (the client,
// product names from the script).
export async function transcribe(file: string, workDir: string, hint?: string): Promise<TranscriptLine[] | null> {
  if (!(await transcriptionAvailable())) return null;
  const base = path.join(workDir, path.basename(file) + ".speech");
  await run(config.ffmpeg, ["-v", "error", "-y", "-i", file, "-vn", "-ac", "1", "-ar", "16000", `${base}.wav`]);
  // Short, word-aligned segments give phrase-level timing for cuts and captions.
  const args = ["-m", config.whisperModel!, "-f", `${base}.wav`, "-l", config.whisperLanguage, "-ml", "48", "-sow", "-oj", "-of", base, "-np"];
  if (config.whisperVadModel) args.push("--vad", "-vm", config.whisperVadModel);
  if (hint) args.push("--prompt", hint.slice(0, 600));
  await run(config.whisperBin, args);
  const json = JSON.parse(await readFile(`${base}.json`, "utf8")) as {
    transcription?: { offsets: { from: number; to: number }; text: string }[];
  };
  return (json.transcription ?? [])
    .map((s) => ({ start: s.offsets.from / 1000, end: s.offsets.to / 1000, text: s.text.trim() }))
    .filter((s) => s.text && !/^\[.*\]$/.test(s.text));
}
