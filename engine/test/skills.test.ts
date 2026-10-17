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
  await rm(dir, { recursive: true, force: true });
});
