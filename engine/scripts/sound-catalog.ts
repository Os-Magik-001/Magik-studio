// Builds the catalogs the sound designer searches, from free libraries whose licences
// allow music and effects under client videos:
//
//   music/freepd.json       FreePD, CC0. Only tracks listed on freepd.com's own pages (the
//                           archive.org mirror also holds files from elsewhere).
//   music/incompetech.json  Kevin MacLeod, CC BY 4.0: the post must credit the track.
//   music/mixkit.json       Mixkit Stock Music Free License: web and social media, ads and
//                           podcasts; not TV, radio, CDs or games.
//   sfx/mixkit.json         Mixkit Sound Effects Free License: any project, never resold alone.
//
//   node scripts/sound-catalog.ts                  all of them
//   node scripts/sound-catalog.ts freepd mixkit    some of them
//
// Pages are fetched one at a time with a pause, like a person browsing.

import { writeFile } from "node:fs/promises";
import { moodOf, slug, type Track } from "../src/music.ts";
import type { SfxEntry } from "../src/sfx.ts";

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

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
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

type Card = { id: string; url: string; title: string; author: string; tags: string[]; duration: number };

function cards(html: string): Card[] {
  return html
    .split('class="item-grid__item"')
    .slice(1)
    .flatMap((c) => {
      const id = c.match(/data-audio-player-item-id-value="(\d+)"/)?.[1];
      const url = c.match(/data-audio-player-preview-url-value="([^"]+)"/)?.[1];
      const title = c.match(/item-grid-card__title"[^>]*>\s*([\s\S]*?)\s*</)?.[1];
      if (!id || !url || !title) return [];
      return [{
        id,
        url,
        title: decode(title),
        author: decode(c.match(/item-grid-music-preview__author"[^>]*>\s*by ([^<]+)</)?.[1] ?? ""),
        tags: [...c.matchAll(/meta-links__link"[^>]*>([^<]+)<\/a>/g)].map((m) => decode(m[1])),
        duration: seconds(c.match(/data-test-id="duration"[^>]*>\s*([\d:]+)/)?.[1] ?? "0"),
      }];
    });
}

// Every card on a listing, page after page, until a page adds nothing new.
async function crawl(path: string, into: Map<string, Card & { pages: string[] }>) {
  for (let n = 1; n <= 20; n++) {
    const page = `https://mixkit.co${path}${n > 1 ? `?page=${n}` : ""}`;
    const found = cards(await get(page).catch(() => ""));
    let fresh = 0;
    for (const card of found) {
      const known = into.get(card.id);
      if (known) known.tags = [...new Set([...known.tags, ...card.tags])];
      else {
        into.set(card.id, { ...card, pages: [`https://mixkit.co${path}`] });
        fresh++;
      }
    }
    await pause(900);
    if (!found.length || !fresh) break;
  }
}

async function mixkit() {
  const index = await get("https://mixkit.co/free-stock-music/");
  const genres = [...new Set([...index.matchAll(/href="\/free-stock-music\/([a-z0-9-]+)\/"/g)].map((m) => m[1]))];
  const found = new Map<string, Card & { pages: string[] }>();
  for (const g of genres) await crawl(`/free-stock-music/${g}/`, found);
  const out: Track[] = [...found.values()].map((c) => ({
    id: `mixkit-${c.id}`,
    title: c.title,
    artist: c.author || "Mixkit",
    library: "mixkit",
    mood: moodOf(`${c.title} ${c.tags.join(" ")}`),
    tags: c.tags.map((t) => t.toLowerCase()),
    duration: c.duration,
    url: c.url,
    page: c.pages[0],
    license: "Mixkit Stock Music Free License (web and social media; not TV, radio, CDs or games)",
  }));
  await save("music/mixkit.json", out.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true })));
}

// The effect categories a short-form edit uses, and the built-in effect each falls back to.
const SFX_CATEGORIES: Record<string, SfxEntry["kind"]> = {
  whoosh: "whoosh", woosh: "whoosh", swoosh: "whoosh", swish: "whoosh", sweep: "whoosh", transition: "whoosh", zoom: "whoosh", slide: "whoosh", spin: "whoosh", whip: "whoosh",
  swell: "riser", cinematic: "riser", "suspense-music": "riser",
  impact: "hit", hit: "hit", boom: "hit", thud: "hit", punch: "hit", drop: "hit", explosion: "hit", cymbal: "hit", stomp: "hit", drum: "hit",
  pop: "pop", bubbles: "pop", balloon: "pop", cartoon: "pop", funny: "pop", cute: "pop", jump: "pop",
  click: "click", tap: "click", type: "click", typewriter: "click", keyboard: "click", interface: "click", camera: "click", mouse: "click", laptop: "click", technology: "click", "high-tech": "click", beep: "click",
  ding: "ding", bell: "ding", chimes: "ding", correct: "ding", win: "ding", notification: "ding", alerts: "ding", coin: "ding", money: "ding", sparkle: "ding", magic: "ding", "game-show": "ding",
  glitch: null, static: null, "tape-machine": null, rewind: null, "dj-record-scratch": null, wrong: null, error: null, lose: null, buzzer: null,
  applause: null, clapping: null, cheer: null, crowd: null, laugh: null, gasp: null, wow: null, countdown: null, heartbeat: null, intro: null, "phone-ring": null, phone: null, fireworks: null, party: null,
};

async function sfx() {
  const found = new Map<string, Card & { pages: string[] }>();
  const category = new Map<string, string>();
  for (const cat of Object.keys(SFX_CATEGORIES)) {
    const before = new Set(found.keys());
    await crawl(`/free-sound-effects/${cat}/`, found);
    for (const id of found.keys()) if (!before.has(id)) category.set(id, cat);
  }
  // Longer "effects" (crowd beds, suspense music) are music, not effects: left out.
  const out: SfxEntry[] = [...found.values()].filter((c) => c.duration > 0 && c.duration <= 30).map((c) => {
    const cat = category.get(c.id) ?? "misc";
    return {
      id: `mixkit-sfx-${c.id}`,
      title: c.title,
      library: "mixkit",
      category: cat,
      tags: [...new Set([cat, ...c.tags.map((t) => t.toLowerCase())])],
      kind: SFX_CATEGORIES[cat] ?? null,
      duration: c.duration,
      url: c.url,
      page: c.pages[0],
      license: "Mixkit Sound Effects Free License",
    };
  });
  await save("sfx/mixkit.json", out.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true })));
}

const jobs = { freepd, incompetech, mixkit, sfx };
const asked = process.argv.slice(2).filter((a): a is keyof typeof jobs => a in jobs);
for (const name of asked.length ? asked : (Object.keys(jobs) as (keyof typeof jobs)[])) {
  console.log(`building ${name}…`);
  await jobs[name]();
}
