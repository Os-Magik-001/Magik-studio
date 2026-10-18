// Trains the engine on a style of video: studies the top reels of reference accounts
// (and any single reels), measures their pacing, and has Claude write a skill file
// for the engine in its own words, plus a music report.
//
//   node --env-file=../.env.local scripts/train-style.ts --name office-comedy-reels \
//     --accounts themarketinginterns cluely --reels https://www.instagram.com/reel/XXXX/ [--per 7]
//     [--style clean|dynamic] [--when word,word]   (--when: load the skill only when a brief names a word)
//
// Writes skills/<name>/SKILL.md and skills/<name>/reference.json (what it studied).

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { config } from "../src/config.ts";
import { describeLibrary, loadLibrary } from "../src/music.ts";
import { apify, plays, watchReels, type Item } from "../src/research.ts";

const { values, positionals } = parseArgs({
  options: {
    name: { type: "string" },
    accounts: { type: "string", multiple: true },
    reels: { type: "string", multiple: true },
    per: { type: "string", default: "7" },
    notes: { type: "string" },
    when: { type: "string" },
    style: { type: "string" },
  },
  allowPositionals: true,
});
if (!values.name || !/^[a-z0-9-]+$/.test(values.name)) throw new Error("--name must be a kebab-case skill name");
// Extra bare words after the flags are more accounts (or reel links): --accounts a b c.
const extra = positionals.flatMap((a) => a.split(/[\s,]+/)).filter(Boolean);
const accounts = [...(values.accounts ?? []), ...extra.filter((a) => !a.startsWith("http"))].flatMap((a) => a.split(/[\s,]+/)).map((a) => a.replace(/^@/, "")).filter(Boolean);
const reelUrls = [...(values.reels ?? []), ...extra.filter((a) => a.startsWith("http"))].flatMap((a) => a.split(/[\s,]+/)).filter(Boolean);
const per = Number(values.per);
const say = (s: string) => console.log(`${new Date().toISOString().slice(11, 19)}  ${s}`);

// ---------------------------------------------------------------- gather
say(`scraping ${accounts.map((a) => "@" + a).join(" ")} ${reelUrls.length ? `+ ${reelUrls.length} reel(s)` : ""}`);
const [fromAccounts, fromReels] = await Promise.all([
  accounts.length ? apify("apify~instagram-reel-scraper", { username: accounts, resultsLimit: 24, skipPinnedPosts: false }) : [],
  reelUrls.length ? apify("apify~instagram-reel-scraper", { username: reelUrls, resultsLimit: 1 }) : [],
]);
const usable = (i: Item) => !!i.videoUrl && (i.videoDuration ?? 30) <= 150;
const picks: Item[] = [];
for (const a of accounts) {
  const mine = fromAccounts.filter((i) => i.ownerUsername?.toLowerCase() === a.toLowerCase() && usable(i));
  mine.sort((x, y) => (plays(y) ?? 0) - (plays(x) ?? 0));
  picks.push(...mine.slice(0, per));
}
for (const r of fromReels.filter(usable)) if (!picks.some((p) => p.url === r.url)) picks.push(r);
say(`${fromAccounts.length + fromReels.length} reels found, studying ${picks.length}`);

const dir = path.join(os.tmpdir(), `magik-train-${values.name}`);
await mkdir(dir, { recursive: true });
const watched = await watchReels(picks, dir, say);

// ---------------------------------------------------------------- measurements
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);
const num = (xs: (number | null)[]) => xs.filter((x): x is number => x !== null);
const songs = new Map<string, number>();
let original = 0;
for (const w of watched) {
  const m = w.item.musicInfo;
  if (!m) continue;
  if (m.uses_original_audio) original++;
  else if (m.song_name) songs.set(`${m.artist_name ?? "?"} - ${m.song_name}`, (songs.get(`${m.artist_name ?? "?"} - ${m.song_name}`) ?? 0) + 1);
}
const summary = {
  reels: watched.length,
  medianDuration: median(watched.map((w) => w.duration)),
  medianCutsPerSecond: median(num(watched.map((w) => w.cuts))),
  medianShot: median(num(watched.map((w) => w.stats.medianShot))),
  medianWordsPerMinute: median(num(watched.map((w) => w.stats.wordsPerMinute))),
  medianSpeechShare: median(num(watched.map((w) => w.stats.speechShare))),
  medianLongestPause: median(num(watched.map((w) => w.stats.longestPause))),
  originalAudioShare: watched.length ? Math.round((original / watched.length) * 100) / 100 : null,
  songs: [...songs.entries()].sort((a, b) => b[1] - a[1]).map(([song, count]) => ({ song, count })),
};
say(`measured: ${JSON.stringify(summary)}`);

// ---------------------------------------------------------------- the skill, in the engine's words
const ENGINE = `What the edit engine can do (the skill must only ask for these):
- Shots: in/out points snapped to word edges, speed 0.25-4x, mute, punch-in or slow push (zoom 1-2.5), reframe on a focus point, per-shot brightness/contrast/saturation, an overall look (natural, warm, cool, punchy, cinematic, black_and_white, vintage), freeze frames ("hold" shots).
- Transitions: cut, crossfade, dip_to_black, dip_to_white, slide_left, slide_up, wipe_left, zoom_in, circle_open, glitch.
- Captions: auto word-timed (presets bold_pop, editorial, karaoke_box, classic, minimal, subtitle), translate mode (English subtitles of other languages), highlight words, position, size.
- Text: title, hero, serif, stacked, boxed, label, drip (dripping series logo), caption; animations pop, fade, slide_up, typewriter; text behind the person.
- Graphics: comment_cta, follow_pill, progress_bar, counter, emoji, circle.
- Overlays: cutaway (B-roll over the voice), card (floating clip or screenshot).
- 3D motion templates: character_intro (freeze-frame intro of a person), cast_lineup, title_3d, stat_card, lower_third_3d.
- Sound: a music bed from the library that dips under speech (volume low/medium/high, start point), sound effects whoosh, pop, hit, riser, click, ding.`;

const Out = z.object({
  description: z.string().describe("One line for the skill's front matter: what kind of video it covers"),
  body: z
    .string()
    .describe("The skill body in Markdown, written to the editor (Claude) in the second person, in the same voice as a studio editing skill: when to use it, what these videos share (with the measured numbers), hook, structure recipes, pacing and cutting rules (how tight around words, pauses, shot lengths), framing, text and captions, motion templates, music and sound, what to avoid. Concrete numbers, mapped to the engine's tools. 700 to 1200 words."),
  music: z.object({
    summary: z.string().describe("What audio these reels use and why it works"),
    recommendation: z.string().describe("What the engine should use for this style: original audio vs music, genre and mood, tempo, volume under dialogue, where music enters and drops out"),
    library_moods: z.array(z.string()).describe("Mood/genre words to pick a track from a library"),
  }),
});

const content: Anthropic.Beta.BetaContentBlockParam[] = [
  {
    type: "text",
    text: `Reference accounts: ${accounts.map((a) => "@" + a).join(", ")}${reelUrls.length ? `; single reels: ${reelUrls.join(", ")}` : ""}.
${values.notes ? `Notes from the studio: ${values.notes}\n` : ""}
Measured across the ${watched.length} reels: ${JSON.stringify(summary)}

${ENGINE}

Music library available to the engine:
${describeLibrary(await loadLibrary())}

The reels, each with its numbers, caption, transcript and a contact sheet (a grid of frames across the reel, left to right, top to bottom):`,
  },
];
for (const [k, w] of watched.entries()) {
  const i = w.item;
  content.push({
    type: "text",
    text: `Reel ${k + 1}: @${i.ownerUsername} · ${plays(i) ?? "?"} plays · ${i.likesCount ?? "?"} likes · ${w.duration.toFixed(1)}s · ${w.cuts ?? "?"} cuts/s · median shot ${w.stats.medianShot ?? "?"}s · ${w.stats.wordsPerMinute ?? "?"} words/min · speech ${Math.round((w.stats.speechShare ?? 0) * 100)}% of the time · longest pause ${w.stats.longestPause ?? "?"}s · audio: ${i.musicInfo?.uses_original_audio ? "original" : i.musicInfo?.song_name ? `${i.musicInfo.artist_name} - ${i.musicInfo.song_name}` : "?"}
Caption: ${(i.caption ?? "").slice(0, 300)}
Transcript: ${w.transcript.slice(0, 1200) || "(no speech)"}`,
  });
  if (w.sheet) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: (await readFile(w.sheet)).toString("base64") } });
}
content.push({ type: "text", text: "Write the skill file for this style, and the music report." });

say("Claude is studying the reels and writing the skill");
const anthropic = new Anthropic();
const response = await anthropic.beta.messages.parse({
  model: config.model,
  max_tokens: 20000,
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
  thinking: { type: "adaptive" },
  output_config: { effort: "high", format: betaZodOutputFormat(Out) },
  system:
    "You are the head editor at Magik Studio. You study reference reels frame by frame and write the house skill the studio's automatic editor (also Claude) follows to make videos in that style. Be precise and quantitative, and only use techniques the engine can perform.",
  messages: [{ role: "user", content }],
});
const out = response.parsed_output;
if (!out) throw new Error("Claude's skill came back incomplete.");

const skillDir = path.join(import.meta.dirname, "..", "skills", values.name);
await mkdir(skillDir, { recursive: true });
await writeFile(
  path.join(skillDir, "SKILL.md"),
  `---\nname: ${values.name}\ndescription: ${out.description.replace(/\n/g, " ")}\nformats: social_short, ad\n${values.style ? `style: ${values.style}\n` : ""}${values.when ? `when: ${values.when}\n` : ""}---\n\n${out.body.trim()}\n\n**Music and sound** (from the reference reels)\n- ${out.music.recommendation.trim()}\n- Library moods: ${out.music.library_moods.join(", ")}.\n`,
);
await writeFile(
  path.join(skillDir, "reference.json"),
  JSON.stringify(
    {
      trainedAt: new Date().toISOString(),
      accounts,
      reels: watched.map((w) => ({ url: w.item.url, owner: w.item.ownerUsername, plays: plays(w.item), duration: Math.round(w.duration * 10) / 10, cutsPerSecond: w.cuts, ...w.stats, audio: w.item.musicInfo })),
      summary,
      music: out.music,
    },
    null,
    1,
  ),
);
await rm(dir, { recursive: true, force: true });
say(`wrote skills/${values.name}/SKILL.md`);
