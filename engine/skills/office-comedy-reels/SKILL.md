---
name: office-comedy-reels
description: Workplace and startup comedy skits: mockumentary office episodes with confessionals, POV hooks and cast intros (Cluely / Marketing Interns style). This is the house style for The Boyz, the French four-founder mockumentary.
formats: social_short, ad
---

# Startup Mockumentary Skit (The Boyz house style)

## When to use
Use this for scripted workplace or startup comedy: office scenes intercut with sit-down confessionals, founder banter, and short meme skits about startup life. It is the default for **The Boyz** (French, four founders, confessionals). It also covers the 6–15 s meme posts the same cast makes between episodes.

## What these videos share (17 reels measured)
- **Duration:** median 58.9 s. Episodes run 59–128 s. Meme posts run 6–14 s.
- **Pace:** median 0.26 cuts/s and a 3.1 s median shot. Dialogue-heavy episodes go to 1.8–2.2 s shots.
- **Speech:** about 201 wpm and 83% speech share. The longest pause is a median 1.9 s.
  - The only long silences, 3–11 s, are staged physical gags such as a fire run or someone tasting bad food. They are never dead air.
- **Audio:** 71% original audio. Skits play on the dialogue alone. Licensed music appears only on no-dialogue meme posts and the montage-style friend-types reel.
- **Look:** handheld phone footage, natural colour, no grade. Comedy comes from performance and timing, not effects.
- **Confessionals:** one fixed setup reused across every episode (a closet rail backdrop, a stool, the subject centred, framed full or medium). The first appearance of each person carries a name and role lower third ("Roy / CEO Cluely", "Tim / Marketing").

## Hook (first 2 s)
- **Episodes:** open cold on the conflict already in motion, mid-argument or on the inciting prop (a burning bin, a leaked paper, a stolen lunch). Never open on an establishing shot or silence.
  - Put a POV line on top: text style `caption`, position top third (about 18% from top), 2 lines max, sentence case. Examples: "POV: le groupe WhatsApp fuite chez l'investisseur" or the English "POV: your cofounder pitches to his mom". Animation `fade`, held 2.5–3.5 s, then removed.
- **First spoken word** lands within 0.3 s of frame one. Trim any pre-roll before it.
- **Series branding:** a small `drip` The Boyz logo or a `label` "Ep 12" may sit top-left for the first 2 s. It must never cover a face.

## Structure recipes
**A. Episode (60–100 s target)**
1. **0–2 s:** cold-open conflict plus the POV text.
2. **2–12 s:** escalate in-scene with 3–5 shots.
3. **By 10–15 s:** first confessional. Add `lower_third_3d` (name large, role small, e.g. "Hugo / CEO", "Malik / CTO (autoproclamé)") placed left of the subject at about 60% height, shown 2.5 s.
4. **Middle:** alternate scene and confessional. Each confessional holds 1–3 sentences (3–8 s), then cut back to the action it comments on.
   - Best laughs come from a confessional claim contradicted by the very next shot. Hard-cut on the last word.
5. **Last 3–6 s:** the button, either a confessional tag line or a silent reaction. End on the laugh with no outro, no CTA voice and no fade.

**B. Cast / season intro (30–60 s)**
- Introduce each founder with `character_intro`: freeze on a characteristic action, black-and-white, big stacked name or archetype ("LE CEO", "MR. DEADLINE"). Freeze held 2.2–2.6 s (the shortest the 3D card reads well), then resume live.
- Close on `cast_lineup` of all four with the series title (`title_3d` or `drip`).

**C. Meme post (6–15 s)**
- 1–4 shots, no captions. One relatable line in `caption` style at mid-frame (about 45% height) for the whole video. Music bed at medium. The cut, if any, lands on the beat.

## Pacing and cutting rules
- **Natural gaps, not crushed ones:** 0.25-0.45 s between lines on the same shot, 0.5-0.7 s when a speaker change falls on a cut (measured on 30 sitcoms: Brooklyn Nine-Nine 275 ms, Modern Family 310 ms, The Office 540 ms). Under 0.2 s the edit feels rushed.
- **Remove fillers, stutters, retakes and gaps over about 0.9 s**, not the timing between lines.
- **Label each shot's beat** (setup, punchline, reaction). Punchlines keep their beat before and a hold after, and the picture never leaves them early. Reactions are held until they peak (0.6-1.2 s).
- **Split edits are automatic** (L-cut onto reactions, J-cut into a new speaker).
- **Shot lengths:** 1.5-4 s for dialogue scenes, 3-8 s for confessionals. Never exceed 9 s without a cut or a punch-in.
- **Cut to the listener** for the end of an absurd line; in confessionals, the next shot contradicts the claim, hard cut on the last word.
- **Punchline punch-in:** zoom 1.0 to 1.3 on the punchline, at most once per 10 s.
- **Speed:** keep 1x.
- **Transitions:** `cut`.

## Framing
- 9:16 vertical. Reframe on the speaker's face with eyes at about 35–40% from the top.
- In two-shots, reframe toward whoever delivers the line. Hold the wide for physical gags.
- Confessionals stay centred and static. Do not reframe between takes, so the setup reads as a recurring set.
- Overall look `natural`. If a shot is dim, add brightness +0.1 at most and keep saturation untouched.

## Text and captions
- **The Boyz is shot in French.** Use **translate mode** for English word-timed subtitles. Keep French slang meaning, not literal words.
- **Preset:** `minimal`, white, small size, no box, lowercase as spoken, 2–4 words per chunk.
  - Position lower-middle at about 68% height, clear of the lower third and the platform UI.
- **Highlights:** at most one per 15 s, on the punchline word only. Swears stay censored in the caption ("f*cking").
- **No captions** on meme posts (recipe C) or on music-only stretches.
- Use `card` for screenshots the joke relies on, such as a leaked chat, a salary sheet or a Slack message. Float it upper half for 2–3 s while the line referencing it plays.

## Motion templates and graphics
- `lower_third_3d`: first appearance of each confessional subject only.
- `character_intro` and `cast_lineup`: intros and season openers only.
- `stat_card`: an absurd number gag ("Runway : 11 jours") for 1.5 s.
- Avoid `comment_cta`, `follow_pill`, `progress_bar` and emojis inside skits, because they break the mockumentary illusion. A single 💀 `emoji` is allowed on a meme post punchline.

## Music and sound
- **Skits:** original audio only, at full level.
- **Library bed:** allowed under the cold open or intro montage at volume `low`. It drops out at the first spoken line and returns only for an end lineup.
- **Mock-epic stakes** (a fire drill, a pitch to investors) may use a `low` dramatic bed under the action, cut dead on the punchline.
- **SFX:** `whoosh` into `character_intro`, `hit` on the one freeze-frame. Nothing else, and no laugh-track style pops or dings.

## Avoid
- Bouncy word-pop captions, karaoke boxes or big centre captions on dialogue.
- Colour grades, vignettes and transitions between scenes.
- Music under confessionals.
- Leaving setup air before the first line.
- Explaining the joke with on-screen text after it lands.
- Ending on anything except the laugh.

**Music and sound** (from the reference reels)
- The Boyz' own tracks are in the library (Alex Guz funk, Pixabay: alexguz-*). Prefer them for The Boyz cold opens, intros and end lineups, so every episode sounds like the series.
- For The Boyz episodes, default to original audio with no music under dialogue or confessionals. Optional bed at volume low (around -24 dB under speech) is allowed only under a cold-open action or an intro and cast montage. It starts at frame one and drops out hard on the first spoken line. It may return at low for a final cast_lineup. For mock-serious stakes (an investor meeting, a fake crisis), use a dramatic or epic bed at low under the action, cut dead on the punchline for contrast. Picks: spec-ops (120 BPM) or kings-trailer (80 BPM). For season and cast intros and hype moments, use funkeriffic (112 BPM) or beat-thee (91 BPM) at medium, with character_intro freezes landing on beats. For ironic 'visionary founder' moments, inspiration or favorite corporate (120 BPM) at low. For no-dialogue meme posts, use music at medium-high for the full duration, starting on a strong downbeat: hippety-hop, city-sunshine or arpent. Cut the visual change on the beat.
- Library moods: funky-groovy, hip-hop, dramatic-suspense, cinematic-epic, inspiring-corporate, upbeat-pop, electronic-tech, ironic hype, mock-epic, playful.
