import assert from "node:assert/strict";
import { test } from "node:test";
import { LIBRARIES, loadCatalog } from "../src/music.ts";
import { loadSfxCatalog } from "../src/sfx.ts";

test("the music libraries are well formed and licensed for client videos", async () => {
  const tracks = await loadCatalog();
  assert.equal(new Set(tracks.map((t) => t.id)).size, tracks.length, "ids are unique");
  for (const t of tracks) {
    assert.match(t.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `kebab id: ${t.id}`);
    for (const k of ["title", "artist", "url", "page", "license"] as const) assert.ok(t[k]?.trim(), `${t.id}.${k}`);
    assert.ok(t.duration > 3, `${t.id} duration ${t.duration}`);
    assert.ok(/^(https:\/\/|drive:)/.test(t.url), `${t.id} url`);
    // Non-commercial terms would rule a track out for client work.
    assert.doesNotMatch(t.license, /\bNC\b|non-?commercial/i, `${t.id} license`);
    if (t.library === "freepd") assert.ok(t.license === "CC0 1.0" && !t.credit, `${t.id}: FreePD is CC0`);
    if (t.library === "incompetech") assert.ok(t.license === "CC BY 4.0" && t.credit?.includes(`"${t.title}" Kevin MacLeod`), `${t.id}: credit line`);
    if (t.library === "mixkit") assert.ok(/^Mixkit Stock Music Free License/.test(t.license) && !t.credit, `${t.id}: Mixkit licence`);
  }
  const count = (lib: string) => tracks.filter((t) => t.library === lib).length;
  for (const lib of LIBRARIES) assert.ok(count(lib) > 0, `${lib} has tracks`);
  assert.ok(count("freepd") >= 250 && count("incompetech") >= 1000, `${count("freepd")} FreePD, ${count("incompetech")} Incompetech`);
});

test("the sound-effect libraries are well formed", async () => {
  const effects = await loadSfxCatalog();
  assert.equal(new Set(effects.map((e) => e.id)).size, effects.length, "ids are unique");
  for (const e of effects) {
    assert.match(e.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `kebab id: ${e.id}`);
    assert.ok(e.library === "studio" ? e.url === "" && e.kind === e.id : /^https:\/\//.test(e.url), `${e.id} url`);
    assert.ok(e.duration > 0 && e.duration <= 60, `${e.id} duration ${e.duration}`);
    assert.ok(e.kind === null || ["whoosh", "pop", "hit", "riser", "click", "ding"].includes(e.kind), `${e.id} kind`);
  }
  assert.ok(effects.filter((e) => e.library === "mixkit").length >= 300, "Mixkit effects");
});
