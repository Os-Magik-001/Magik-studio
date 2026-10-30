---
name: sound-design
description: How the sound designer scores a locked cut: choosing music from the libraries, lining it up with the edit, ducking, sound effects, trending audio and licences
formats: all
agents: sound
---

# Sound design for short-form video

**Work in this order**
1. Read the cut: where the hook, the turn, the reveal or punchline and the call to action fall, where people talk, where it is wordless, where transitions and graphics come.
2. Decide one sound idea for the whole video, in a line ("a warm funk bed that drops on the reveal and stops for the punchline"). Everything serves it.
3. Search wide, shortlist two or three tracks, look closer at them with track_details, choose one. One track per video.

**What the studio's references do** (about 520 reels, Oct 2026)
- **Dialogue comedy (Cluely):** original audio only; no music under any dialogue and no sound effects in the most played episodes. Music only when it is in the scene (a TikTok playing, a party).
- **Series (The Boyz):** music under the title only in half the episodes; in the others a low bed enters on a silent comic beat, a montage or a workout and carries the closing confessional (about 7-8 dB under the voice between words). A mock-epic bed under a heist scene was too loud.
- **Meme skits (The Marketing Interns):** a song or trending sound replaces the location sound in 21 of the 25 most played, at full level from frame 0. It is the soundtrack, not a bed. The first action often lands on the track's first hit (0.6-0.9 s in).
- **Creator talking heads:** voice only in about half; otherwise a bed heard 4-7 dB under the voice between words. Every graphic gets a soft effect.
- **Cuts on the beat:** in talking reels, no more often than chance in every account. Only montages, reveal specials and ads cut on beats (every one or two bars).

**Choosing the track**
- Feeling first, then tempo. Calm talking (150-170 words a minute): 70-95 BPM. Normal creator delivery: 95-115. Fast delivery or montage: 115-135. Hype or sport: 135 and up, or a half-time feel.
- The brand's music mood and the client's earlier videos come first. A series keeps its theme, so every episode sounds like the show.
- Under speech, prefer instrumental beds without a busy lead melody.
- The track must carry the video: from where it starts to its end, at least as long as the part it plays under, or lined up so it ends with the video.
- Credit-free libraries first: the studio's picks, FreePD and the studio's Drive libraries, then Mixkit. Use Incompetech (CC BY) only when it is clearly the best fit; its credit line then goes in the post.
- Mixkit is being phased out: its terms forbid scripts that download its library, so its catalogue is frozen and will be replaced by a library the studio holds (the Sonniss GDC effects). Until then, a Mixkit effect is still better than a synthesized one; for music, prefer the other libraries.
- Mixkit music is licensed for the web and social media (posts, ads, YouTube), not TV, radio or CDs. For a TV spot use FreePD, Incompetech or the studio's own libraries.

**Lining it up with the cut** (`align`)
- `hit`: put a drop or section change from track_details on the moment that matters: the reveal, the first product shot, the button after a punchline, the end card. The engine snaps the track moment to its bar.
- `end`: back-time the track so its last hit lands on the last frame. This is the strongest ending for brand pieces and end cards.
- `start`: begin on the first downbeat or a strong section when nothing needs to hit. In a meme, start so a hit lands on the first action (0.6-0.9 s).
- A riser 1.5-2 s before a drop sells it. Never two drops within 15 s.
- The strongest shape for an ad with a reveal: the beat drops on the first big moment after the hook, the track's own stop or break sits under the last line before the reveal, and its drop lands on the reveal.

**Levels and ducking**
- The music must be heard. Under talk it sits about 10 dB under the voices: volume `medium` with duck `light` (the studio's approved mix: 9-11 LU under the voices while they talk, unchanged in the gaps and full on the reveal). Talk mixed with wordless moments: `high` with duck `normal`. Wordless montage, memes and reveals: `high` with duck `light`.
- Volume `low` with duck `normal` or `deep` puts the bed about 20 dB under the voices, where clients hear "no music". Keep it for a soft or quiet voice over a busy track.
- Music can sit out (leave a gap between sections) under a key line or before a punchline: the silence makes it land. Bring it back on the next beat.
- Comedy: under every punchline and its laugh, leave a gap between sections, and bring the music back on the next line or cut.
- Dialogue skits and series: no bed under scene dialogue. A `low` bed may enter on a silent comic beat, a montage or a workout and carry through the closing confessional; a series title gets its own section.
- Clean edits, and skits whose brief asks for dialogue alone: music only under the cold open or the series intro, as a section that ends when the first line starts.

**Check the balance by measuring** (the studio's ears are the client's): render the ducked bed alone and compare it with the voice while she talks. Target 8-11 dB under the voice; the first Sara mixes measured 20 dB under, which reads as "no music". In the gaps the bed comes back up 4-7 dB. A soft, calm track needs a lower bed than a busy one to sit at the same distance.

**Sound effects**
- The owner rejected the stock « UI » palette (bubble pops, bell dings, buzzers, cartoon springs, record scratches, fairy sparkles) as cheap: it is what makes an edit sound template- or machine-made. Effects are one designed family, soft and physical, built to the length of each move:
  - **air**: a swish of air whose brightness follows the move's speed (dark as it starts, brightest at peak velocity, dark as it lands), panned with the move; for titles and cards sliding in, camera pushes, whip-zooms (0.35-0.8 s);
  - **thump**: a felt-mallet landing, a low tone dropping in pitch with a warm body at 200-500 Hz so phone speakers hear it; for a 3D title or number settling, a step lighting up (higher and shorter for small things);
  - **tick**: a quiet wooden knock (a pencil on a desk), never a beep; for a word locking into a list, a tracker tile landing;
  - **brush**: a dry brush or marker stroke on paper, as long as the stroke draws; for drawn underlines, circles, strike-throughs;
  - **turn**: a deeper, longer air pass with a soft thump where it settles; for a camera travelling between objects in a 3D world, or a dive;
  - **swell**: a breath that opens into the moment, cut at its peak; before the end card or a reveal.
  - The engine's built-in kinds are this family: `whoosh` is the air swish, `hit` the felt thump, `click` the wooden tick, `riser` the breath swell, `pop` a soft wooden tap, `ding` a warm low chime (sparingly). A 3D turn is a `whoosh` with a `hit` where it settles; a brush stroke is a paper or brush effect from the libraries when one fits, otherwise a soft `whoosh`. Recorded library effects can join the family when they are just as soft (air, cloth, paper, wood), never cartoon ones (bubble pops, bells, buzzers, springs, scratches, sparkles).
- Not every graphic gets a sound: titles, 3D numbers, transitions, drawn marks and list items do; captions, labels that track a part, small badges do not. About 10 effects in a 40–60 s reel (the owner, Oct 28), each tied to an object's move; never one per graphic.
- Never on a punchline or its laugh, never on every caption, never on a plain cut. Dialogue comedy: none, or 0-3 per episode. Memes: none unless the borrowed clip has its own. Clean edits: none.
- Levels, measured: effects peak at -8 to -16 dBFS with the voice at -16 LUFS (at -15 to -19 the owner could not hear them, Oct 27), 4–5 dB lower under speech, and the effects bus ducks 8 dB under any voice (12 ms attack). Transitions are the loudest, ticks the quietest. No impact lands on a spoken word: under speech, move the cue to the nearest breath (motion-sfx-sync).
- Land each effect on its frame: an air swish starts with the move, a thump on the landing frame, a brush on the first frame of the stroke, a swell ends on the moment.

**Trending audio** (from the researcher)
- The researcher lists the sounds the top reels in the niche use, how many reels use each, and their tempo when measured.
- A licensed song can't go in the exported file. Recommend the trend that fits best, to add in the Instagram app when posting: which part (the chorus, the drop), and whether to keep the bed under it at low level or remove it. Business accounts often can't use popular songs; then the library bed carries the video alone, so it must work without the trend.
- Meme skits are cut to their sound's moments (a voice line, a drop, a gap): when a meme is built for a trending sound, say in the notes which moment of the sound each cut needs, so it can be re-timed in the app.
- Choose the library track to match the trend's tempo (within about 5 BPM, or half or double) and feel, so the cut works with either.
- An original audio a creator made (a voice line or meme sound) can trend too. Recommend it only when the video's format fits it.
- Trends fade in weeks: prefer sounds that several of the top reels use.

**Revisions**
- Change what the comments ask and keep the rest. "Music too loud", or "we can't hear them talk": one step down (`high` to `medium`, or duck `light` to `normal`) and keep the gaps for punchlines. "There is no music" or "I can't hear the music": one step up (`low` to `medium`, or duck `deep` or `normal` to `light`). "Change the music": a different track that does the same job. "No music here": end the section before that moment.
