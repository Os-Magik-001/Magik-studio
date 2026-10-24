---
name: insta-series
description: Episodes of an Instagram web series (sitcom or mockumentary with recurring characters), including The Boyz house style, measured frame by frame on all 19 Boyz posts (Oct 2026)
formats: social_short, ad
style: dynamic
agents: editor, sound
---

For The Boyz and other workplace or startup comedy, office-comedy-reels gives the comedy cutting technique (confessional contradictions, reactions, the pause before a punchline) and the `cutting` skill the cut mechanics. This skill gives the series itself: the cold open and title, the episode's shape, The Boyz' own timing, subtitles, music and the specials. Where this skill gives a number for The Boyz, use it.

Use this when the brief, the title or the editor's notes mention an episode, a series, a season, a sitcom, a mockumentary or skit, or name The Boyz. It overrides creator-reels: a series episode is driven by scenes and dialogue, not by a speaker talking to camera.

**What an episode is**
- One scene or one small story, 25-58 s, posted daily, with recurring characters and a running premise. The Boyz: four founders "building a billion-dollar company" before launching their app (MI6, Joy Boy, Ghost/Rassim, a fourth founder; Eru joined in a special).
- Three kinds of footage: **scene shots** (usually one camera per scene: a locked wide or a handheld that pans between speakers), **confessionals** (one character alone, locked off, in one of two fixed sets), **inserts** (a door, a screen, an object, a person named).
- Dialogue is French, franglais or English; subtitles are always English.

**Measured on The Boyz** (19 posts, Sep 28 to Oct 21 2026: 14 dialogue episodes, a filler, the Eru special, a meme, an app ad; 519-1,807 plays)
- **The dialogue cuts are already well timed:** every speaker-change cut sits in the gap between lines (0 split edits in about 85 story cuts), 0.20-0.28 s after the last word and 0.22-0.30 s before the next; combined air at a speaker change 0.52 s median (0.32-0.70 s). Six of 26 are snaps of 0.13-0.26 s.
- **The dead frames are elsewhere:** a pro would remove about 10% of each episode (4-25%), plus 3 s of title. They are walk-ins (4.6 s), stares after a line (3.3 s), empty lead-ins (2.6-7 s before the first word), pauses of 1-2.9 s inside long takes, reactions left running 3.4-4.3 s, freeze cards of 4-5 s, fades and empty frames after the button, and a 5.3 s title before the first word in 13 of 14 episodes.
- **Shots:** story shots median 4.0 s; confessionals 1.8-4.8 s (median 3.0 s); scene shots median 4.9 s, with 9 of 31 running 7-12.3 s. No pushes and almost no punch-ins in the episodes; jump cuts only in the title.
- **Jokes:** a hard cut from a scene claim to a confessional that contradicts it (12 of 14); a silent reaction of 1.2-1.9 s at the head of a confessional; performed pauses of 0.7-1.8 s ("a guy who [1.1 s] knows a guy"); confessional relays; episodes end 0.16-0.8 s after the button, with no call to action or tease.
- **Subtitles:** English, white, no box, sentence case, placed and chunked differently from episode to episode (45-83% of the height, 2-9 words); the newest use 3-6 words at about 68-72%, built word by word. Swears are starred in only 2 of 5 episodes that swear.
- **Sound:** music under the title in every episode; 7 of 14 are dry after it; the others bring a low bed in on a silent comic beat, a montage or a workout (about 7-8 dB under the voice).

**How to cut an episode**
1. **Cold open:** the first segment is the episode's funniest or boldest line, copied from later in the episode: 2-3 s, `beat: punchline`, first word by 0.9 s. Cut 0.3 s after its last word into the title, and keep the line in its original place too. Example: "on va le détruire" (Ep 11 @ 12.70).
2. **Title sting, 2.0-2.5 s:** the last 2.0-2.3 s of the series title clip (from the shot where the drip logo appears), a `drip` title "THE BOYZ\nEPISODE N" (position `top`, animation `pop`) if the clip doesn't carry it, music only here. Never spend 5 s on the intro. The first story line starts 0.15-0.25 s after the title.
3. **Scene setup, then escalation:** who wants what, then the claim → confessional contrast, 1-3 times. Cut to the confessional right after the scene's claim (hard cut on the last word or a snap); the confessional contradicts or mocks it ("He's always late, this bastard").
4. **Timing:** keep the `say` padding (about 0.1 s before, 0.2-0.35 s after, set by the engine). Target 0.35-0.75 s of combined air at a speaker change; snaps (0.3 s combined at most) for a jab confessional, an answer or a phone reply.
5. **Straight cuts:** the show never splits sound and picture at a speaker change: the picture stays on the speaker to his last syllable. Use `cutaway` overlays only for an insert or an off-screen voice. Until the engine can switch its automatic split edits off, label the last line before a speaker change `punchline` where the picture must stay, and say in `open_questions` that the show is cut without split edits.
6. **Silent action caps:** an entrance or exit at most 1.5 s from the cut to the first word; sitting or standing at most 1.0 s; empty air before a scene's first line at most 0.5 s; a silent insert at most 2.0 s (2.5-4 s for a card to read); reactions after a gag at most 1.5 s; the button plus 0.4-0.8 s. Cut on the key frame of the action (the door opening, a body crossing the lens, the hand on the object). If the speaker is still turning or looking at the out point, extend `end` to the end of the movement (at most 0.8 s past the last word).
7. **Coverage from one wide:** any dialogue shot over 6 s gets a change at the next speaker change or on the claim: a static punch-in (`zoom` 1.25-1.35, start = end, `focus` on the speaker's face, within the clip's sharp-zoom limit) or a jump cut in a gap of 0.6 s or more. Never a static wide over 7 s. Go back to the wide for group chants and physical gags. Once per episode, a static snap to 1.6-1.8 on the stunned listener right after the line, with a `hit`.
8. **Confessionals:** 1.8-4.8 s, static and centred (zoom start = end), one fixed set per character group. A silent reaction at the head of a confessional is its own segment, `beat: reaction`, kept 0.6-1.3 s. Relays of 2-3 confessionals answering each other, 2-4 s each, work well. After a confessional punchline keep 0.4-0.6 s of the held pose.
9. **Performed pauses:** a gap that holds a gesture (a lift, a lean-in, the beat between barked orders, a deliberate pause before the last words of a joke) is kept at 0.6-1.0 s: keep the setup and the punchline in one segment labelled `punchline` and write "beat" in its `purpose`, so the trim pass leaves it as planned. Only empty gaps over 0.75 s are cut.
10. **Characters:** name each character the first time he matters in an episode: a freeze (`hold` 2.2-2.6 s, starting on his last syllable) with a `character_intro` (name, role, 2-3 funny stats) and a `whoosh`, or, on-style for the show, a parody-credits line ("FEATURING ... AKA «JOYBOY»") as a `label` with `typewriter`. At most one freeze per episode besides the intros.
11. **Ending:** end on the laugh: the button plus 0.4-0.8 s, no fade, no empty frame. Plan the episode at 58 s or less so a 60 s cap never eats the final hold. A next-episode `label` ("EPISODE N+1 TOMORROW", 1 s) only after the laugh has been held; no follow pill inside the episode.
12. **Length:** 25-45 s by default; up to 58 s when the scene earns it. If a scene runs longer, keep the strongest part and say in `open_questions` where a part 2 could start.

**Text and sound**
- **Subtitles:** `captions.mode: translate`, preset `subtitle`, size `small` or `medium`, position `bottom` (the engine places it at about 70% of the height), white, sentence case, `words_per_screen` 4-6. Write one caption item per spoken phrase: a faithful, natural English translation of 3-6 words, timed on the finished timeline from the phrase's first word to its last word plus about 0.2 s. Translate the comedy, not word for word; keep English lines as spoken; star every swear ("f*ck"); shouted lines in capitals; a dialogue dash when two speakers share a line. If the dialogue is all English, use `auto` with preset `subtitle`.
- **Logo:** `drip`, red (the default), "THE BOYZ\nEPISODE N" on the title sting. `behind_subject` only when the members' heads overlap the lower part of the letters.
- **Accent colour:** red #E0222B for motion templates and the caption highlight.
- **Music:** a `section` under the cold open's end and the title only; dry under scene dialogue. A bed may enter on a silent comic beat, a montage or a workout and carry through the closing confessional, at `medium` with duck `light` (about 8-10 dB under the voice, as the episodes that do it). A mock-epic bed under a heist or crisis scene with dialogue stays `low` (Ep 14's, 4 dB under the voice, was too loud) and cuts dead on the punchline.
- **Sound effects:** 0-3 per episode: `hit` on the snap zoom or the one comic freeze, `whoosh` into a character intro, `pop` on a name label. Never on a punchline.
- **Look:** `natural`. Fix dark scene shots with brightness +0.05 to +0.1. Never grade away the LED colours: they're the set's look.
- **Transitions:** hard cuts inside and between scenes (cut inside an in-camera whip when the footage has one). `dip_to_black` (0.3 s) only for a real time jump.

**Episode recipes**
1. **Scene episode** (most episodes, 30-45 s): cold open 2-3 s → title 2-2.5 s → setup 5-8 s → escalation with 1-3 claim/confessional contrasts, 15-25 s → button + 0.4-0.8 s.
2. **New character or reveal (the Eru special):** music only; a cut every two beats (1.2 s at 100 BPM) with a 2-3 frame `glitch` on each cut (this format is exempt from the glitch limit); slow pushes of 1.06-1.2; about 2 s of silence before the door opens; a `hero` with the name within 1.5 s of the person being framed, plus a `label` "NEW CHARACTER" and a HUD `label` with `typewriter` ("PROFILE LOADED · NAME: ERU · STATUS: CONFIRMED"); the drip logo with "[NAME] JOINS THE CREW." and "NEW EPISODE - COMING SOON" for at most 3.5 s at the end.
3. **Mood or filler** (no dialogue, 15-30 s): music at `high`, a moody scene cut every 8 beats (3.7 s at about 128 BPM); 1-2 stacked `label` lines that set up the joke ("sorry we have plans", then "the plan:"), kept up together; captions `off`.
4. **App ad or teaser:** first word by 0.3 s, a caption from frame 0, a cut every 1.0-1.5 s on the beat, jump cuts in the gaps between phrases, one highlight word per caption line, an end card of 1.0-1.5 s.
5. **Meme post** (12 s, the account's most played): one static shot or a chat card for the whole reel, the joke in text; see office-comedy-reels recipe C.

**Flag what we can't do yet** (in `open_questions`): switching off the automatic split edits; pans between speakers and whip pans (static `focus` per segment); a true snap zoom in 0.4 s; the dim, dusty freeze card with a typewriter serif card; split screens of several faces; scenes that were never filmed.
