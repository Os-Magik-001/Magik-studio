// Adds every audio file in a Google Drive folder (and its subfolders) to the studio's picks
// (music/library.json): measures length, tempo and first beat from the audio (analysis.ts)
// and guesses the mood from the file name. For whole libraries, add the folder on the app's
// Sound page instead: the engine measures it and the sound designer searches it.
//
//   node --env-file=../.env.local scripts/add-drive-music.ts --folder <drive folder id> --license "Pixabay Content License"
//
// The folder must be shared with the engine's service account (Viewer is enough).

import { readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { analyzeTrack } from "../src/analysis.ts";
import { fetchDriveFile } from "../src/drive.ts";
import { MOODS, type StudioTrack } from "../src/music.ts";

const { values } = parseArgs({ options: { folder: { type: "string" }, license: { type: "string", default: "Pixabay Content License" } } });
if (!values.folder) throw new Error("--folder <drive folder id> is required");
const LIBRARY = new URL("../music/library.json", import.meta.url);

// Lists audio files under a folder with the same service account the engine uses.
async function listAudio(folder: string): Promise<{ id: string; name: string; parent: string }[]> {
  const { listDriveFiles } = await import("../src/drive.ts");
  return listDriveFiles(folder, (f) => f.mimeType.startsWith("audio/") || /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(f.name));
}

function moodOf(name: string): { mood: StudioTrack["mood"]; energy: StudioTrack["energy"] } {
  const n = name.toLowerCase();
  const pick = (mood: StudioTrack["mood"], energy: StudioTrack["energy"]) => ({ mood, energy });
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

const library = JSON.parse(await readFile(LIBRARY, "utf8")) as StudioTrack[];
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
  const m = await analyzeTrack(tmp);
  await rm(tmp, { force: true });
  const artist = /^alexguz/i.test(base) ? "Alex Guz" : base.split(/[-_]/)[0];
  const unique = library.some((t) => t.id === id) ? `${id}-${f.id.slice(0, 4).toLowerCase()}` : id;
  const title = base.replace(/^[a-z]+-/i, "").replace(/-\d{5,}$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const entry: StudioTrack = { id: unique, title, artist, ...moodOf(base), bpm: m.bpm, firstBeat: m.firstBeat, duration: Math.round(m.duration), url, page: `https://drive.google.com/file/d/${f.id}/view`, license: values.license! };
  if (!MOODS.includes(entry.mood)) continue;
  library.push(entry);
  console.log(`added ${entry.id}: ${entry.mood}, ${entry.energy}, ${entry.bpm} BPM, first beat ${entry.firstBeat}s, ${entry.duration}s`);
}
await writeFile(LIBRARY, JSON.stringify(library, null, 1) + "\n");
console.log(`library: ${library.length} tracks`);
