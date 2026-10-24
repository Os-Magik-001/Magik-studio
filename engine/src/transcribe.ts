import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.ts";
import { exists, run } from "./exec.ts";
import { pcmOf, rememberMap, speechMapOf, type SpeechMap } from "./speech.ts";
import { carryTimes, DTW, dtwPreset, FASTER, fasterWhisperAvailable, fasterWhisperWords, placeWords, STRIPPED, whisperWords, wordsOfSegment as wordsOf, type Timing } from "./words.ts";

export type Word = { start: number; end: number; text: string };
// `placed`: the words' times were set from the sound itself (see words.ts), not left as
// Whisper gave them. `language`: the language it was transcribed in.
export type TranscriptLine = { start: number; end: number; text: string; words: Word[]; placed?: boolean; language?: string };

let available: boolean | null = null;

// Optional: with whisper.cpp installed and WHISPER_CPP_MODEL set, Claude also
// reads what's said in each clip. Without it, Claude edits from the picture.
export async function transcriptionAvailable() {
  if (available === null) available = !!config.whisperModel && (await exists(config.whisperBin));
  return available;
}

type Segment = Parameters<typeof wordsOf>[0];

// `hint` primes Whisper with names and terms it would otherwise mishear (the client,
// product names from the script). With `place` (the default), every word's time is then set
// from the sound (placeLines).
export async function transcribe(file: string, workDir: string, hint?: string, opts: { place?: boolean } = {}): Promise<TranscriptLine[] | null> {
  if (!(await transcriptionAvailable())) return null;
  const base = path.join(workDir, path.basename(file) + ".speech");
  await run(config.ffmpeg, ["-v", "error", "-y", "-i", file, "-vn", "-ac", "1", "-ar", "16000", `${base}.wav`]);
  // Short, word-aligned segments give phrase-level lines; the full JSON adds per-word timing.
  const language = config.whisperLanguage === "auto" ? await detectLanguage(`${base}.wav`) : config.whisperLanguage;
  const args = ["-m", config.whisperModel!, "-f", `${base}.wav`, "-l", language, "-ml", "48", "-sow", "-ojf", "-of", base, "-np"];
  const dtw = dtwPreset(config.whisperModel!);
  if (dtw) args.push("-nfa", "--dtw", dtw);
  if (config.whisperVadModel) args.push("--vad", "-vm", config.whisperVadModel);
  const names = hint && namesIn(hint);
  if (names) args.push("--prompt", names);
  await run(config.whisperBin, args);
  const json = JSON.parse(await readFile(`${base}.json`, "utf8")) as { transcription?: Segment[] };
  const lines = (json.transcription ?? [])
    .map((s) => {
      const line = { start: s.offsets.from / 1000, end: s.offsets.to / 1000, text: s.text.trim() };
      return { ...line, words: config.whisperVadModel ? anchor(wordsOf(s), line) : wordsOf(s), ...(language !== "auto" ? { language } : {}) };
    })
    .filter((s) => s.text && !/^\[.*\]$/.test(s.text));
  if (opts.place === false || !lines.length) return lines;
  try {
    const map = speechMapOf(await pcmOf(`${base}.wav`));
    // The 16 kHz copy is the file's own sound: later passes (the edit pass) reuse its map.
    rememberMap(file, map);
    return await placeLines(lines, `${base}.wav`, map, { language, prompt: names || undefined, stripped: !!config.whisperVadModel });
  } catch (err) {
    console.warn(`word placement skipped for ${path.basename(file)}: ${err instanceof Error ? err.message : err}`);
    return lines;
  }
}

// Every word of the lines moved onto the sound. With VAD, whisper.cpp's word times sit on the
// silence-stripped timeline, so a timing pass without VAD (or faster-whisper, when enabled)
// first gives real-time starts, carried over by matching the words.
export async function placeLines(lines: TranscriptLine[], wav: string, map: SpeechMap, opts: { language: string; prompt?: string; stripped: boolean }): Promise<TranscriptLine[]> {
  const words = lines.flatMap((l) => l.words ?? []);
  if (!words.length) return lines;
  let starts = words.map((w) => w.start);
  let timing: Timing = opts.stripped ? STRIPPED : DTW;
  const timed = (await fasterWhisperAvailable())
    ? { words: (await fasterWhisperWords([wav], opts.language, opts.prompt))[0], timing: FASTER }
    : opts.stripped
      ? { words: await whisperWords(wav, opts.language, opts.prompt), timing: DTW }
      : null;
  if (timed?.words.length) {
    starts = carryTimes(words, timed.words);
    timing = timed.timing;
  }
  const placed = placeWords(words.map((w, i) => ({ ...w, start: starts[i], end: starts[i] + (w.end - w.start) })), map, timing);
  let k = 0;
  return lines.map((l) => {
    const own = placed.slice(k, (k += (l.words ?? []).length)).map(({ start, end, text }) => ({ start, end, text }));
    return own.length ? { ...l, start: own[0].start, end: own.at(-1)!.end, words: own, placed: true } : l;
  });
}

// The language is detected from the audio alone before transcribing: with "auto" and a
// hint prompt, Whisper takes the hint's language as the spoken one, so an English brief
// over French speech came back as a looping English paraphrase. Detection listens to
// 30 s, taken a little way in to skip intros.
async function detectLanguage(wav: string) {
  const seconds = Math.max(0, ((await stat(wav)).size - 44) / 32000);
  const offset = seconds > 60 ? Math.min(seconds * 0.2, 120) : 0;
  try {
    // Not -np: that also silences the line that names the language.
    const { stderr } = await run(config.whisperBin, ["-m", config.whisperModel!, "-f", wav, "-l", "auto", "-dl", "-ot", String(Math.round(offset * 1000))]);
    return /auto-detected language: ([a-z]{2,3})/.exec(stderr)?.[1] ?? "auto";
  } catch {
    return "auto";
  }
}

// Only the names and terms from the hint go to Whisper, as a list: a prompt written in
// sentences pulls the transcript into the prompt's language, even with the spoken
// language set (an English title turned French speech into English).
const OPENERS = new Set("a an the this that these our my we you i it in on at for to and but so if when how what why la le les un une des ce cette nos notre nous vous je on il elle en au aux pour et mais si quand comment pourquoi el los las una".split(" "));

export function namesIn(hint: string) {
  const seen = new Set<string>();
  const out: string[] = [];
  hint.split(/\s+/).forEach((raw, i, all) => {
    const w = raw.replace(/^[^\p{L}\p{N}@#]+|[^\p{L}\p{N}]+$/gu, "");
    // A capital at the start of a sentence only counts when the word isn't a common opener.
    const sentenceStart = i === 0 || /[.!?:]$/.test(all[i - 1]);
    const named = /\p{Lu}/u.test(w.slice(1)) || /\d/.test(w) || /^[@#]/.test(w) || (/^\p{Lu}/u.test(w) && !(sentenceStart && OPENERS.has(w.toLowerCase())));
    if (w.length > 1 && named && !seen.has(w.toLowerCase())) {
      seen.add(w.toLowerCase());
      out.push(w);
    }
  });
  return out.slice(0, 40).join(", ");
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
