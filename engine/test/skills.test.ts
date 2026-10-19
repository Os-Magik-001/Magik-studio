import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { loadSkills, parseSkill } from "../src/skills.ts";

test("the studio's skills load, and each format gets its own", async () => {
  const warnings: string[] = [];
  const short = await loadSkills("social_short", undefined, (m) => warnings.push(m));
  const podcast = await loadSkills("podcast_clip", undefined, (m) => warnings.push(m));
  assert.deepEqual(warnings, []);
  const names = (skills: { name: string }[]) => skills.map((s) => s.name);
  assert.ok(names(short).includes("editing-fundamentals"));
  assert.ok(names(short).includes("social-short"));
  assert.ok(!names(short).includes("podcast-clip"));
  assert.ok(names(podcast).includes("podcast-clip"));
  assert.ok(!names(podcast).includes("ad"));
});

test("parseSkill reads front matter and the formats list", () => {
  const skill = parseSkill("---\ndescription: Hooks\nformats: [Social Short, ad]\n---\nOpen strong.\n", "hooks");
  assert.equal(skill.name, "hooks");
  assert.deepEqual(skill.formats, ["social_short", "ad"]);
  assert.equal(skill.body, "Open strong.");
  assert.equal(parseSkill("---\nname: x\ndescription: d\n---\nBody", "f").formats, "all");
  assert.throws(() => parseSkill("No front matter", "f"), /front matter/);
  assert.throws(() => parseSkill("---\nname: x\n---\nBody", "f"), /description/);
});

test("broken and disabled skills are skipped, not fatal", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "magik-skills-"));
  const add = async (name: string, text: string) => {
    await mkdir(path.join(dir, name));
    await writeFile(path.join(dir, name, "SKILL.md"), text);
  };
  await add("a-good", "---\ndescription: ok\n---\nDo this.");
  await add("b-broken", "Do that.");
  await add("c-off", "---\ndescription: off\nenabled: false\n---\nNot now.");
  await mkdir(path.join(dir, "d-empty"));
  const warnings: string[] = [];
  const skills = await loadSkills("ad", dir, (m) => warnings.push(m));
  assert.deepEqual(skills.map((s) => s.name), ["a-good"]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /b-broken/);
  assert.deepEqual(await loadSkills("ad", path.join(dir, "missing")), []);
  // A skill with `when` words loads only when the request names one.
  await add("e-opt-in", "---\ndescription: a creator's style\nwhen: omgadrian, adrian style\n---\nEdit like him.");
  assert.deepEqual((await loadSkills("ad", dir, () => {})).map((s) => s.name), ["a-good"]);
  assert.deepEqual((await loadSkills("ad", dir, () => {}, "dynamic", "Cut it like @omgadrian")).map((s) => s.name), ["a-good", "e-opt-in"]);
  await rm(dir, { recursive: true, force: true });
});

test("a skill says which agents read it; the editor by default", async () => {
  assert.deepEqual(parseSkill("---\ndescription: d\n---\nBody", "f").agents, ["editor"]);
  assert.deepEqual(parseSkill("---\ndescription: d\nagents: Editor, sound\n---\nBody", "f").agents, ["editor", "sound"]);
  const sound = await loadSkills("social_short", undefined, () => {}, "dynamic", "", "sound");
  const editor = await loadSkills("social_short", undefined, () => {}, "dynamic", "");
  assert.ok(sound.some((s) => s.name === "sound-design") && sound.some((s) => s.name === "graphics-and-sound"));
  assert.ok(!sound.some((s) => s.name === "picking-takes"));
  assert.ok(!editor.some((s) => s.name === "sound-design") && editor.some((s) => s.name === "graphics-and-sound"));
});
