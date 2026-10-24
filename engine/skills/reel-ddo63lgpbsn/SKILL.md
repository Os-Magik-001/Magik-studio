---
name: reel-ddo63lgpbsn
description: Wordless motion-design brand sting (~15s): a 3D phone hook with a fly-through into the profile, then kinetic lyric typography swapping every ~0.5 s on glowing colour fields, text behind bars, and a static glowing wordmark end card, all carried by one rap track. Two hard cuts; everything else moves inside the animation.
formats: social_short, ad
style: dynamic
when: ddo63lgpbsn
agents: editor, sound
---

# Kinetic Type Brand Sting (motion-design showreel)

## When to use
Use this when the brief is a short, wordless brand piece: a creative school, agency, studio or app showing off its taste. Inputs are usually a profile or app screenshot or screen recording, a logo, a few rendered clips, and a track. Nobody talks to camera: the music is the script, and the on-screen words are lyrics or punchy fragments timed to the vocal. If the footage has a person speaking, use a talking-head skill instead.

## What the reference does (measured frame by frame, Oct 2026)
- **15.5 s.** Target 14–17 s, never over 20 s.
- **Only 2 hard cuts** (at 4.33 and 6.47). Five sections of 4.3 / 2.1 / 2.8 / 4.1 / 2.1 s (median 2.8 s); every other change is a move inside the animation (a squeeze, a fade-tilt to black, words flying off the edges), so the piece feels like one camera travelling.
- **The words follow the rap vocal, not a beat grid:** one new word group about every 0.5 s in the lyric run (11 changes in 5.5 s). The vocal covers about 20% of the runtime. Tempo about 103–111 BPM, and none of the section changes land on a detected beat: they land on lyric lines.
- **Palette:** near-black frames with one saturated light per section (electric blue, light grey, red, yellow with cyan, white). Every section is vignetted and the hero text is centred (84% of text frames in the middle band), about 2 words on screen.

## Structure recipe (15.5 s)
1. **0–4.3 s, product hook: one continuous 3D move, no cut.** A small phone on dark blue spins one full turn (back glowing at 0.25 s, front at 0.75 s), then the camera flies into the screen (1.0–3.0 s) while posts float out in depth; the profile fills the frame at 2.0 s, and the logo icon rises out of the screen on a glowing ring (3.5–4.3 s). No readable text before 2 s. Engine: `phone_3d` with the profile screen recording on its `screen`, about 4 s. Without a screen recording, a segment of the screenshot with a push from zoom 1.0 to 1.6 on the avatar (closer looks soft), ending on the logo.
2. **4.3–6.5 s, ad-lib.** **Hard cut** at 4.33, matched on colour (blue glow to dark-blue space). A tiny object or one glowing word (`hero`, `pop`) drifts away from the camera.
3. **6.5–9.3 s, lyric run.** **Hard cut** at 6.47 from dark to a light-grey field, on the first lyric. Dark heavy sans words fly in letter by letter on arcs, one word group every 0.5 s (`on_screen_text` items of 0.4–0.6 s, `slide_up` or `pop`, each starting on its sung syllable). Mix treatments inside one phrase: one word white on a black box (`boxed`), one accent word in purple. At about 8.3 s the field squeezes into an ellipse and opens back out (a move, not a cut).
4. **9.3–13.3 s, colour punches.** A 0.1–0.15 s fade-tilt to black where the next word (red, glowing) rises in 0.1 s before the change (a graphic J-cut). Then, about 1 s each: red glowing word on black; stacked yellow line over cyan line (`stacked`, `hit` on the first word); words flying out left with red letters; the red payoff line set **behind black vertical bars** (`behind_subject` when the footage has a foreground object).
5. **13.4–15.5 s, logo.** The white glowing wordmark centred on black, **static** for 1.9–2.1 s to the last frame (`logo_reveal` or `title_3d` held still; a `hold` if it's a still). A `ding` or soft `hit` on its first frame. Do not end on black.

## Pacing and cutting rules
- Time every text swap to the **vocal syllables** (when the track has a vocal) or to the strongest transients; do not force changes onto a metronome grid. Section changes go on lyric lines.
- Sections run 2–4.5 s; the hook is the longest. Inside the lyric run, text changes every 0.4–0.6 s.
- Never leave the frame static for more than 1.5 s except the final logo: keep a move or a text swap going.
- 2–3 hard cuts per 15 s, each on a colour change (blue to blue-black, dark to light). Use speed 1x on renders.
- At most 3 transition types: hard cut on a colour change, a short fade to black (0.1–0.15 s, `dip_to_black`), and one accent (`glitch` 0.2 s into the logo, optional).

## Framing
- Hero elements dead centre, inside the middle 60% of the frame; edges dark (vignette).
- On screenshots or devices, the move ends on the brand mark (avatar or logo).
- Text big: 2–4 words fill 70–85% of the frame width.

## Text and captions
- No auto captions: there is no dialogue, and sung lyrics transcribe badly. Place text items by hand on the vocal.
- Heavy sans (`hero`, `stacked`); `serif` only for the dark payoff line if you want contrast.
- One colour per section, with a glow feel: blue on blue, dark grey on light grey, red on black, yellow plus cyan on black, white logo on black.
- Animations: `pop` on hits, `slide_up` in the lyric run, `fade` for the logo, `typewriter` only for a URL or handle.
- Keep explicit lyrics on screen only if the client supplied them; otherwise write clean 1–3 word brand lines that scan with the rhythm.

## Motion templates
- `phone_3d` (or a push on the screenshot) for the hook; `kinetic_type` for a stacked line; `logo_reveal` or `title_3d` for the end card.
- `stat_card` optional in the colour punches if the brand has a number.
- No `character_intro`, `cast_lineup`, `lower_third_3d`, `follow_pill`, `comment_cta`, `progress_bar` or emoji: the logo card is the only CTA.

## Look
Overall `cinematic`, or `punchy` if the footage is flat. Per shot, brightness -0.1 to -0.2 on dark sections and contrast +0.15 to +0.3; raise saturation only on the coloured text sections. Never `vintage` or `black_and_white`.

## Sound
- The track runs from frame 1 to the end at full level (nothing to duck under).
- 3–5 effects, tight on the vocal hits: a `whoosh` on the fly-through, a `hit` on the colour punch and on the logo, an optional `riser` over the last second before the logo.
- End the music with the logo; if the track runs on, fade it under the last 0.3 s of the logo hold.

## Avoid
- Fast hard-cut montages: more than about 0.2 hard cuts per second breaks the one-camera feel.
- Bright full-frame backgrounds except the one grey lyric section.
- Captions along the bottom, subtitle bars, `karaoke_box`; more than 4 words on screen at once.
- Starting with the logo; going past 20 s; ending on black.

**Music and sound** (from the reference reels)
- If the client supplies a track or the footage has its own audio, keep it at full volume for the whole piece and time all text to its vocal. Otherwise pick a dark, medium-energy hip-hop bed around 90–110 BPM: beat-thee (91 BPM) first; spec-ops (120 BPM) for a harder, tense feel; kings-trailer (80 BPM) for an epic logo payoff. Volume `high`. Start the track so a strong hit lands within the first 0.5 s, and let the music carry to the logo's last frame.
- Library moods: hip-hop, dark, moody, trap, dramatic-suspense, cinematic, bass-heavy, urban, neon, confident.
