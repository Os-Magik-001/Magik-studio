import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.ts";
import { exists, run } from "./exec.ts";

export type Word = { start: number; end: number; text: string };
export type TranscriptLine = { start: number; end: number; text: string; words: Word[] };

let available: boolean | null = null;

// Optional: with whisper.cpp installed and WHISPER_CPP_MODEL set, Claude also
// reads what's said in each clip. Without it, Claude edits from the picture.
export async function transcriptionAvailable() {
  if (available === null) available = !!config.whisperModel && (await exists(config.whisperBin));
  return available;
}

// Word timing comes from whisper.cpp's DTW alignment, which needs the preset that
// matches the model (and flash attention off).
function dtwPreset(model: string) {
  const name = path.basename(model).toLowerCase();
  if (name.includes("large-v3-turbo")) return "large.v3.turbo";
  for (const size of ["large-v3", "large-v2", "large-v1", "medium", "small", "base", "tiny"]) {
    if (name.includes(size)) return size.replace("-", ".") + (name.includes(".en") && !size.startsWith("large") ? ".en" : "");
  }
  return null;
}

type Token = { text: string; offsets: { from: number; to: number }; t_dtw?: number };
type Segment = { offsets: { from: number; to: number }; text: string; tokens?: Token[] };

// Tokens are word pieces: a leading space starts a new word, anything else (", 'm,
// ista) belongs to the word before it.
export function wordsOf(segment: Segment): Word[] {
  const end = segment.offsets.to / 1000;
  const words: { start: number; text: string }[] = [];
  for (const t of segment.tokens ?? []) {
    if (t.text.startsWith("[_") || !t.text.trim()) continue;
    const at = t.t_dtw !== undefined && t.t_dtw >= 0 ? t.t_dtw / 100 : t.offsets.from / 1000;
    if (t.text.startsWith(" ") || words.length === 0) words.push({ start: at, text: t.text.trim() });
    else words[words.length - 1].text += t.text;
  }
  return words
    .map((w, i) => ({ start: w.start, end: Math.min(words[i + 1]?.start ?? end, w.start + 1.5), text: w.text }))
    .filter((w) => /[\p{L}\p{N}]/u.test(w.text));
}

// `hint` primes Whisper with names and terms it would otherwise mishear (the client,
// product names from the script).
export async function transcribe(file: string, workDir: string, hint?: string): Promise<TranscriptLine[] | null> {
  if (!(await transcriptionAvailable())) return null;
  const base = path.join(workDir, path.basename(file) + ".speech");
  await run(config.ffmpeg, ["-v", "error", "-y", "-i", file, "-vn", "-ac", "1", "-ar", "16000", `${base}.wav`]);
  // Short, word-aligned segments give phrase-level lines; the full JSON adds per-word timing.
  const args = ["-m", config.whisperModel!, "-f", `${base}.wav`, "-l", config.whisperLanguage, "-ml", "48", "-sow", "-ojf", "-of", base, "-np"];
  const dtw = dtwPreset(config.whisperModel!);
  if (dtw) args.push("-nfa", "--dtw", dtw);
  if (config.whisperVadModel) args.push("--vad", "-vm", config.whisperVadModel);
  if (hint) args.push("--prompt", hint.slice(0, 600));
  await run(config.whisperBin, args);
  const json = JSON.parse(await readFile(`${base}.json`, "utf8")) as { transcription?: Segment[] };
  return (json.transcription ?? [])
    .map((s) => {
      const line = { start: s.offsets.from / 1000, end: s.offsets.to / 1000, text: s.text.trim() };
      return { ...line, words: config.whisperVadModel ? anchor(wordsOf(s), line) : wordsOf(s) };
    })
    .filter((s) => s.text && !/^\[.*\]$/.test(s.text));
}

// With VAD on, whisper.cpp maps segment times back to the real audio but leaves word
// times on the silence-stripped timeline. Segments are short (-ml 48), so shifting a
// segment's words onto its real start is accurate to within its own short pauses.
export function anchor(words: Word[], line: { start: number; end: number }): Word[] {
  if (!words.length) return words;
  const shift = line.start - words[0].start;
  return words.map((w) => ({
    start: Math.min(line.end, Math.max(line.start, w.start + shift)),
    end: Math.min(line.end, Math.max(line.start, w.end + shift)),
    text: w.text,
  }));
}
