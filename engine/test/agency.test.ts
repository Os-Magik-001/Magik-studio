import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fairOrder } from "../src/agency.ts";
import { loadSkills } from "../src/skills.ts";
import { loadCatalog } from "../src/music.ts";
import { loadSfxCatalog } from "../src/sfx.ts";

const job = (id: string, agency_id: string, minute: number) => ({ id, agency_id, created_at: `2026-11-16T10:${String(minute).padStart(2, "0")}:00Z` });

test("one agency alone: oldest first", () => {
  const order = fairOrder([job("b", "A", 2), job("a", "A", 1), job("c", "A", 3)], new Map(), new Map());
  assert.deepEqual(order.map((j) => j.id), ["a", "b", "c"]);
});

test("a backlog from one agency doesn't make another wait", () => {
  const queued = [job("a1", "A", 1), job("a2", "A", 2), job("a3", "A", 3), job("a4", "A", 4), job("b1", "B", 5)];
  // A was served a moment ago; B never.
  const order = fairOrder(queued, new Map(), new Map([["A", "2026-11-16T10:04:30Z"]]));
  assert.equal(order[0].id, "b1");
  assert.deepEqual(order.map((j) => j.id), ["b1", "a1", "a2", "a3", "a4"]);
});

test("the agency with less running goes first, and turns alternate", () => {
  const queued = [job("a1", "A", 1), job("a2", "A", 2), job("b1", "B", 3), job("b2", "B", 4)];
  const order = fairOrder(queued, new Map([["A", 1]]), new Map());
  assert.deepEqual(order.map((j) => j.id), ["b1", "a1", "b2", "a2"]);
});

test("an agency at its limit waits", () => {
  const queued = [job("a1", "A", 1), job("b1", "B", 2)];
  const order = fairOrder(queued, new Map([["A", 2]]), new Map(), new Map([["A", 2], ["B", 1]]));
  assert.deepEqual(order.map((j) => j.id), ["b1"]);
});

test("a skill kept for one agency loads only for it", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "skills-"));
  for (const [name, extra] of [["shared", ""], ["mine", "agency: magik\n"], ["theirs", "agency: other-studio\n"]]) {
    await mkdir(path.join(dir, name));
    await writeFile(path.join(dir, name, "SKILL.md"), `---\nname: ${name}\ndescription: test\n${extra}---\nDo the thing.\n`);
  }
  // Outside a job the engine works as the first agency.
  const names = (await loadSkills("social_short", dir)).map((s) => s.name);
  assert.deepEqual(names, ["mine", "shared"]);
});

test("the built-in sound sets an agency may use", async () => {
  const all = await loadCatalog();
  const open = await loadCatalog([], ["freepd", "incompetech"]);
  assert.ok(open.length > 0 && open.length < all.length);
  assert.ok(open.every((t) => t.library === "freepd" || t.library === "incompetech"));
  const sfx = await loadSfxCatalog([], ["freepd"]);
  assert.ok(sfx.length > 0 && sfx.every((e) => e.library === "studio"), "only the engine's own synthesized effects");
});
