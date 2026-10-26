// The libraries the sound designer searches, as the app's Sound page lists them: the ones
// shipped with the engine (it keeps their rows up to date) and the studio's own folders in
// Google Drive. A Drive library syncs when it's added or asked to sync again: every audio
// file is listed and measured once (tempo, sections and drops for music, the peak for an
// effect), so the sound designer searches it like the built-in libraries.

import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { analyzeTrack, peakOf, type TrackAnalysis } from "./analysis.ts";
import { config, db } from "./config.ts";
import { fetchDriveFile, listDriveFiles } from "./drive.ts";
import { log } from "./job.ts";
import { loadCatalog, moodOf, MOODS, type Mood, type Track } from "./music.ts";
import { loadSfxCatalog, type SfxEntry } from "./sfx.ts";
import { friendlyError } from "./errors.ts";

type Library = { id: string; name: string; kind: "music" | "sfx"; drive_folder_id: string | null; license: string };

const BUILT_IN: Record<string, { name: string; license: string }> = {
  "music:studio": { name: "Studio picks", license: "CC0 and the Pixabay Content License, measured by the studio" },
  "music:freepd": { name: "FreePD", license: "CC0 1.0 (public domain)" },
  "music:mixkit": { name: "Mixkit music", license: "Mixkit Stock Music Free License: web and social media, not TV, radio or CDs" },
  "music:incompetech": { name: "Incompetech (Kevin MacLeod)", license: "CC BY 4.0: the post must credit the track" },
  "sfx:studio": { name: "Built-in effects", license: "Synthesized by the engine" },
  "sfx:mixkit": { name: "Mixkit sound effects", license: "Mixkit Sound Effects Free License" },
};

// Keeps a row per built-in library with its size, so the app shows what the engine has.
export async function registerBuiltins() {
  const [music, sfx] = await Promise.all([loadCatalog(), loadSfxCatalog()]);
  const counts = new Map<string, number>();
  for (const t of music) counts.set(`music:${t.library}`, (counts.get(`music:${t.library}`) ?? 0) + 1);
  for (const e of sfx) counts.set(`sfx:${e.library}`, (counts.get(`sfx:${e.library}`) ?? 0) + 1);
  const { data: rows } = await db.from("sound_libraries").select("id, name, kind").eq("source", "builtin");
  for (const [key, info] of Object.entries(BUILT_IN)) {
    const kind = key.split(":")[0] as Library["kind"];
    const row = { name: info.name, kind, source: "builtin", license: info.license, status: "done" as const, file_count: counts.get(key) ?? 0, synced_at: new Date().toISOString(), error: null };
    const known = rows?.find((r) => r.kind === kind && r.name === info.name);
    if (known) await db.from("sound_libraries").update(row).eq("id", known.id);
    else await db.from("sound_libraries").insert(row);
  }
}

export async function claimLibrarySync(): Promise<Library | null> {
  const { data: queued } = await db.from("sound_libraries").select("id").eq("status", "queued").eq("source", "drive").order("created_at").limit(1).maybeSingle();
  if (!queued) return null;
  const { data } = await db
    .from("sound_libraries")
    .update({ status: "running", progress: "Listing the folder", error: null })
    .eq("id", queued.id)
    .eq("status", "queued")
    .select("id, name, kind, drive_folder_id, license")
    .maybeSingle();
  return data;
}

export async function recoverStaleLibraries() {
  const { data } = await db.from("sound_libraries").select("id").eq("status", "running").eq("source", "drive");
  // Only one engine syncs at a time, and a sync never outlives a restart: requeue them.
  for (const l of data ?? []) await db.from("sound_libraries").update({ status: "queued", progress: null }).eq("id", l.id).eq("status", "running");
}

const AUDIO = /\.(mp3|wav|m4a|aac|flac|ogg|aif|aiff)$/i;
const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 12);
// Pixabay names its downloads "<author>-<title words>-<id>.mp3", so the artist and title come
// from there; other files keep their own name.
export function nameOf(file: string) {
  const base = file.replace(/\.[a-z0-9]+$/i, "").trim();
  const m = base.match(/^([a-z0-9_]+)-(.+)-(\d{4,})$/i);
  if (!m) return { title: base.replace(/_+/g, " ").replace(/\s+/g, " ").trim(), artist: null, pixabay: null };
  const title = m[2].replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
  return { title, artist: m[1].replace(/_+/g, " "), pixabay: m[3] };
}
const wordsOf = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);

// The built-in effect closest to a recorded one, from its name and folder.
function kindOf(words: string): SfxEntry["kind"] {
  if (/whoosh|woosh|swoosh|swish|swipe|transition|zoom|sweep/i.test(words)) return "whoosh";
  if (/riser|rise|build|swell|uplifter/i.test(words)) return "riser";
  if (/impact|hit|boom|thud|punch|slam|drop|bass/i.test(words)) return "hit";
  if (/pop|bubble|blip/i.test(words)) return "pop";
  if (/click|tap|type|keyboard|mouse|ui|interface|camera/i.test(words)) return "click";
  if (/ding|bell|chime|coin|cash|success|notification|sparkle/i.test(words)) return "ding";
  return null;
}

// Files measured per turn: a big folder syncs over several turns, so edits waiting in the
// queue go first in between.
const BATCH = 20;

export async function syncLibrary(lib: Library) {
  const dir = path.join(config.workDir, `library-${lib.id}`);
  const progress = (text: string) => db.from("sound_libraries").update({ progress: text }).eq("id", lib.id);
  try {
    const files = await listDriveFiles(lib.drive_folder_id!, (f) => f.mimeType.startsWith("audio/") || AUDIO.test(f.name), 3000);
    const { data: known } = await db.from("sound_files").select("id, drive_file_id").eq("library_id", lib.id);
    const present = new Set(files.map((f) => f.id));
    const gone = (known ?? []).filter((k) => !present.has(k.drive_file_id)).map((k) => k.id);
    if (gone.length) await db.from("sound_files").delete().in("id", gone);
    const have = new Set((known ?? []).map((k) => k.drive_file_id));
    const fresh = files.filter((f) => !have.has(f.id));
    const total = files.length;
    await mkdir(dir, { recursive: true });
    for (const [k, f] of fresh.slice(0, BATCH).entries()) {
      await progress(`Measuring ${total - fresh.length + k + 1} of ${total}`);
      const file = path.join(dir, `${hash(f.id)}${path.extname(f.name) || ".audio"}`);
      try {
        const res = await fetchDriveFile(f.id);
        if (!res.ok) throw new Error(`Drive returned ${res.status}`);
        await writeFile(file, Buffer.from(await res.arrayBuffer()));
        const analysis: TrackAnalysis | { peak: number } = lib.kind === "music" ? await analyzeTrack(file) : await peakOf(file);
        const n = nameOf(f.name);
        const words = `${n.title} ${n.artist ?? ""} ${f.parent}`;
        await db.from("sound_files").insert({
          library_id: lib.id,
          drive_file_id: f.id,
          name: f.name,
          folder: f.parent,
          duration: "duration" in analysis ? analysis.duration : 0,
          mood: lib.kind === "music" ? moodOf(words) : kindOf(words),
          tags: [...new Set(wordsOf(words))].slice(0, 12),
          analysis,
        });
      } catch (err) {
        log(lib.id, `library ${lib.name}: skipped ${f.name} (${(err as Error).message})`);
      } finally {
        await rm(file, { force: true });
      }
    }
    const { count } = await db.from("sound_files").select("id", { count: "exact", head: true }).eq("library_id", lib.id);
    if (fresh.length > BATCH) {
      await db.from("sound_libraries").update({ status: "queued", progress: `Measured ${count ?? 0} of ${total}`, file_count: count ?? 0 }).eq("id", lib.id);
      return;
    }
    await db.from("sound_libraries").update({ status: "done", progress: null, file_count: count ?? 0, synced_at: new Date().toISOString() }).eq("id", lib.id);
    log(lib.id, `library ${lib.name}: ${count ?? 0} files (${gone.length} removed)`);
  } catch (err) {
    // Drive's refusal names footage; here it's a library folder.
    const message = friendlyError((err as Error).message.replace("share the footage with", "share the folder with"));
    log(lib.id, `library ${lib.name} failed: ${(err as Error).message}`);
    await db.from("sound_libraries").update({ status: "failed", progress: null, error: message.slice(0, 500) }).eq("id", lib.id);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// The Drive libraries' files, as tracks and effects the sound designer can search.
export async function driveLibraries(): Promise<{ music: Track[]; sfx: SfxEntry[] }> {
  // A library still syncing already offers the files measured so far.
  const { data: libs } = await db.from("sound_libraries").select("id, name, kind, license").eq("source", "drive").in("status", ["done", "queued", "running"]);
  if (!libs?.length) return { music: [], sfx: [] };
  const { data: files } = await db.from("sound_files").select("library_id, drive_file_id, name, folder, duration, mood, tags, analysis").in("library_id", libs.map((l) => l.id));
  const music: Track[] = [];
  const sfx: SfxEntry[] = [];
  for (const f of files ?? []) {
    const lib = libs.find((l) => l.id === f.library_id)!;
    const n = nameOf(f.name);
    const page = `https://drive.google.com/file/d/${f.drive_file_id}/view`;
    const license = lib.license || "The studio's own library";
    if (lib.kind === "music") {
      const a = f.analysis as TrackAnalysis | null;
      music.push({
        id: `drive-${hash(f.drive_file_id)}`,
        title: n.title,
        artist: n.artist ?? (f.folder || lib.name),
        library: lib.name,
        mood: MOODS.includes(f.mood as Mood) ? (f.mood as Mood) : null,
        tags: f.tags,
        description: n.pixabay ? `Pixabay track ${n.pixabay}` : undefined,
        energy: a?.energy,
        bpm: a?.bpm,
        firstBeat: a?.firstBeat,
        duration: Math.round(f.duration),
        url: `drive:${f.drive_file_id}`,
        page,
        license,
        analysis: a?.sections ? a : undefined,
      });
    } else {
      sfx.push({
        id: `drive-sfx-${hash(f.drive_file_id)}`,
        title: n.title,
        library: lib.name,
        category: f.folder || lib.name,
        tags: f.tags,
        kind: (["whoosh", "pop", "hit", "riser", "click", "ding"] as const).find((k) => k === f.mood) ?? null,
        duration: f.duration,
        url: `drive:${f.drive_file_id}`,
        page,
        license,
      });
    }
  }
  return { music, sfx };
}
