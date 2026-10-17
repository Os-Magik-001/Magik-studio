// Adds every audio file in a Google Drive folder (and its subfolders) to the music
// library: measures length, tempo and first beat from the audio, guesses the mood
// from the file name, and writes music/library.json.
//
//   node --env-file=../.env.local scripts/add-drive-music.ts --folder <drive folder id> --license "Pixabay Content License"
//
// The folder must be shared with the engine's service account (Viewer is enough).

import { readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { config } from "../src/config.ts";
import { fetchDriveFile } from "../src/drive.ts";
import { run } from "../src/exec.ts";
import { MOODS, type Track } from "../src/music.ts";

const { values } = parseArgs({ options: { folder: { type: "string" }, license: { type: "string", default: "Pixabay Content License" } } });
if (!values.folder) throw new Error("--folder <drive folder id> is required");
const LIBRARY = new URL("../music/library.json", import.meta.url);

// Lists audio files under a folder with the same service account the engine uses.
async function listAudio(folder: string): Promise<{ id: string; name: string; parent: string }[]> {
  const { listDriveFiles } = await import("../src/drive.ts");
  return listDriveFiles(folder, (f) => f.mimeType.startsWith("audio/") || /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(f.name));
}

// Tempo from the onset envelope's autocorrelation; first beat from the best-aligned comb.
async function measure(file: string) {
  const pcm = `${file}.f32`;
  await run(config.ffmpeg, ["-v", "error", "-y", "-i", file, "-ac", "1", "-ar", "11025", "-f", "f32le", pcm]);
  const buf = await readFile(pcm);
  await rm(pcm, { force: true });
  const samples = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4));
  const hop = 256;
  const env: number[] = [];
  let prev = 0;
  for (let i = 0; i + hop <= samples.length; i += hop) {
    let e = 0;
    for (let k = 0; k < hop; k++) e += samples[i + k] ** 2;
    const l = Math.log(1e-9 + e);
    env.push(Math.max(0, l - prev));
    prev = l;
  }
  const fps = 11025 / hop;
  const n = Math.min(env.length, Math.round(fps * 60));
  let best = { bpm: 120, score: -1 };
  for (let bpm = 70; bpm <= 180; bpm += 0.5) {
    const lag = (fps * 60) / bpm;
    let sc = 0;
    for (let i = 0; i + lag * 2 < n; i++) sc += env[i] * (env[Math.round(i + lag)] + 0.5 * env[Math.round(i + lag * 2)]);
    if (sc > best.score) best = { bpm, score: sc };
  }
  const period = (fps * 60) / best.bpm;
  let phase = { at: 0, score: -1 };
  for (let p = 0; p < period; p++) {
    let sc = 0;
    for (let b = p; b < n; b += period) sc += env[Math.round(b)] ?? 0;
    if (sc > phase.score) phase = { at: p, score: sc };
  }
  return { bpm: best.bpm, firstBeat: Math.round((phase.at / fps) * 1000) / 1000, duration: Math.round(samples.length / 11025) };
}

function moodOf(name: string): { mood: Track["mood"]; energy: Track["energy"] } {
  const n = name.toLowerCase();
  const pick = (mood: Track["mood"], energy: Track["energy"]) => ({ mood, energy });
  if (/funk|groove|groovy/.test(n)) return pick("funky-groovy", /upbeat|energy|party|happy/.test(n) ? "high" : "medium");
  if (/rock|party|sport|energy/.test(n)) return pick("upbeat-pop", "high");
  if (/hip.?hop|trap|rap/.test(n)) return pick("hip-hop", "high");
  if (/lofi|lo-fi|chill/.test(n)) return pick("chill-lofi", "low");
  if (/epic|cinematic|trailer/.test(n)) return pick("cinematic-epic", "high");
  if (/suspense|tension|dark|drama/.test(n)) return pick("dramatic-suspense", "medium");
  if (/piano|emotional|sad/.test(n)) return pick("emotional-piano", "low");
  if (/corporate|inspir|motivat/.test(n)) return pick("inspiring-corporate", "medium");
  if (/electro|tech|synth/.test(n)) return pick("electronic-tech", "high");
  if (/cook|happy|fun|upbeat|pop/.test(n)) return pick("upbeat-pop", "medium");
  return pick("upbeat-pop", "medium");
}

const library = JSON.parse(await readFile(LIBRARY, "utf8")) as Track[];
const files = await listAudio(values.folder);
console.log(`${files.length} audio files`);
for (const f of files) {
  const url = `drive:${f.id}`;
  if (library.some((t) => t.url === url)) continue;
  const base = f.name.replace(/\.[a-z0-9]+$/i, "");
  const id = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").replace(/-\d{5,}$/, "").slice(0, 40);
  const tmp = path.join(os.tmpdir(), `magik-music-${f.id}`);
  const res = await fetchDriveFile(f.id);
  if (!res.ok) {
    console.log(`skipped ${f.name}: Drive returned ${res.status}`);
    continue;
  }
  await writeFile(tmp, Buffer.from(await res.arrayBuffer()));
  const m = await measure(tmp);
  await rm(tmp, { force: true });
  const artist = /^alexguz/i.test(base) ? "Alex Guz" : base.split(/[-_]/)[0];
  const unique = library.some((t) => t.id === id) ? `${id}-${f.id.slice(0, 4).toLowerCase()}` : id;
  const title = base.replace(/^[a-z]+-/i, "").replace(/-\d{5,}$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const entry: Track = { id: unique, title, artist, ...moodOf(base), bpm: m.bpm, firstBeat: m.firstBeat, duration: m.duration, url, page: `https://drive.google.com/file/d/${f.id}/view`, license: values.license! };
  if (!MOODS.includes(entry.mood)) continue;
  library.push(entry);
  console.log(`added ${entry.id}: ${entry.mood}, ${entry.energy}, ${entry.bpm} BPM, first beat ${entry.firstBeat}s, ${entry.duration}s`);
}
await writeFile(LIBRARY, JSON.stringify(library, null, 1) + "\n");
console.log(`library: ${library.length} tracks`);
