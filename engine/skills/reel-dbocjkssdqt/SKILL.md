---
name: reel-dbocjkssdqt
description: Cinematic AI-tool demo reels: a creator voiceover at ~190 wpm over street and desk shots and screen recordings, scattered kinetic word captions (white, one red word per line), hard-cut before/after reveals on the same framing, in-camera whips into the claim and the CTA, a soft music bed, and a spoken comment-keyword CTA. 30–40s, original audio, no song.
formats: social_short, ad
style: dynamic
when: dbocjkssdqt
agents: editor, sound
---

# AI Tool Demo – Cinematic Voiceover Style

## When to use it
Use this when the footage is a creator showing off a software or AI workflow (an editing plugin, a generative tool, a "this replaced an hour of work" claim). The source mixes three kinds of material: shots of the creator outdoors and at a desk, screen recordings of the tool, and a before/after result. The voice is a tight, scripted voiceover, not a rambling talking head. If the footage is one locked-off talking head with no screen material, pick a different skill.

## What the reference does (measured frame by frame, Oct 2026)
- **Format:** the reference is 4:3 landscape (960x720). The recipe works in 9:16 too: keep the same shots and timing, and reframe each one with `focus`.
- **Length 36.3 s.** Aim for 30–40 s and never go past 45 s.
- **Cuts:** 10 editorial cuts, 11 shots of 1.4 / 2.8 / 2.3 / 3.7 / 3.3 / 3.9 / 5.1 / 1.8 / 4.0 / 2.2 / 5.8 s. Median shot **3.3 s**, about **0.28 cuts/s**. Four shots are under 2.8 s. This is a calm edit by short-form standards; the energy comes from the voice and the moving text.
- **Speech:** **192 words/min**, voice on 89% of the runtime. Pauses inside a shot: median 0.15 s, longest 0.41 s. The only long breaths (0.77–0.9 s) sit at cuts: the first reveal and the move into the screen recording.
- **Audio:** original audio. **There is a soft music bed** about 7 dB under the voice, heard between words in half the reel. No song.
- **Look:** the street half is bright and sunny (blue sky, orange walls, greens). The transformed versions and the last 8 s are dark teal with warm candle light.

## Hook (0–3 s)
Open on the **result**, not the explanation. The first line names the payoff ("You can now create captions like this without touching a single keyframe"), and the product's own styled captions are already on screen.
- Shot 1 is a 1.4 s sky shot (no creator) with the product's red captions appearing word by word from 0.25 s. It ends inside a camera whip-tilt down to the street; shot 2 continues the tilt and lands on the creator walking (cut inside the movement, see transitions).
- Words arc round his head by 2.5 s; one red word and one bold white word at chest height by 3.5 s.
- Do not open with a logo, a title card or the screen recording.

## Structure recipe (11 shots, about 36 s)
1. **Hook / result A** (0–1.4 s): sky with the product captions; whip into shot 2.
2. **Creator** (1.4–4.2 s): walking; he walks past the lens and the cut lands on that movement (cut on action) into a wide street.
3. **Before** (4.2–6.5 s): the location as filmed, 1.8–2.3 s.
4. **After** (6.5–10.2 s): the same framing, transformed (day to dusk), 3.7–4 s. **Hard cut** between before and after, inside a 0.86 s pause: 0.3 s after the last word of "change the time of the day", 0.6 s before the next.
5. **Name the tool** (10.2–13.6 s): screen recording, cut 0.2 s before "this is Claude". Captions off.
6. **Process** (13.6–22.6 s): the chat, then the timeline. Inside the screen recordings, punch in to 1.3–1.6 on what the voice names and pull back out; never hold one framing of a screen for more than about 4 s.
7. **Second before/after** (22.6–28.3 s): street, then the night version, hard cut on the same framing in a 0.1 s gap just before "day to night".
8. **Value claim** (28.3–30.5 s): in-camera whip into an overhead laptop shot on "that's an hour of work"; curved text spirals over it.
9. **CTA** (30.5–36.3 s): whip into a dark, candle-lit desk. Kinetic text carries the CTA ("comment" big and white, the keyword in red, "if you want my full guide" scattered round it) from the moment it is said to the last frame. The reel ends on the last word, with no tail and no end card, so it loops.

## Pacing and cutting rules
- **Cut on the phrase that names the next picture.** The picture changes 0.13–0.3 s before the first word of that phrase (measured: 0.21 s median of air before the first word after a cut, 0.11 s after the last word before it). In engine terms: start the incoming shot's `say` on that phrase; the engine's ~0.1 s head pad is right, and its tail of 0.2 s or more on the outgoing shot is fine.
- **A cut may fall inside a sentence on a pointer word:** "...captions | like this", "everything | the text, the timing". Put the boundary in the word gap, never inside a word.
- **Remove breath gaps over 0.4 s inside a shot.** Keep a 0.6–0.9 s breath only where the picture itself is the content: around a before/after reveal and the cut into the screen recording.
- **Shots 1.4–5.8 s, median about 3.3 s.** A short shot (1.4–2.3 s) is fine for the hook and the "before" side of a reveal.
- **Before/after:** a hard `cut` between the two versions at the same framing (same clip position, or the same `zoom` and `focus`); "before" short (about 2 s), "after" long (about 4 s).
- **Speed:** creator B-roll at 1x or 0.8–0.9x for a smoother feel; screen recordings at 1.5–2.5x through dull waiting, muted (the voiceover stays on top).
- Freeze frames: none needed.

## Framing
- Outdoor shots: wide, with the subject off-centre and room for text in the sky or a wall. A slow push of 1.0 → 1.08–1.12 over a held shot.
- Screen recordings must read on a phone: punch in to 1.3–1.6 and reframe on what the voice names (button, prompt box, layer), then pull back for the overview.
- Do not punch in hard on the creator's face.

## Transitions
- Hard cuts, plus **whips filmed in camera** at three moments: into shot 2 after the hook, into the claim, into the CTA. If the footage has a fast pan or tilt, end the outgoing shot inside it and start the next shot inside a move in the same direction. If it has none, use one `slide_left` of 0.3 s with a soft `whoosh` at most twice.
- No crossfade, dip, wipe or glitch. The before/after reveals are hard cuts.

## Look
- Overall `natural` or `warm` on the sunny street; the transformed and night shots carry their own darkness (per-shot brightness -0.05 to -0.1, contrast +0.1, saturation -0.05), practical lights kept warm.
- Screen recordings: brightness 0, contrast +0.05, no saturation boost.

## Text and captions
Captions are the signature: big, scattered and kinetic, never a neat subtitle strip.
- `bold_pop`, large, word-timed, placed in open space (sky, wall, beside the head), white with 1 red highlight word per line (the payoff: "captions", "keyframe", "day", "work", the CTA keyword).
- Captions **off over the screen recordings**, where the product's own text does the talking.
- Text on about 65–70% of the runtime: the hook, the results, the claim and the CTA.
- 1–2 phrases set `behind_subject` when he stands in front of sky or a wall.
- No title card. If the tool must be named, one small `label` with `fade` on the screen shot, under 1.5 s.

## Motion templates and graphics
- The CTA is kinetic text, not a comment bubble. A `comment_cta` bubble with the keyword is optional if the brief wants a clickable-looking CTA; keep the big kinetic "comment KEYWORD" either way.
- `card` can float the prompt or reference screenshot over a result shot (about 70% width).
- Skip character_intro, cast_lineup, stat_card and progress_bar: they read as template.

## Sound
- The voiceover at full level is the constant.
- A soft bed under the whole reel, about 7 dB under the voice (volume `medium`, duck `light`).
- Sound effects, 2–4 per reel: a soft `whoosh` on each whip, a `click` when the prompt is sent, a `pop` when the CTA text lands. No hits or risers.

## Avoid
- Crossfades or flashes on the reveals: the hard cut is what sells the transformation.
- Glitch, wipe or slide transitions everywhere; bottom-locked subtitles; karaoke boxes.
- Leaving an unreadable full-frame screen recording without a punch-in.
- Any pause over 0.4 s inside a shot, and music loud enough to compete with a 190 wpm voice.

**Music and sound** (from the reference reels)
- The reference runs a soft ambient-electronic bed about 7 dB under the voice for the whole reel; no song. Use meditating-beat (92 BPM, ambient-minimal) or blippy-trance (100 BPM) for a techier feel, volume `medium`, duck `light`, starting at 0 s with no intro build. Let it rise slightly for the last second after the CTA line, then end on the cut. Never use upbeat-pop, funk or epic trailer tracks, and never sync cuts to beats: the cuts follow the sentences (1 of 12 cuts on a beat, below chance).
- Library moods: ambient-minimal, electronic-tech, low energy, atmospheric, cinematic night, subtle tech.
