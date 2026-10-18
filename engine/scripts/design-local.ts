// Renders a design composition written by hand (no call to Claude) over a finished cut:
// a sheet of preview frames to check it, or the final video.
//
//   node --env-file=../.env.local scripts/design-local.ts --cut cut.mp4 [--plan cut.plan.json] --comp comp.json \
//        [--asset name=file::description] [--logo logo.svg] (--preview 1,4.5,12 --sheet sheet.jpg | --out final.mp4)
//
// --plan gives the shots and, for translated videos, the subtitle lines (as DATA.subtitles).

import { mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { config } from "../src/config.ts";
import { designPass, designPreview, type DesignAsset, type DesignInput } from "../src/design.ts";
import { run } from "../src/exec.ts";
import { timelineOf, type EditPlan } from "../src/plan.ts";

const { values } = parseArgs({
  options: {
    cut: { type: "string" },
    plan: { type: "string" },
    comp: { type: "string" },
    asset: { type: "string", multiple: true },
    logo: { type: "string" },
    colors: { type: "string" },
    preview: { type: "string" },
    sheet: { type: "string" },
    out: { type: "string" },
  },
});
if (!values.cut || !values.comp || !(values.out || values.preview)) throw new Error("Give --cut, --comp and --out or --preview.");

const plan = values.plan ? (JSON.parse(await readFile(values.plan, "utf8")) as EditPlan) : null;
const assets: DesignAsset[] = (values.asset ?? []).map((a) => {
  const [, name, file, description] = a.match(/^([\w-]+)=([^:]+)(?:::(.*))?$/) ?? [];
  if (!name) throw new Error(`--asset ${a}: use name=file::description`);
  return { name, file: path.resolve(file), kind: /\.(mp4|mov|webm)$/i.test(file) ? "video" : "image", description: description ?? "" };
});
if (values.logo) assets.push({ name: "logo", file: path.resolve(values.logo), kind: "image", description: "The brand's logo" });
const input: DesignInput = {
  video: path.resolve(values.cut),
  words: [],
  subtitles: plan?.captions.mode === "translate" ? plan.on_screen_text.filter((t) => t.style === "caption").map((t) => ({ text: t.text, start: t.start, end: t.end })) : undefined,
  shots: plan ? timelineOf(plan).shots.map((s) => ({ start: s.start, end: s.end, beat: s.seg.beat, purpose: s.seg.purpose, hold: s.seg.hold })) : [],
  brief: "",
  brand: { colors: values.colors?.split(",") ?? [], fonts: [] },
  assets,
  workDir: path.join(os.tmpdir(), "magik-design", path.basename(values.cut, path.extname(values.cut))),
  output: path.resolve(values.out ?? "unused.mp4"),
  from: path.resolve(values.comp),
  review: false,
  onStep: (s) => console.log(s),
};

if (values.preview) {
  const times = values.preview.split(",").map(Number);
  const dir = path.join(input.workDir, "preview");
  const { frames, errors } = await designPreview(input, times, dir);
  errors.forEach((e) => console.log(`error: ${e}`));
  // The frames side by side, four to a row, for one look.
  const sheet = path.resolve(values.sheet ?? path.join(dir, "sheet.jpg"));
  await mkdir(path.dirname(sheet), { recursive: true });
  const cols = Math.min(4, frames.length);
  const rows = Math.ceil(frames.length / cols);
  await run(config.ffmpeg, [
    "-v", "error", "-y", ...frames.flatMap((f) => ["-i", f.file]),
    "-filter_complex", frames.length === 1 ? "[0:v]scale=480:-2" : `${frames.map((_, i) => `[${i}:v]scale=480:-2[s${i}]`).join(";")};${frames.map((_, i) => `[s${i}]`).join("")}xstack=inputs=${frames.length}:layout=${frames.map((_, i) => `${(i % cols) * 480}_${Math.floor(i / cols) * 854}`).join("|")}:fill=black`,
    "-frames:v", "1", "-q:v", "3", sheet,
  ]);
  console.log(`${frames.length} frame(s), ${cols}x${rows}: ${sheet}`);
} else {
  const { log } = await designPass(input);
  log.forEach((l) => console.log(l));
  console.log(`done: ${input.output}`);
}
