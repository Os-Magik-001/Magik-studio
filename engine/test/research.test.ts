import assert from "node:assert/strict";
import { test } from "node:test";
import { pickReels, trendingAudio } from "../src/research.ts";

const reel = (owner: string, plays: number | undefined, extra: Record<string, unknown> = {}) => ({
  url: `https://www.instagram.com/p/${owner}${plays}/`,
  shortCode: `${owner}${plays}${extra.dup ?? ""}`,
  videoUrl: "https://cdn/x.mp4",
  ownerUsername: owner,
  videoPlayCount: plays,
  likesCount: 100,
  commentsCount: 5,
  videoDuration: 20,
  ...extra,
});

test("the researcher watches the biggest reels, a few per account, no duplicates", () => {
  const picks = pickReels([
    reel("a", 900_000), reel("a", 800_000), reel("a", 700_000), reel("a", 600_000),
    reel("b", 50_000), reel("b", 50_000, { dup: "" }),
    reel("c", 400_000, { videoDuration: 300 }),
    reel("d", undefined, { likesCount: 20_000 }),
    reel("e", 1_000, { videoUrl: undefined }),
  ]);
  assert.deepEqual(picks.map((p) => `${p.ownerUsername}:${p.videoPlayCount ?? "likes"}`), ["a:900000", "a:800000", "d:likes", "a:700000", "b:50000"]);
});

test("trending sounds are counted across the search; a lone original voice-over isn't a trend", () => {
  const song = { song_name: "Espresso", artist_name: "Sabrina Carpenter", uses_original_audio: false, audio_id: "111" };
  const meme = { song_name: "Original audio", artist_name: "memer", uses_original_audio: true, audio_id: "222" };
  const voice = { song_name: "Original audio", artist_name: "solo", uses_original_audio: true, audio_id: "333" };
  const audio = trendingAudio([
    reel("a", 900_000, { musicInfo: song }),
    reel("b", 100_000, { musicInfo: song }),
    reel("c", 50_000, { musicInfo: meme }),
    reel("d", 40_000, { musicInfo: meme }),
    reel("e", 2_000_000, { musicInfo: voice }),
    reel("f", 10, {}),
  ]);
  assert.deepEqual(
    audio.map((a) => [a.title, a.artist, a.original, a.reels, a.creators, a.plays, a.link]),
    [
      ["Espresso", "Sabrina Carpenter", false, 2, 2, 1_000_000, "https://www.instagram.com/reels/audio/111/"],
      ["Original audio", "memer", true, 2, 2, 90_000, "https://www.instagram.com/reels/audio/222/"],
    ],
  );
  assert.equal(audio[0].example, "https://www.instagram.com/p/a900000/");
});
