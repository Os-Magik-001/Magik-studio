// Learns from an account that teaches video editing: scrapes all of its reels, watches
// each one (transcript, contact sheets, pacing), has Claude pull out every technique it
// teaches, then turns them into skills for the engine, mapped to what the engine can do,
// plus a style skill: how the creator's own videos are made.
//
//   node --env-file=<engine env> scripts/learn-account.ts --account omgadrian [--name omgadrian-editing] [--stop-after scrape|sort|watch|extract|skills]
//
// Every stage is cached in ~/Library/Caches/magik-learn/<account>/, so a rerun picks up
// where it stopped. Writes skills/<name>*/SKILL.md and eval/learn/<account>.md (the
// techniques found, and those the engine can't do yet).

import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { config } from "../src/config.ts";
import { plays, watchReels, type Item } from "../src/research.ts";

const { values } = parseArgs({
  options: {
    account: { type: "string" },
    name: { type: "string" },
    "stop-after": { type: "string" },
    limit: { type: "string", default: "2000" },
  },
});
const account = values.account?.replace(/^@/, "").toLowerCase();
if (!account || !/^[a-z0-9._]+$/.test(account)) throw new Error("--account must be an Instagram username");
const name = values.name ?? `${account.replace(/[^a-z0-9]+/g, "-")}-editing`;
const t0 = Date.now();
const say = (s: string) => console.log(`${((Date.now() - t0) / 1000).toFixed(0).padStart(5)}s  ${s}`);
const cache = path.join(os.homedir(), "Library/Caches/magik-learn", account);
await mkdir(cache, { recursive: true });
const exists = (f: string) => stat(f).then(() => true, () => false);
const readJson = async <T>(f: string): Promise<T> => JSON.parse(await readFile(f, "utf8"));

// The JSON schema sent to Claude: without the keys structured outputs doesn't take.
const jsonSchema = (schema: z.ZodType) => {
  const { $schema: _, ...rest } = z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
  return JSON.parse(JSON.stringify(rest, (k, v) => (k === "default" ? undefined : v?.type === "object" ? { ...v, additionalProperties: false } : v)));
};
// One Claude call with a structured answer. Streamed (long thinking passes the SDK's
// 10-minute limit for plain requests) and retried when the stream drops halfway.
const anthropic = new Anthropic();
async function ask<T>(schema: z.ZodType<T>, params: Omit<Anthropic.Beta.MessageCreateParamsNonStreaming, "model" | "output_config"> & { effort?: "low" | "medium" | "high" }): Promise<T> {
  const { effort = "high", ...rest } = params;
  for (let attempt = 1; ; attempt++) {
    try {
      const message = await anthropic.beta.messages.stream({ ...rest, model: config.model, output_config: { effort, format: { type: "json_schema", schema: jsonSchema(schema) } } }).finalMessage();
      if (message.stop_reason === "max_tokens") throw new Error("Claude's answer came back incomplete.");
      const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      return schema.parse(JSON.parse(text));
    } catch (err) {
      const retry = err instanceof Anthropic.APIConnectionError || err instanceof z.ZodError || err instanceof SyntaxError || (err instanceof Anthropic.AnthropicError && !(err instanceof Anthropic.APIError) && /terminated|ECONNRESET|socket/i.test(err.message));
      if (!retry || attempt >= 3) throw err;
      say(`Claude's answer failed (${err instanceof Error ? err.message.slice(0, 120) : err}), retrying (${attempt + 1}/3)`);
    }
  }
}

// ---------------------------------------------------------------- scrape (all reels)
// A large account takes longer than Apify's synchronous limit, so the run is started,
// polled and its dataset read.
async function scrapeAll(): Promise<Item[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is missing from the engine's environment.");
  const api = "https://api.apify.com/v2";
  const headers = { "content-type": "application/json", authorization: `Bearer ${token}` };
  const start = await fetch(`${api}/acts/apify~instagram-reel-scraper/runs`, {
    method: "POST",
    headers,
    body: JSON.stringify({ username: [account], resultsLimit: Number(values.limit), skipPinnedPosts: false }),
  });
  if (!start.ok) throw new Error(`Apify returned ${start.status} when starting the scrape.`);
  const run = (await start.json()).data as { id: string; defaultDatasetId: string };
  for (;;) {
    await new Promise((r) => setTimeout(r, 10_000));
    const s = (await (await fetch(`${api}/actor-runs/${run.id}`, { headers })).json()).data as { status: string; stats?: { itemCount?: number } };
    if (s.status === "SUCCEEDED") break;
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(s.status)) throw new Error(`The Apify scrape ended with ${s.status}.`);
    say(`scraping @${account}: ${s.status.toLowerCase()}`);
  }
  const items: Item[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = (await (await fetch(`${api}/datasets/${run.defaultDatasetId}/items?offset=${offset}&limit=1000`, { headers })).json()) as Item[];
    items.push(...page);
    if (page.length < 1000) break;
  }
  return items;
}

const itemsFile = path.join(cache, "items.json");
let items: Item[];
if (await exists(itemsFile)) items = await readJson(itemsFile);
else {
  items = (await scrapeAll()).filter((i) => i.ownerUsername?.toLowerCase() === account && i.videoUrl);
  const seen = new Set<string>();
  items = items.filter((i) => {
    const key = i.shortCode ?? i.url!;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  await writeFile(itemsFile, JSON.stringify(items, null, 1));
}
const total = items.reduce((s, i) => s + (i.videoDuration ?? 0), 0);
say(`@${account}: ${items.length} reels, ${(total / 60).toFixed(0)} min in all`);
if (values["stop-after"] === "scrape") process.exit(0);

// ---------------------------------------------------------------- keep the lessons
// The account also posts ads, vlogs and pets: Claude sorts the reels by caption first,
// so only the lessons (and the doubtful ones) are downloaded and studied.
const Sorted = z.object({ reels: z.array(z.object({ index: z.number(), kind: z.enum(["lesson", "maybe", "no"]) })) });
const sortedFile = path.join(cache, "sorted.json");
let kinds: Record<string, "lesson" | "maybe" | "no"> = (await exists(sortedFile)) ? await readJson(sortedFile) : {};
const unsorted = items.filter((i) => !kinds[i.shortCode ?? i.url!]);
for (let b = 0; b < unsorted.length; b += 150) {
  const batch = unsorted.slice(b, b + 150);
  say(`sorting captions ${b + 1}-${b + batch.length} of ${unsorted.length}`);
  const res = await ask(Sorted, {
    max_tokens: 16000,
    effort: "low",
    system: "You sort an Instagram creator's reels by caption. lesson = it teaches or breaks down video editing, filmmaking, color, sound, motion or storytelling technique (tutorials, breakdowns, before/after, 'how I edited this'); maybe = it could show or explain technique but the caption is unclear; no = ads, vlogs, pets, personal news, giveaways with no technique.",
    messages: [{ role: "user", content: batch.map((i, k) => `${k + 1}. ${(i.caption ?? "").replace(/\s+/g, " ").slice(0, 400).toWellFormed() || "(no caption)"}`).join("\n") }],
  });
  for (const r of res.reels) {
    const i = batch[r.index - 1];
    if (i) kinds[i.shortCode ?? i.url!] = r.kind;
  }
  await writeFile(sortedFile, JSON.stringify(kinds));
}
const count = (k: string) => Object.values(kinds).filter((v) => v === k).length;
say(`captions: ${count("lesson")} lessons, ${count("maybe")} maybe, ${count("no")} not lessons`);
items = items.filter((i) => kinds[i.shortCode ?? i.url!] !== "no");
if (values["stop-after"] === "sort") process.exit(0);

// ---------------------------------------------------------------- watch every reel
// One cached record per reel: transcript, numbers and its contact sheets.
type Seen = { code: string; url?: string; plays: number | null; likes?: number; caption: string; duration: number; transcript: string; cuts: number | null; stats: Record<string, number | null>; sheets: string[] };
const watchedDir = path.join(cache, "watched");
await mkdir(watchedDir, { recursive: true });
const seen: Seen[] = [];
for (const [k, item] of items.entries()) {
  const code = item.shortCode ?? String(k);
  const file = path.join(watchedDir, `${code}.json`);
  if (await exists(file)) {
    seen.push(await readJson(file));
    continue;
  }
  say(`watching reel ${k + 1} of ${items.length}`);
  const work = path.join(cache, "work", code);
  await mkdir(work, { recursive: true });
  const [w] = await watchReels([item], work);
  if (!w) continue;
  // Keep the contact sheets (tutorials show the technique on screen), drop the video.
  const sheets: string[] = [];
  const sheetDir = path.join(work, "sheets-0");
  const files = (await readdir(sheetDir).catch(() => [])).filter((f) => f.endsWith(".jpg")).sort().slice(0, 3);
  for (const [s, f] of files.entries()) {
    const dst = path.join(watchedDir, `${code}-${s}.jpg`);
    await writeFile(dst, await readFile(path.join(sheetDir, f)));
    sheets.push(dst);
  }
  const record: Seen = { code, url: item.url, plays: plays(item), likes: item.likesCount, caption: item.caption ?? "", duration: w.duration, transcript: w.transcript, cuts: w.cuts, stats: w.stats, sheets };
  await writeFile(file, JSON.stringify(record));
  await rm(work, { recursive: true, force: true });
  seen.push(record);
}
say(`watched ${seen.length} reels`);
if (values["stop-after"] === "watch") process.exit(0);

// ---------------------------------------------------------------- extract the techniques
const ENGINE = `What the edit engine can do (map every technique to these, or say it can't be done):
- Shots: in/out points snapped to word edges (the editor quotes the kept words, code times the cut), speed 0.25-4x, mute, punch-in or slow push (zoom 1-2.5), reframe on a focus point, per-shot brightness/contrast/saturation, an overall look (natural, warm, cool, punchy, cinematic, black_and_white, vintage), freeze frames ("hold" shots), each shot labelled setup/punchline/reaction/other.
- Automatic: split edits (L-cut 6 frames onto reactions, J-cut 4 frames into a new speaker), silence and filler trimming with natural gaps (0.25-0.45 s), retakes grouped and the last take preferred, dialogue loudness matched across clips (-20 LUFS, final -14), 15 ms audio fades at cuts.
- Transitions: cut, crossfade, dip_to_black, dip_to_white, slide_left, slide_up, wipe_left, zoom_in, circle_open, glitch.
- Captions: auto word-timed (presets bold_pop, editorial, karaoke_box, classic, minimal, subtitle), translate mode (English subtitles of other languages), highlight words, position, size, words per screen.
- Text: title, hero, serif, stacked, boxed, label, drip, caption; animations pop, fade, slide_up, typewriter; text behind the person.
- Graphics: comment_cta, follow_pill, progress_bar, counter, emoji, circle.
- Overlays: cutaway (B-roll over the voice), card (floating clip or screenshot).
- 3D motion templates: character_intro (freeze-frame intro of a person), cast_lineup, title_3d, stat_card, lower_third_3d.
- Sound: a music bed from the library that dips under speech (volume, start point, sections), sound effects whoosh, pop, hit, riser, click, ding.
- Styles: "clean" (invisible editing: cuts, framing, subtitles only, like Cluely's skits) and "dynamic" (motion, text, sound design).`;

const Technique = z.object({
  name: z.string().describe("Short name of the technique"),
  category: z.enum(["cutting", "pacing", "story", "hook", "takes", "framing", "transitions", "text", "captions", "motion", "sound", "music", "color", "other"]).catch("other"),
  rule: z.string().describe("The technique as an instruction to an editor, with every number the reel gives (frames, seconds, dB, percent)"),
  why: z.string().describe("Why it works, as the creator explains it"),
  style: z.enum(["clean", "dynamic", "both"]).catch("both").describe("clean if it fits invisible, effect-free editing; dynamic if it relies on effects, motion or sound design"),
  engine: z.string().describe("How the engine does it with its tools, or 'not possible: <what is missing>'"),
});
const Notes = z.object({
  reels: z.array(
    z.object({
      index: z.number().describe("The reel's number in this batch"),
      lesson: z.string().describe("What the reel teaches in one sentence, or 'not a lesson' for promos, memes and personal posts"),
      techniques: z.array(Technique),
    }),
  ),
});

const notesFile = path.join(cache, "notes.json");
let notes: { code: string; lesson: string; techniques: z.infer<typeof Technique>[] }[] = (await exists(notesFile)) ? await readJson(notesFile) : [];
const done = new Set(notes.map((n) => n.code));
const todo = seen.filter((s) => !done.has(s.code) && (s.transcript.trim() || s.caption.trim()));
const BATCH = 8;
for (let b = 0; b < todo.length; b += BATCH) {
  const batch = todo.slice(b, b + BATCH);
  say(`Claude is studying reels ${b + 1}-${b + batch.length} of ${todo.length}`);
  const content: Anthropic.Beta.BetaContentBlockParam[] = [{ type: "text", text: `${ENGINE}\n\nReels from @${account}, an account that teaches video editing. Each has its caption, transcript, numbers and contact sheets (grids of frames across the reel, left to right, top to bottom; on-screen demonstrations, timelines and settings are often visible there).` }];
  for (const [k, s] of batch.entries()) {
    content.push({ type: "text", text: `Reel ${k + 1} · ${s.plays ?? "?"} plays · ${s.duration.toFixed(1)}s · ${s.cuts ?? "?"} cuts/s · ${s.stats.wordsPerMinute ?? "?"} words/min\nCaption: ${s.caption.slice(0, 1500).toWellFormed()}\nTranscript: ${s.transcript.slice(0, 6000).toWellFormed() || "(no speech)"}` });
    for (const sheet of s.sheets.slice(0, 2)) {
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: (await readFile(sheet)).toString("base64") } });
    }
  }
  content.push({ type: "text", text: "For every reel, extract each editing technique it teaches or clearly demonstrates. Be faithful to the creator: no generic advice that isn't in the reel. Merge nothing across reels." });
  const out = await ask(Notes, {
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    system: "You are the head editor at Magik Studio. You study editing tutorials and write down, precisely and with numbers, every technique they teach, so the studio's automatic editor can learn them.",
    messages: [{ role: "user", content }],
  });
  for (const r of out.reels) {
    const s = batch[r.index - 1];
    if (s) notes.push({ code: s.code, lesson: r.lesson, techniques: r.techniques });
  }
  await writeFile(notesFile, JSON.stringify(notes, null, 1));
}
const techniques = notes.flatMap((n) => n.techniques.map((t) => ({ ...t, reel: n.code })));
say(`${techniques.length} techniques from ${notes.filter((n) => n.techniques.length).length} lessons`);
if (values["stop-after"] === "extract") process.exit(0);

// ---------------------------------------------------------------- the skills
const existing = ["clean-comedy-edit", "picking-takes", "editing-fundamentals", "office-comedy-reels"];
const skillsDir = fileURLToPath(new URL("../skills", import.meta.url));
const current = await Promise.all(existing.map(async (s) => `--- ${s} ---\n${await readFile(path.join(skillsDir, s, "SKILL.md"), "utf8").catch(() => "")}`));
const Skills = z.object({
  skills: z
    .array(
      z.object({
        suffix: z.string().describe("kebab-case suffix of the skill's name, e.g. 'cutting' or 'sound'"),
        description: z.string().describe("One line: what the skill covers"),
        style: z.enum(["clean", "dynamic", "all"]).describe("Which editing style loads it: clean (invisible edits), dynamic (effects), all (both)"),
        body: z.string().describe("The skill in Markdown, to the editor (Claude) in the second person: numbered rules, each concrete, with numbers, mapped to the engine's tools; one or two short worked examples. 300 to 900 words."),
      }),
    )
    .describe("2 to 4 skills, grouped by topic and by style, so the clean style only loads what fits it"),
  conflicts: z.array(z.string()).describe("Where the creator's teaching contradicts the studio's current skills, and which is right for the studio's clients (clean comedy skits, dynamic reels)"),
  missing: z.array(z.object({ technique: z.string(), needs: z.string(), reels: z.number() })).describe("Techniques the engine can't do yet, what it would need, and in how many reels they come up, most frequent first"),
});
say("Claude is writing the skills");
const out = await ask(Skills, {
  max_tokens: 48000,
  thinking: { type: "adaptive" },
  system: "You are the head editor at Magik Studio. You turn a creator's editing lessons into the house skills the studio's automatic editor (also Claude) follows. Keep only what is concrete and repeatable, drop duplicates and generic advice, never contradict the engine's automatic behaviour, and only ask for what the engine can do.",
  messages: [
    {
      role: "user",
      content: `${ENGINE}\n\nThe studio's current skills on these topics (don't repeat what they already say; flag contradictions):\n${current.join("\n\n")}\n\nTechniques taught by @${account} across ${notes.length} reels (each with the reel it comes from):\n${JSON.stringify(techniques)}\n\nWrite the skills, the conflicts and the missing capabilities.`,
    },
  ],
});
const written: string[] = [];
for (const s of out.skills) {
  const skill = `${name}-${s.suffix.replace(/[^a-z0-9-]+/g, "-")}`;
  await mkdir(path.join(skillsDir, skill), { recursive: true });
  await writeFile(path.join(skillsDir, skill, "SKILL.md"), `---\nname: ${skill}\ndescription: ${s.description.replace(/\n/g, " ")} (learned from @${account})\nformats: all\n${s.style === "all" ? "" : `style: ${s.style}\n`}---\n\n${s.body.trim()}\n`);
  written.push(skill);
}
const reportDir = fileURLToPath(new URL("../eval/learn", import.meta.url));
await mkdir(reportDir, { recursive: true });
const byCategory = Object.entries(Object.groupBy(techniques, (t) => t.category)).sort((a, b) => b[1]!.length - a[1]!.length);
await writeFile(
  path.join(reportDir, `${account}.md`),
  `# Learned from @${account}\n\n${new Date().toISOString().slice(0, 10)} · ${items.length} reels scraped, ${count("lesson") + count("maybe")} kept as lessons by caption, ${seen.length} watched, ${notes.filter((n) => n.techniques.length).length} lessons, ${techniques.length} techniques\n\nSkills written: ${written.map((w) => `\`${w}\``).join(", ")}\n\n## Conflicts with the current skills\n\n${out.conflicts.map((c) => `- ${c}`).join("\n")}\n\n## What the engine can't do yet\n\n${out.missing.map((m) => `- **${m.technique}** (${m.reels} reels): ${m.needs}`).join("\n")}\n\n## Techniques by topic\n\n${byCategory.map(([c, ts]) => `### ${c} (${ts!.length})\n\n${ts!.map((t) => `- **${t.name}** [${t.style}]: ${t.rule} _Engine: ${t.engine}_`).join("\n")}`).join("\n\n")}\n`,
);
say(`wrote ${written.map((w) => `skills/${w}`).join(", ")} and eval/learn/${account}.md`);
if (values["stop-after"] === "skills") process.exit(0);

// ---------------------------------------------------------------- how the creator's own videos are made
// Measured across every reel watched, and seen on the most-played ones.
const med = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : null;
};
const measured = {
  reels: seen.length,
  medianDuration: med(seen.map((s) => Math.round(s.duration))),
  medianCutsPerSecond: med(seen.map((s) => s.cuts)),
  medianShot: med(seen.map((s) => s.stats.medianShot)),
  medianWordsPerMinute: med(seen.map((s) => s.stats.wordsPerMinute)),
  medianSpeechShare: med(seen.map((s) => s.stats.speechShare)),
  medianLongestPause: med(seen.map((s) => s.stats.longestPause)),
};
const top = [...seen].sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0)).slice(0, 16);
const Style = z.object({
  description: z.string().describe("One line for the skill's front matter"),
  style: z.enum(["clean", "dynamic", "all"]).describe("Which editing style should load it"),
  body: z.string().describe("How to edit a video the way this creator does, to the editor (Claude) in the second person: what his videos share (with the measured numbers), the hook in the first 2 seconds, structure, pacing and cutting (how tight around words, pauses, shot lengths), framing and punch-ins, B-roll and screen recordings, text and captions, motion, music and sound design, the ending; concrete numbers, mapped to the engine's tools; what to avoid. 700 to 1200 words."),
});
const styleContent: Anthropic.Beta.BetaContentBlockParam[] = [
  { type: "text", text: `${ENGINE}\n\nThe reels of @${account}, a creator known for his editing. Measured across ${seen.length} of his reels: ${JSON.stringify(measured)}\n\nHis ${top.length} most-played reels, each with its numbers, caption, transcript and contact sheets (frames across the reel, left to right, top to bottom):` },
];
for (const [k, s] of top.entries()) {
  styleContent.push({ type: "text", text: `Reel ${k + 1} · ${s.plays ?? "?"} plays · ${s.duration.toFixed(1)}s · ${s.cuts ?? "?"} cuts/s · median shot ${s.stats.medianShot ?? "?"}s · ${s.stats.wordsPerMinute ?? "?"} words/min · longest pause ${s.stats.longestPause ?? "?"}s\nCaption: ${s.caption.slice(0, 400).toWellFormed()}\nTranscript: ${s.transcript.slice(0, 2500).toWellFormed() || "(no speech)"}` });
  for (const sheet of s.sheets.slice(0, 2)) styleContent.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: (await readFile(sheet)).toString("base64") } });
}
styleContent.push({ type: "text", text: "Write the skill that makes the engine edit videos the way he does." });
say("Claude is studying how his own videos are made");
const st = await ask(Style, {
  max_tokens: 24000,
  thinking: { type: "adaptive" },
  system: "You are the head editor at Magik Studio. You study a creator's reels frame by frame and write the house skill the studio's automatic editor (also Claude) follows to make videos in that style. Be precise and quantitative, and only use techniques the engine can perform.",
  messages: [{ role: "user", content: styleContent }],
});
const styleSkill = `${account.replace(/[^a-z0-9]+/g, "-")}-style`;
await mkdir(path.join(skillsDir, styleSkill), { recursive: true });
await writeFile(path.join(skillsDir, styleSkill, "SKILL.md"), `---\nname: ${styleSkill}\ndescription: ${st.description.replace(/\n/g, " ")} (learned from @${account})\nformats: social_short, ad\n${st.style === "all" ? "" : `style: ${st.style}\n`}---\n\n${st.body.trim()}\n`);
await writeFile(path.join(skillsDir, styleSkill, "reference.json"), JSON.stringify({ trainedAt: new Date().toISOString(), account, measured, reels: top.map((s) => ({ url: s.url, plays: s.plays, duration: Math.round(s.duration * 10) / 10, cutsPerSecond: s.cuts, ...s.stats })) }, null, 1));
say(`wrote skills/${styleSkill}`);
