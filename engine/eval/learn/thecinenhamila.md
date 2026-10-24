# @thecinenhamila: what the account holds

**The account has no reels.** On 2026-10-23 the profile scrape reports 3 posts in all (402 followers, 9 story highlights), and all three are carousels; the reel scraper returns no items for the account ("empty or private data"). The scrape did not fall short: there is nothing else public to list. Story highlights would need a logged-in scraper, which the studio's Apify setup doesn't have.

Two of the carousels contain one video each, and both were downloaded and measured:
- **DPeO89UABRg (video 2 of the carousel "Hate me or love me, thank you for watching", 469 views):** 4.6 s, 3:4 (720x960), silent, one handheld take: a tilt and pan in a restaurant that lands on him. No cut, no text.
- **DQPgQXuDyww (video 2 of "Cash cow", 291 views):** 7.1 s, 3:4, silent, one handheld take: a move through an atrium ending on a reveal of the floor below. No cut, no text.

## Measured numbers

**All reels** (2 reels, 0.2 min, plays median 380 (middle half 336-424, n=2))

- Length: median 5.9 s (middle half 5.2-6.5 s, n=2).
- Cuts per 10 s: median 0.00 (middle half 0.00-0.00, n=2). Shot length, all shots pooled: median 5.87 s (middle half 5.25-6.48 s, n=2); per-reel median shot: median 5.87 s (middle half 5.25-6.48 s, n=2).
- Shot lengths: under 0.5 s 0%, 0.5-1 s 0%, 1-2 s 0%, 2-4 s 0%, 4-8 s 100%, 8 s and more 0%.
- What the cuts are: new shot n/a, jump cut in the same framing n/a, punch-in n/a, punch-out n/a. Punch-in size n/a; punch-out n/a.
- Transitions: hard cut n/a, blur/whip n/a, flash n/a; dissolves per reel 0.
- Cuts made while something moves (frame change just before or after the cut well above the reel's typical motion): 0%.
- Moves inside shots: slow push-in on 0% of shots long enough to measure (n/a), pull-out on 0%.
- Freeze frames: in 0% of reels; length n/a.
- Speech: share of runtime median 0.00 (middle half 0.00-0.00, n=2); words per minute of runtime n/a, while speaking n/a; first speech at n/a.
- Text on screen: frames with any text median 0.00 (middle half 0.00-0.00, n=2); spoken words shown as captions n/a; title-size text median 0.00 (middle half 0.00-0.00, n=2); words per caption n/a; text changes per 10 s median 0.0 (middle half 0.0-0.0, n=2); text on the very first frame in 0% of reels. Position of text (share of text boxes): top n/a, middle n/a, bottom n/a.
- Hook: first cut at n/a; cuts in the first 3 s median 0.0 (middle half 0.0-0.0, n=2); first speech at n/a; motion in the first 3 s against the rest median 0.80x (middle half 0.75-0.85x, n=2).
- Music: licensed song (Instagram's metadata) on n/a of reels; seconds with music heard between the words n/a; under talk n/a; bed level against the voice n/a.
- Loudness as served: n/a, range n/a, true peak n/a (Instagram normalises, so this mostly reflects the platform).

| rank | reel | plays | s | cuts/10 s | median shot | kinds | speech | cut states (sil/J/L/mid) | text | music |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | DPeO89UABRg_v2 | 469 | 4.6 | 0.0 | 4.633 |  | 0 | 0/0/0/0 | 0.0 | - |
| 2 | DQPgQXuDyww_v2 | 291 | 7.1 | 0.0 | 7.1 |  | 0 | 0/0/0/0 | 0.0 | - |

Measured automatically on every reel (see corpus.json for each reel). Cut states: *silence* = no speech at the cut; *J* = the phrase started before the picture cut; *L* = the phrase ends after it; *inside continuous speech* = no pause at the cut. These are acoustic facts; whether a J/L is a real split edit between two speakers is judged by eye in the techniques below. The detector's limits are listed under Measurement notes.


## What this means for the engine
- There is no cutting style to learn from this account. The two clips work as 2-4 s luxury B-roll or establishing shots in his personal-brand reels (the approved Cinen Hamila and Prospera edits follow the @_k.elsie and @omgadrian references instead; see the singles report).
- If the studio wants his own style measured, it needs his raw footage or future reels.
