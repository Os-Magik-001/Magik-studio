---
name: reel-dbocjkssdqt
description: Cinematic AI-tool demo reels: a creator voiceover at ~190 wpm over moody, graded lifestyle shots and screen recordings, with scattered kinetic word captions (white, key words in red), a before/after reveal, and a comment-keyword CTA. 30–40s, original audio, no song.
formats: social_short, ad
style: dynamic
when: dbocjkssdqt
agents: editor, sound
---

# AI Tool Demo – Cinematic Voiceover Style

## When to use it
Use this when the footage is a creator showing off a software or AI workflow, such as an editing plugin, a generative tool, or a "this replaced an hour of work" claim. The source usually mixes three kinds of material: cinematic shots of the creator (walking, standing in a street, working at a desk at night), screen recordings of the tool (prompt box, timeline, panels), and a before/after result. The voice is a tight, scripted voiceover, not a rambling talking head. If the footage is one locked-off talking head with no screen material, pick a different skill.

## What these videos share (measured)
- Duration: **36.4s**. Aim for 30–40s and never go past 45s.
- Cut rate: **0.19 cuts/s**, which is about 7 cuts and 8 shots. Median shot is **4.2s**, and most shots fall between 3 and 6s. This is a calm, cinematic edit, and the energy comes from the voice and the text rather than from cutting.
- Speech: **191 words/min**, and the voice is present **98%** of the runtime. The **longest pause is 0.3s**, so there is effectively no dead air.
- Audio: **100% original**. The voiceover carries the reel and no recognisable song is used.
- Look: cool, low-key and cinematic. Evening blues are offset by warm practical lights (street lamps, candles). The screen recordings are dark-UI.

## Hook (0–3s)
Open on the **result**, not the explanation. The first line names the payoff ("You can now create captions like this without touching a single keyframe"). It plays over a cinematic shot that already wears the styled kinetic captions, so the caption style itself is the proof.
- Shot 1: the creator in a wide, low-angle street shot with a slow push from 1.0 to 1.08 zoom. Show captions from word 1.
- By about 2.5–4s, cut to the transformed version of the same location (day → night). Use a **crossfade of 0.3–0.4s** or a **dip_to_white of 0.2s** so the change reads as a reveal. Put a kinetic caption on the transformation line, for example "change the time of the day".
- Do not open with a logo, a title card or the screen recording.

## Structure recipe (8 shots, about 36s)
1. **Hook / result A** (0–3.5s): cinematic creator shot with kinetic captions.
2. **Result B** (3.5–7s): the before/after reveal shot, with captions on the key phrase.
3. **Name the tool** (7–11s): screen recording of the plugin panel. Punch-in to 1.3–1.5 with reframe on the panel/menu being described. Captions off, or use one small label with the tool name.
4. **Process: input** (11–15s): the prompt/chat window. Punch-in to 1.4–1.6 with focus on the text box. Optionally float a `card` (screenshot) of the reference style.
5. **Process: output** (15–20s): the timeline or comp showing generated layers. Use a slow push from 1.0 to 1.15. The on-screen generated text is the hero here, so keep captions minimal or off.
6. **Second result** (20–25s): the night/cleaned scene with the prompt box overlaid as a `card` at bottom-center ("change the time of day to night"). Use a typewriter text if no screenshot exists.
7. **Value claim** (25–30s): moody B-roll such as hands on a laptop or a low-angle desk shot, with a slow push. The big kinetic caption carries the claim ("an hour of work"), with "work" highlighted.
8. **CTA** (30–36s): a dark, warm-lit desk shot (candles, laptop glow). The kinetic caption carries the CTA, with the keyword highlighted, plus a `comment_cta` graphic showing the keyword (e.g. COOK). Add a `pop` SFX when it lands.

## Pacing and cutting rules
- Snap every in/out to word edges. Allow 0.04–0.08s of head pad and 0.08–0.12s of tail pad.
- Remove every breath gap over 0.3s, because the measured max pause is 0.3s. Never leave silence between sentences.
- Cut only on sentence or clause boundaries. One idea gets one shot of about 4s. Do not cut mid-phrase just to add energy.
- Keep shots between 2.8s and 6.5s. If one visual has to cover more than 6.5s, split it with a punch-in on the same clip (1.0 → 1.25) instead of adding a new source.
- Speed: cinematic B-roll can run at 0.8–0.9x for a smoother feel. Screen recordings can run at 1.5–2.5x through dull UI waiting. Mute the clip audio of any sped shot, because the voiceover stays on top.
- Freeze frames are optional. Use one 0.5–0.8s `hold` at most, on the finished result.

## Framing
- Cinematic shots: leave them wide, with the subject off-center and room for text in the negative space (sky, road, wall). Use a slow push of 1.0 → 1.08–1.12 over the shot.
- Screen recordings: these must be readable on a phone. Punch in to 1.3–1.6 and reframe on whatever the voice is naming at that moment (button, prompt box, timeline layer).
- Do not shake the frame, and do not punch in hard on the creator's face.

## Look
- Use the overall look **cinematic**. If the footage is very neutral, apply **cool** instead.
- Night/evening shots: brightness -5 to -10, contrast +10, saturation -5. Keep the practical lights warm.
- Screen recordings: brightness 0, contrast +5, and no saturation boost.

## Text and captions
Captions are the signature of this style. They are big, scattered and kinetic, never a neat subtitle strip.
- Use the preset `bold_pop` with word-timed animation in large size, positioned in the open negative space (lower-left or center), not at the bottom edge.
- Highlight 1–2 payoff words per line ("time", "day", "captions", "work", "guide", the CTA keyword). Highlights show in a red accent and the rest stays white.
- Where the creator stands in front of sky or a wall, use **text behind the person** on one hero phrase. Once or twice per reel is enough.
- Turn captions **off** on screen-recording shots where the UI text already does the talking, or drop to `minimal` at small size.
- Show captions on about 60–70% of the runtime, mainly on the hook, the results, the claim and the CTA.
- Title text: none at the start. If you name the tool, use one `label` text with a `fade` animation on the screen shot, under 1.5s.

## Motion templates and graphics
- `comment_cta` with the keyword on the final shot is required.
- `card` floats the prompt or reference screenshot over the result shots, scaled to about 70% width, bottom-center.
- Skip character_intro, cast_lineup, stat_card and progress_bar. They read as "template" and break the cinematic tone.
- An optional `counter` can count "60 → 1" (minutes) on the value-claim shot, but only if it is not covered by captions.

## Sound
- The original voiceover sits at full level and is the only constant.
- Sound effects are sparse, 2–4 per reel: a soft `whoosh` on the day→night reveal, a `click` when the prompt is sent, and a `pop` on the CTA graphic. No hits or risers.
- For music, see the music report. The default is no bed, and if one is added it stays low and ambient.

## Avoid
- Fast cutting under 2s per shot. It fights the cinematic calm.
- Glitch, slide or wipe transitions. Use hard cuts, plus a single crossfade or dip_to_white on the transformation.
- Captions in a box or karaoke_box, and bottom-locked subtitles.
- Punchy or oversaturated looks, and anything with bright daylight left ungraded next to the night shots.
- Leaving unreadable full-frame UI on screen without a punch-in.
- Any pause over 0.3s, and any music loud enough to compete with a 190 wpm voice.

**Music and sound** (from the reference reels)
- Default to original audio only, with no music bed. Add a bed only if the source voiceover is dry or the room tone is noisy. In that case use ambient-minimal or low-energy electronic (meditating-beat at 92 BPM, or blippy-trance at 100 BPM for a more techy feel) at LOW volume, ducked under speech so it sits roughly 20–24 dB below the voice. Start it at 0s with no intro build and run it under the whole reel. Let it rise slightly (still low) for the last 1s after the CTA line ends, then end on the cut. Never use upbeat-pop, funk or epic trailer tracks, and never sync cuts to beats, because the cuts follow sentences.
- Library moods: ambient-minimal, electronic-tech, low energy, atmospheric, cinematic night, subtle tech.
