import assert from "node:assert/strict";
import { test } from "node:test";
import { nameOf } from "../src/libraries.ts";

test("a Pixabay download's name gives its artist and title; other files keep theirs", () => {
  assert.deepEqual(nameOf("alexguz-funk-groove-196617.mp3"), { title: "Funk Groove", artist: "alexguz", pixabay: "196617" });
  assert.deepEqual(nameOf("music_unlimited-epic-cinematic-trailer-12345.mp3"), { title: "Epic Cinematic Trailer", artist: "music unlimited", pixabay: "12345" });
  assert.deepEqual(nameOf("Intro theme_final.wav"), { title: "Intro theme final", artist: null, pixabay: null });
});
