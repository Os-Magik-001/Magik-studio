---
name: graphics-and-sound
description: Using automatic captions, animated text, graphics, overlays, music and sound effects
formats: all
style: dynamic
agents: editor, sound
---

**Captions**
- Whenever there's speech, use `captions.mode: auto`. The engine times every kept word itself, so don't write caption items. Choose the look:
  - **`bold_pop`:** energetic creator reels. Settings: 2–3 words, `lower`, `center`, medium.
  - **`editorial`:** premium brands, testimonials. Keywords turn into italic serif.
  - **`karaoke_box`:** calm explainers and podcasts. Spoken words light up.
  - **`classic`:** ads that need maximum legibility.
  - **`minimal`:** cinematic pieces with little speech.
- `highlight_words`: the product name, numbers, the promise and the payoff. Keep it to 5–12 words, so the highlight still means something.
- Highlight color: the brand's accent color if it reads on video; otherwise a warm yellow (#FFD84D). Keep caption text white.
- Use `manual` only for footage with no speech that still needs on-screen lines, and `off` for pure montage.

**Text you place**
- **Hero words** (`hero`, 1–3 words): the big idea of each 2–4s, shown as it's said, `pop` in, held 1.5–2.5s. Use one at a time.
- **`behind_subject`:** put a hero word or title behind the person when a person clearly fills the frame and their head sits in the upper half. This is the premium look; use it for 2–4 key moments, not every title.
  - The head should overlap the bottom 25–30% of the letters, never hide the middle.
  - Use `top` when the head is at about 25–40% of the frame height, `center` when it's lower.
- **`accent`:** one word in italic serif and the highlight color, like "did." in "Claude did.". Use it on hooks and payoffs.
- **`stacked`:** 2–3 line headlines for the hook or payoff, built line by line.
- **`boxed`:** a pinned call to action or chapter header.
- **`label`:** small asides ("no, seriously").
- **Animations:** `pop` for energy, `slide_up` for headlines, `fade` for calm or premium, `typewriter` for typed claims or prompts. Stay consistent: one or two kinds per video.

**Graphics** (they show what you say)
- **`comment_cta`:** when the call to action says "comment KEYWORD". Put it at y 0.6–0.7 and hold it to the end.
- **`follow_pill`:** on "follow me", or in the last 2s of organic reels.
- **`progress_bar`:** on reels over 30s that people should finish (tutorials, lists). Span the whole video.
- **`counter`:** on a number that proves something: views, raw length against final length ("1:16|0:55"), a price drop. Hold it 1.5–3s.
- **`emoji`:** at most 2 per video, on an emotional beat, placed beside the face, never on it.
- **`circle`:** to point at something in the frame as it's named.
- Don't stack more than two graphics at once, and don't cover the face.

**Overlays**
- **`cutaway`:** shows B-roll while the voice continues, so the speaker talks over what they describe.
  - This is the best way to hide a jump cut inside a sentence, and to show what you say.
  - Keep each 1–3s. Keep the speaker on screen at least 60% of the time.
- **`card`** (a floating clip or still, a few degrees of `tilt`): use it for proof, examples, screenshots, "before" shots.
  - Place it in the empty part of the frame, usually above or beside the head. Width 0.45–0.65.
  - 1.5–3s each; use `still: true` for a screenshot.

**Music** (when the library has a fitting track)
- Match the brand's music mood. Otherwise:
  - upbeat or hip-hop for energetic social
  - chill or lo-fi for lifestyle and talking heads
  - inspiring or corporate for brand pieces
  - cinematic for montage and premium ads
- `volume`: `low` under continuous speech, `medium` for mixed, `high` for montage with little speech. It dips under speech by itself.
- `start` on a strong section of the track: use its first beat.
- For montage, place cuts on beats: beat times are `start + firstBeat + n × 60 / bpm`, measured in the track and shifted to the video timeline.
- No music on podcast clips unless asked, or when the voice is hard to hear.

**Sound effects** (subtle: 3–8 per 30s)
- `whoosh` on slides, zoom transitions and big reframes.
- `pop` when a hero word or graphic appears (not on every caption).
- `hit` on the punchline or the biggest reveal, once or twice.
- `riser` into a drop or reveal.
- `click` on typed text and UI.
- `ding` on a positive result.
- Never put an effect on every cut.
