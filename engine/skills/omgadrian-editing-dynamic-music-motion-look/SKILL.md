---
name: omgadrian-editing-dynamic-music-motion-look
description: Music-first editing, energy-matched framing, sparse sound effects, purposeful speed and transitions, and correct-then-look colour for dynamic reels (learned from @omgadrian)
formats: all
style: dynamic
---

# Music, motion and look (dynamic)

This covers sound and picture treatment for dynamic reels. The clean style keeps its natural look, original audio and hard cuts; none of this applies there.

1. **Pick the music first.** Choose the library bed before ordering shots, by the one feeling the reel should give. Set its start point and sections so the hook line, the turn and the payoff each fall on a section change. There is no beat detection, so line up by section, not by beat. Keep the natural speech gaps rather than squeezing lines to fit the music.
2. **Match the bed's tempo to the voice.** Calm talking (150-170 wpm) gets a slow bed; fast delivery (200+ wpm) gets a driving one. A bed that fights the voice is worse than no bed.
3. **Frame size follows the music's energy.** In the big sections, use punch-ins (1.3-1.6) and shorter shots. When the song gets quiet, go back to zoom 1.0 with longer holds. Punch back in where it builds again.
4. **Wordless montages.**
   - With no speech, the music plays at full level.
   - Order shots by time of day (day → sunset → night) or along a journey. End on a close detail or a wide closer.
   - Cinematic montage: 2.7-3.5 s shots.
   - Observational montage: about 5 s shots, letting people and cars move through a static frame.
   - The first spoken line after a montage brings in the automatic music dip.
5. **Sound effects: less is more.** Put a `hit` or `riser` only at the story's peaks, a `whoosh` on a scene-change transition, and a `pop` when a card or keyword enters. Use no more than 3-4 per 30 s, and never one on every text pop. For The Boyz, office-comedy-reels' limit is stricter: a `whoosh` into `character_intro` and a `hit` on the freeze, nothing else.
6. **Transitions carry location changes, not lines.** Between two places, use `slide_left` or `zoom_in` with a `whoosh`, the closest equivalent to a whip pan. Use `glitch` into lo-fi or VHS-style inserts. Everything else is a `cut`. Use one kind of transition per reel. In skits, office-comedy-reels keeps scene changes as cuts.
7. **Speed with a purpose.**
   - Process footage (printing, writing, assembling): 2-4x.
   - One slow-motion payoff: 0.25-0.5x on the final shot of a reveal.
   - A ramp is built from stepped segments: 0.5x then 2x for a build, 2x then 0.5x for an arrival. Once per reel.
   - Skits stay at 1x.
8. **Correct, then apply one look.**
   - First match every shot with per-shot brightness, contrast and saturation. Flat log footage gets contrast and saturation up; mixed cameras are brought to the same exposure.
   - Then apply one overall look to the whole reel, usually `cinematic` or `warm`.
   - On faces, keep saturation within about +0.1 so skin doesn't turn orange.
   - A slightly darker image (brightness -0.03 to -0.06) reads moodier than the phone default. Never darken a skit.
9. **Before and after the grade.** Duplicate the shot. The first copy has saturation and contrast lowered on `natural`, labelled 'BEFORE'. The second is the graded version, labelled 'AFTER'. Cut on 'to this', and hold each 2-5 s so the change reads.
10. **Black and white separates one segment.** Set that shot's saturation to 0 (not the overall look) on a single segment: the host's outro, the outtakes montage, or the 'bad moment' before the fix. Everything else stays in colour. One B&W segment per reel.

## Example
Cast intro with music:
- Bed funkeriffic, started on its downbeat. The section change at 6 s lands on the first `character_intro`.
- Shots 1-3 at zoom 1.0, about 3 s each, during the quiet intro. Punch-ins at 1.4 once the chorus hits.
- One `whoosh` into the intro and one `hit` on the freeze; nothing else.

## Example
Gear tutorial with iPhone and drone clips:
- Drone clip: contrast +0.1 and saturation +0.05 to match the phone. Look `cinematic` across all shots.
- The 'it looks murky' line plays first on a copy with saturation -0.3 and contrast -0.2. Cut to the graded copy on 'to this', with 'BEFORE' / 'AFTER' labels.
