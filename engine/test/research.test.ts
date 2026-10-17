import assert from "node:assert/strict";
import { test } from "node:test";
import { pickReels } from "../src/research.ts";

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
