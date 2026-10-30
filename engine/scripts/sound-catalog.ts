// Builds the catalogs the sound designer searches, from free libraries whose licences
// allow music and effects under client videos:
//
//   music/freepd.json       FreePD, CC0. Only tracks listed on freepd.com's own pages (the
//                           archive.org mirror also holds files from elsewhere).
//   music/incompetech.json  Kevin MacLeod, CC BY 4.0: the post must credit the track.
//
//   node scripts/sound-catalog.ts                  both of them
//   node scripts/sound-catalog.ts freepd           one of them
//
// Pages are fetched one at a time with a pause, like a person browsing.

import { writeFile } from "node:fs/promises";
import { moodOf, slug, type Track } from "../src/music.ts";

const UA = { "user-agent": "MagikStudio-catalog/1.0 (+https://www.magikmanagement.com)" };
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const root = new URL("..", import.meta.url);

async function get(url: string, tries = 3): Promise<string> {
  for (let i = 1; ; i++) {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60_000) }).catch(() => null);
    if (res?.ok) return res.text();
    if (res && res.status < 500 && res.status !== 429) throw new Error(`${url}: ${res.status}`);
    if (i >= tries) throw new Error(`${url}: ${res?.status ?? "no answer"}`);
    await pause(3000 * i);
  }
}

const seconds = (clock: string) => clock.split(":").reduce((a, n) => a * 60 + Number(n), 0);

async function save(file: string, entries: unknown[]) {
  await writeFile(new URL(file, root), `${JSON.stringify(entries, null, 1)}\n`);
  console.log(`${file}: ${entries.length} entries`);
}

// ---------------------------------------------------------------- FreePD

const FREEPD_PAGES: Record<string, { mood: Track["mood"]; tags: string[] }> = {
  upbeat: { mood: "upbeat-pop", tags: ["upbeat", "positive"] },
  epic: { mood: "cinematic-epic", tags: ["epic", "dramatic"] },
  horror: { mood: "dramatic-suspense", tags: ["horror", "dark"] },
  romantic: { mood: "emotional-piano", tags: ["romantic", "sentimental"] },
  comedy: { mood: "funky-groovy", tags: ["comedy", "quirky", "playful"] },
  world: { mood: "warm-acoustic", tags: ["world"] },
  scoring: { mood: null, tags: ["film score", "underscore", "cinematic"] },
  electronic: { mood: "electronic-tech", tags: ["electronic"] },
  misc: { mood: null, tags: ["misc"] },
};

async function freepd() {
  // Which titles freepd.com itself listed, page by page, over the years it was online.
  const listed = new Map<string, { page: string; snapshot: string }>();
  for (const page of Object.keys(FREEPD_PAGES)) {
    const cdx = JSON.parse(await get(`https://web.archive.org/cdx/search/cdx?url=freepd.com/${page}.php&output=json&fl=timestamp&filter=statuscode:200&from=2019`)) as string[][];
    const stamps = cdx.slice(1).map((r) => r[0]);
    const picks = [...new Set([...stamps.filter((_, i) => i % Math.max(1, Math.floor(stamps.length / 6)) === 0), ...stamps.slice(-2)])];
    for (const stamp of picks) {
      const html = await get(`https://web.archive.org/web/${stamp}id_/https://freepd.com/${page}.php`).catch(() => "");
      for (const m of html.matchAll(/(?:href|src|data-src)="\/music\/([^"]+?)\.mp3"/g)) {
        const title = decodeURIComponent(m[1]);
        if (!listed.has(title.toLowerCase())) listed.set(title.toLowerCase(), { page, snapshot: `https://web.archive.org/web/${stamp}/https://freepd.com/${page}.php` });
      }
      await pause(800);
    }
  }
  const meta = JSON.parse(await get("https://archive.org/metadata/freepd")) as { files: { name: string; source: string; length?: string; creator?: string; title?: string }[] };
  const out: Track[] = [];
  for (const f of meta.files) {
    const [folder, name] = f.name.split("/");
    if (f.source !== "original" || !name?.toLowerCase().endsWith(".mp3") || !(folder in FREEPD_PAGES)) continue;
    const title = name.slice(0, -4);
    const where = listed.get(title.toLowerCase());
    if (!where) continue;
    const page = FREEPD_PAGES[folder];
    out.push({
      id: slug(title),
      title,
      artist: f.creator?.split(",")[0].trim() || "FreePD",
      library: "freepd",
      mood: page.mood ?? moodOf(title),
      tags: page.tags,
      duration: Math.round(Number(f.length ?? 0)),
      url: `https://archive.org/download/freepd/${folder}/${encodeURIComponent(name)}`,
      page: where.snapshot,
      license: "CC0 1.0",
    });
  }
  await save("music/freepd.json", out.sort((a, b) => a.id.localeCompare(b.id)));
}

// ---------------------------------------------------------------- Incompetech

async function incompetech() {
  const genres = new Map((JSON.parse(await get("https://incompetech.com/music/royalty-free/genre.json")) as { id: number; genre: string }[]).map((g) => [String(g.id), g.genre]));
  const pieces = JSON.parse(await get("https://incompetech.com/music/royalty-free/pieces.json")) as {
    title: string; filename: string; length: string; instruments: string | null; genre: string; bpm: string | null; description: string | null; feel: string | null; isrc: string | null;
  }[];
  const list = (s: string | null) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const p of pieces) {
    const id = `incompetech-${slug(p.title)}`;
    if (!p.filename || seen.has(id)) continue;
    seen.add(id);
    const genre = genres.get(p.genre) ?? "";
    const feel = list(p.feel);
    const words = [genre, ...feel, p.description ?? "", p.instruments ?? ""].join(" ");
    const bpm = Number(p.bpm);
    out.push({
      id,
      title: p.title,
      artist: "Kevin MacLeod",
      library: "incompetech",
      mood: moodOf(words),
      tags: [genre, ...feel, ...list(p.instruments)].filter(Boolean).map((t) => t.toLowerCase()),
      description: p.description ?? undefined,
      energy: /intense|driving|action|aggressive|epic/i.test(feel.join(" ")) ? "high" : /calming|relaxed|somber/i.test(feel.join(" ")) ? "low" : "medium",
      bpm: bpm > 30 && bpm < 300 ? bpm : undefined,
      duration: seconds(p.length),
      url: `https://incompetech.com/music/royalty-free/mp3-royaltyfree/${encodeURIComponent(p.filename)}`,
      page: p.isrc ? `https://incompetech.com/music/royalty-free/index.html?isrc=${p.isrc}` : "https://incompetech.com/music/royalty-free/music.html",
      license: "CC BY 4.0",
      credit: `"${p.title}" Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/`,
    });
  }
  await save("music/incompetech.json", out.sort((a, b) => a.id.localeCompare(b.id)));
}

// ---------------------------------------------------------------- Mixkit

// Mixkit (music/mixkit.json, sfx/mixkit.json) is no longer rebuilt here: its terms (mixkit.co/terms,
// 9.10) forbid scripts or bots that mass-download items or scrape the library. Those two catalogs stay
// as they are until a library the studio holds itself replaces them.

const jobs = { freepd, incompetech };
const asked = process.argv.slice(2).filter((a): a is keyof typeof jobs => a in jobs);
for (const name of asked.length ? asked : (Object.keys(jobs) as (keyof typeof jobs)[])) {
  console.log(`building ${name}…`);
  await jobs[name]();
}
