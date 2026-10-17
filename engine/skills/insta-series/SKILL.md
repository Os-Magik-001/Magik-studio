---
name: insta-series
description: Episodes of an Instagram web series (sitcom or mockumentary with recurring characters), including The Boyz house style, from 12 analysed episodes
formats: social_short, ad
---

Use this when the brief, the title or the editor's notes mention an episode, a series, a season, a sitcom, a mockumentary or skit, or name The Boyz. It overrides creator-reels: a series episode is driven by scenes and dialogue, not by a speaker talking to camera.

**What an episode is**
- One scene or one small story per episode, 25–45s, posted daily.
- The episode keeps recurring characters and a running premise. For The Boyz: four founders "building a billion-dollar company" before launching their app.
- Each episode is made of three kinds of footage:
  - **Scene shots:** a static tripod wide of the group (meeting table, whiteboard, sofa, desk).
  - **Confessionals:** one character alone in an armchair, talking to camera, reacting to the scene in the style of The Office.
  - **Inserts:** extreme close-up reactions, an entrance through a door, hands, a screen.
- Dialogue is French, franglais or English. Subtitles are always in English, so the series travels.

**Measured on The Boyz** (12 episodes, Oct 2026; 25–60s, one at 152s; 14–48 likes on 83 followers, trending down)
- **Cold open:** every episode spends its first 5.3s on the same title sequence. The members jump-cut in and out of a group shot on a sofa or rooftop, then a red dripping "THE BOYZ" logo appears with "EPISODE N". The story starts only after that.
- **Long takes:** shots are held 4–12s, with 3–10 cuts per episode after the intro. Dead air (walking in, pauses, laughing) is left in.
- **Subtitles:** English, small white semibold sentence case, at about 70% of the frame height. Each phrase builds up word by word, and swear words are starred ("F*ck").
- **Picture:** the color changes come from LED lights on set, and the grade is otherwise natural. One episode uses a split screen of three faces (a card game).
- **Specials:**
  - The "new member" episode uses glitch transitions and a HUD label ("> PROFILE LOADED / NAME …… ERU / TRAIT …… TATTOOED / STATUS …. CONFIRMED").
  - It shows a huge name title "ERU" with "NEW CHARACTER" under it, and ends on the logo plus "ERU JOINS THE CREW."
- **Filler episode:** music only, two lines of text ("sorry we have plans", then "the plan:") over a moody magenta scene.
- **Borrowed clips:** one episode opens on a scene from a TV show. Flag borrowed footage in `open_questions` (rights), and never rely on it for the hook.

**Dynamic first.** The series must feel as alive as top creator reels:
- Something visible changes every 1–2s: a cut, a punch-in, a push, a new subtitle, a motion graphic.
- Every shot longer than 2s gets a slow push (zoom 1.0 to 1.12, or 1.15 to 1.3), or a cut to a tighter framing halfway through. No shot sits static for more than 2s.
- Use the motion templates (see motion-graphics):
  - a `cast_lineup` opener after the hook
  - a freeze-frame `character_intro` the first time each member matters
  - a `title_3d` for the episode tease and for one big claim
- Comic beats: on a punchline or an absurd claim, freeze for 1.5–2s (a `hold`) with a `hit`, and either a `title_3d` of 1–3 words ("SURE.", "BILLION?") or a `lower_third_3d` with a deadpan fact.

**What to do better** (apply these by default)
1. **Hook before the title.** Open on the episode's funniest or boldest line, 1.5–3s, with its subtitle; for example "Bro, what the f*ck?" or "We're going to destroy Facebook."
   - Then a short title sting, 1.5–2.5s: the group shot, if the footage has it, with a `drip` title "THE BOYZ\nEPISODE N", position `top`, animation `pop`. Never spend 5s on the intro.
   - If there is no group shot, put the drip title over the first scene shot.
2. **Cut the dead air:**
   - Remove pauses over 0.3s, entrances that take longer than 1.5s, and repeated lines.
   - Keep reaction beats of 0.5–1s: they are the comedy.
3. **Make coverage from one wide:**
   - The scenes are filmed on a single static camera. Alternate the full wide (zoom 1.0) with a punch-in of 1.25–1.5 on whoever speaks, with `focus` on their face, on every line change. Stay within the clip's sharp-zoom limit.
   - On a punchline or a shocked reaction, snap in to 1.5–1.8 on the face for 0.5–1s.
4. **Confessionals are the joke engine.**
   - Cut to a confessional right after a claim in the scene, so the character contradicts or mocks it ("He's always late, this bastard"). Then cut back to the scene.
   - Keep each confessional 2–5s.
5. **Name the characters with motion, not labels.** On each character's first appearance in an episode, freeze on them and run a `character_intro` (name, role, 2–3 funny stats), with a `hit` and a `whoosh`. In later episodes, use a `lower_third_3d` instead. New viewers find out who's who, and it looks produced.
6. **Subtitles in the series look.** Use the subtitle settings under "Text and sound" below.
7. **End on a hook for the next episode,** never on a fade:
   - the cliffhanger line, or a `label` "EPISODE N+1 TOMORROW" for 1.5s
   - plus a `follow_pill` with the handle in the last 2s.
   - No end card.
8. **Length:** 25–45s. If a scene runs longer, keep the strongest 45s and say in `open_questions` where a part 2 could start.

**Text and sound**
- **Subtitles:**
  - `captions.mode: translate`, preset `subtitle`, size `medium`, position `bottom`, color #FFFFFF, `words_per_screen` 6–8.
  - Write one caption item per spoken phrase: a faithful, natural English translation of 3–8 words, timed on the finished timeline from the phrase's first word to its last word plus about 0.2s.
  - Translate the comedy, not word for word. Keep English lines as spoken, and star swear words ("f*ck").
  - If the dialogue is already all English, use `auto` with preset `subtitle` instead.
- **Logo:** `drip` style, red (the default), "THE BOYZ\nEPISODE N" on the title sting or over the `cast_lineup`. Use `behind_subject` only when the members' heads overlap the lower part of the letters.
- **Accent color:** red #E0222B for every motion template and the caption highlight.
- **Reveal titles:**
  - For a new character or a big announcement: a `hero` with the name ("ERU"), `pop`, plus a `label` under it ("NEW CHARACTER"), with a `glitch` transition into the reveal shot.
  - For HUD-style info: a `label` with `typewriter` ("PROFILE LOADED · NAME: ERU · STATUS: CONFIRMED").
- **Transitions:** hard cuts inside a scene. `glitch` (0.25–0.35s) only for reveals, a new character, a "system" moment or the title sting; at most 2 per episode. `dip_to_black` (0.3s) for a time jump.
- **Music:** a light comedic or hip-hop bed at `low` under dialogue, louder (`medium`) on the title sting and on wordless moments.
- **Sound effects:** `hit` on the punchline or a snap-zoom reaction, `whoosh` on glitches, `pop` on name labels. Use 3–6 per episode.
- **Look:** `natural`. Fix dark scene shots with brightness +0.05 to +0.1. Never grade away the LED colors: they're the set's look.

**Episode recipes**
1. **Scene episode** (most episodes, 30–40s):
   - hook line, 2s
   - title sting, 2s
   - scene setup: who wants what, 5–8s
   - escalation with 1–2 confessionals, 15–20s
   - punchline or reaction snap-zoom
   - next-episode tease
2. **New character or reveal:**
   - hook (the door opening or a teaser line)
   - glitch into the reveal shot
   - name hero with a "NEW CHARACTER" label and a HUD typewriter
   - the others' reactions
   - the drip logo with a "[NAME] JOINS THE CREW." label at the end
3. **Mood or filler** (no dialogue, 15–30s):
   - music at `high`, a slow moody scene
   - 1–2 short `label` lines that set up the joke, such as "sorry we have plans" then "the plan:"
   - Hold each line 2–3s; captions `off`.

**Flag what we can't do yet** (in `open_questions`): split screens of several faces at once, and scenes that were never filmed.
