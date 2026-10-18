// The test bench: the engine edits episodes the team has already edited, from the same
// raw footage, and its cut is measured against the team's final. Every change to the
// engine can then be checked on real episodes instead of judged by eye.
//
//   node --env-file=<engine env> scripts/eval.ts --label baseline [--episodes 2,3,4] [--no-review] [--reference-only]
//
// Per episode: the raw clips are transcribed once (cached), the team's final is
// measured (cuts, air around them, gaps between lines, length, which take each line
// came from), the engine edits the footage as in production (clean style), and its
// cut is measured the same way. Reports go to eval/reports/<label>.md and .json.

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { driveWorkingCopy, listDriveFiles } from "../src/drive.ts";
import { cutStats, detectCuts, matchTakes, takeAgreement, wordOverlap, type CutStats, type TakeMatch } from "../src/evaluate.ts";
import { planAndRender, prepareClips, watchClips } from "../src/job.ts";
import { probe } from "../src/media.ts";
import type { Clip } from "../src/plan.ts";
import { transcribe, type TranscriptLine } from "../src/transcribe.ts";

const SERIES = "1jPLHtibpD5RxMe9kK5lNv7FSUlkm04dQ";
const BRIEF = "The Boyz: a French and franglais mockumentary sitcom on Instagram about a group of friends building a billion-dollar startup (Jillian 'MI6', the face of the company; Aimen 'Joyboy', the CEO; Rassim 'Ghost', the CMO). Office-comedy skits like Cluely and The Marketing Interns.";

const { values } = parseArgs({
  options: {
    label: { type: "string", default: new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-") },
    episodes: { type: "string" },
    "no-review": { type: "boolean" },
    "reference-only": { type: "boolean" },
  },
});

const t0 = Date.now();
const say = (text: string) => console.log(`${((Date.now() - t0) / 1000).toFixed(0).padStart(5)}s  ${text}`);
const reportsDir = fileURLToPath(new URL("../eval/reports", import.meta.url));
const cacheRoot = path.join(os.homedir(), "Library/Caches/magik-eval");
const exists = (f: string) => stat(f).then(() => true, () => false);

// The series folder: raw clips, inserts and the team's final, per episode.
const files = await listDriveFiles(SERIES, (f) => /\.(mp4|mov)$/i.test(f.name));
const intro = files.find((f) => f.parent === "Intro" && /without episode/i.test(f.name));
const FINAL = /final|sans intro|timeline|^vid \d/i;
const episodes = [...new Set(files.map((f) => f.parent).filter((p) => /^Episode \d+$/.test(p)))]
  .map((folder) => {
    const own = files.filter((f) => f.parent === folder);
    const reference = own.find((f) => /final sub/i.test(f.name)) ?? own.find((f) => /final/i.test(f.name));
    return { n: Number(folder.split(" ")[1]), folder, reference, sources: own.filter((f) => !FINAL.test(f.name)) };
  })
  .filter((e) => e.reference && (!values.episodes || values.episodes.split(",").map(Number).includes(e.n)))
  .sort((a, b) => a.n - b.n);
say(`${episodes.length} episode(s) with a team final: ${episodes.map((e) => e.n).join(", ")}`);

type Side = { stats: CutStats; takes: TakeMatch[]; text: string };
type Result = { episode: number; reference: Side; engine?: Side & { file: string; summary: string }; overlap?: number; agreement?: ReturnType<typeof takeAgreement>; error?: string };

// A finished video measured: its words, its cuts and which take each line came from.
async function measure(file: string, dir: string, sources: Clip[]): Promise<Side> {
  await mkdir(dir, { recursive: true });
  const lines: TranscriptLine[] = (await transcribe(file, dir)) ?? [];
  const words = lines.flatMap((l) => l.words ?? []);
  const { duration } = await probe(file);
  const stats = cutStats(words, await detectCuts(file), duration);
  const takes = await matchTakes(file, lines, sources.map((c) => ({ id: c.id, file: c.file, transcript: c.transcript ?? [] })));
  return { stats, takes, text: lines.map((l) => l.text).join(" ") };
}

const results: Result[] = [];
for (const ep of episodes) {
  const dir = path.join(cacheRoot, `episode-${ep.n}`);
  await mkdir(dir, { recursive: true });
  const note = (t: string) => say(`ep ${ep.n}: ${t}`);
  try {
    // Raw clips, transcribed once.
    const saved = path.join(dir, "clips.json");
    let clips: Clip[];
    if (await exists(saved)) clips = JSON.parse(await readFile(saved, "utf8"));
    else {
      const sources = [...ep.sources, ...(intro ? [intro] : [])].map((f) => ({ name: f.name, drive: f.id }));
      clips = await prepareClips(sources, dir, note, () => {}, new Set());
      await watchClips(clips, dir, BRIEF, note);
      await writeFile(saved, JSON.stringify(clips));
    }

    // The team's final.
    const refFile = path.join(dir, "reference.json");
    let reference: Side;
    if (await exists(refFile)) reference = JSON.parse(await readFile(refFile, "utf8"));
    else {
      note(`measuring the team's final (${ep.reference!.name})`);
      const copy = await driveWorkingCopy(ep.reference!.id);
      reference = await measure(copy.file, path.join(dir, "reference"), clips);
      await writeFile(refFile, JSON.stringify(reference));
    }
    const result: Result = { episode: ep.n, reference };
    results.push(result);
    if (values["reference-only"]) continue;

    // The engine's cut, as in production (clean style, self-review), with the final's
    // words standing in for the script when the app has none.
    const output = path.join(dir, `${values.label}.mp4`);
    const work = path.join(dir, `work-${values.label}`);
    note("the engine is editing");
    const { plan } = await planAndRender(
      {
        formatKey: "social_short",
        brand: { colors: [], fonts: [], logoFile: null },
        clientName: "The Boyz",
        title: `Episode ${ep.n}`,
        format: "social short",
        aspect: "9:16",
        brief: BRIEF,
        script: `(Lines as performed in the final episode; times not given.)\n${reference.text}`,
        shots: [],
        brandKit: null,
        instructions: null,
        source: "launch",
        previous: null,
        selfReview: !values["no-review"],
        clean: true,
      },
      clips,
      work,
      output,
      note,
      note,
    );
    await writeFile(output.replace(/\.mp4$/, ".plan.json"), JSON.stringify(plan, null, 1));
    const engine = await measure(output, path.join(work, "measure"), clips);
    result.engine = { ...engine, file: output, summary: plan.summary };
    result.overlap = wordOverlap(reference.text, engine.text);
    result.agreement = takeAgreement(reference.takes, engine.takes);
    note(`takes ${result.agreement.same}/${result.agreement.same + result.agreement.other + result.agreement.missing}, words ${(result.overlap * 100).toFixed(0)}%, ${engine.stats.duration.toFixed(1)}s vs ${reference.stats.duration.toFixed(1)}s`);
  } catch (err) {
    note(`failed: ${err instanceof Error ? err.message : err}`);
    results.push({ episode: ep.n, reference: undefined as never, error: String(err) });
  }
}

// The report: per episode and on average, engine against team.
const f = (x: number | undefined, d = 2) => (x === undefined || Number.isNaN(x) ? "–" : x.toFixed(d));
const ROWS: [string, keyof CutStats, number][] = [
  ["Length (s)", "duration", 1],
  ["Cuts per second", "cutsPerSecond", 2],
  ["Median shot (s)", "medianShot", 2],
  ["Air before the first word after a cut (s)", "headAir", 2],
  ["Air after the last word before a cut (s)", "tailAir", 2],
  ["Gap between phrases, median (s)", "gap", 2],
  ["Gap between phrases, 90th percentile (s)", "gapP90", 2],
  ["Gaps over 0.9 s", "longGaps", 0],
  ["Words per minute", "wordsPerMinute", 0],
];
const done = results.filter((r) => r.engine);
const avg = (xs: number[]) => xs.filter((x) => !Number.isNaN(x)).reduce((s, x, _, a) => s + x / a.length, 0);
let md = `# Test bench: ${values.label}\n\n${new Date().toISOString().slice(0, 16)} · ${done.length} episode(s) edited${values["no-review"] ? " · no self-review" : ""}\n\n`;
if (done.length) {
  md += `## Average\n\n| | Team | Engine |\n|---|---|---|\n`;
  for (const [label, key, d] of ROWS) md += `| ${label} | ${f(avg(done.map((r) => r.reference.stats[key])), d)} | ${f(avg(done.map((r) => r.engine!.stats[key])), d)} |\n`;
  md += `| Same take as the team | | ${f(avg(done.map((r) => r.agreement!.rate * 100)), 0)}% |\n| Dialogue in common with the team | | ${f(avg(done.map((r) => r.overlap! * 100)), 0)}% |\n\n`;
}
for (const r of results) {
  md += `## Episode ${r.episode}\n\n`;
  if (r.error) {
    md += `Failed: ${r.error}\n\n`;
    continue;
  }
  md += `| | Team | Engine |\n|---|---|---|\n`;
  for (const [label, key, d] of ROWS) md += `| ${label} | ${f(r.reference.stats[key], d)} | ${f(r.engine?.stats[key], d)} |\n`;
  if (r.engine) {
    const a = r.agreement!;
    md += `\nSame take as the team: ${a.same} of ${a.same + a.other + a.missing} lines (${a.other} other take, ${a.missing} left out). Dialogue in common: ${f(r.overlap! * 100, 0)}%.\n\n`;
    if (a.details.length) md += a.details.map((d) => `- ${d}`).join("\n") + "\n\n";
    md += `Engine cut: \`${r.engine.file}\`\n\n`;
  }
}
await mkdir(reportsDir, { recursive: true });
await writeFile(path.join(reportsDir, `${values.label}.md`), md);
await writeFile(path.join(reportsDir, `${values.label}.json`), JSON.stringify(results.map((r) => ({ ...r, reference: r.reference && { stats: r.reference.stats, takes: r.reference.takes } })), null, 1));
say(`report: ${path.join(reportsDir, `${values.label}.md`)}`);
