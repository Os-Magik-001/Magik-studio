---
name: cutting
description: Where to cut and how long shots last, by format: cut points around words, air at cuts and inside shots, cutting on movement, jump cuts and size changes, inserts and cutaways, reactions and comedy timing, J/L cuts, music-driven cuts and the hook. Measured on the studio's ~500 reference reels and checked frame by frame on the most played.
formats: all
agents: editor
---

# Cutting

This is the cut itself: where each `start` and `end` goes and how long each shot lasts. Format skills (office-comedy-reels, insta-series, creator-reels, trailer-and-montage...) choose the style; where one of them gives a number for its own format, use that number. Everything here was measured on the references the studio gave (Cluely, The Marketing Interns, The Boyz, J.K. Hamington, Kapsalon, 13 single references) and checked frame by frame on the most played. @omgadrian's 268 editing lessons (see the omgadrian skills) agree on the core: hide each cut in a movement, give every named thing its own picture, alternate sizes at sentence ends, and keep the face for the payoff.

In the clean editing style, use only what that style keeps (hard cuts, static framing up to 1.4, subtitles, a music section under the series intro): the engine removes freezes, pushes, transitions, titles and effects.

## 1. Choose the cutting profile first

| Profile | Median shot | Air at a cut (after the last word + before the next) | Pauses kept inside a shot | Split edits |
|---|---|---|---|---|
| **Dialogue comedy** (Cluely-style skits, office episodes) | 2.0 s; dialogue singles 1.5-3 s; confessional face 1-4 s | 0.0-0.25 s at a fast speaker change; about 0.5 s at a slow one | 0.15-0.4 s (median 0.23) | small automatic J/L (±0.13 s) at in-scene speaker changes; long sound-first entries (0.6-1.6 s) into confessionals |
| **Series episode** (The Boyz) | 4.0 s story shots, confessionals 3.0 s | 0.2-0.3 s after + 0.2-0.3 s before; 0.35-0.75 s at a speaker change (median 0.52) | 0.25-0.45 s | none: the picture stays on the speaker to the last syllable |
| **Meme skit, no dialogue** | 2-3 shots in 7-14 s | n/a: cuts on movements and sound events | n/a | none |
| **Creator talking head** (multi-setup, voice as one stream) | 1.2-2.5 s inside a set-up; a new set-up every 4-8 s | 0.1-0.17 s after + 0.09-0.21 s before, often between words with no pause | 0.12-0.25 s, never over 0.3 s | none (one speaker) |
| **Voiceover demo / cinematic** | 3.3 s (1.4-5.8) | 0.1 s after + 0.2 s before | 0.15 s; one 0.6-0.9 s breath at a reveal | n/a |
| **Music montage / event promo** | phone footage 0.45-1.8 s (median 0.75-1.15); steady footage one bar per shot (1.7-2.0 s at 120-140 BPM) | voice-over: the picture 0.0-0.15 s before the phrase | n/a | n/a |

When a reel mixes them (a meme skit with one spoken line, an episode with a music montage), switch profile for that section.

## 2. The cut point

**In speech: cut in the gap, never in a word.**
- Give every speech shot its exact words in `say`. The engine places the in point about 0.1 s before the first word and the out point 0.2-0.35 s after the last, always inside a real gap in the sound (or in the middle of a shorter gap). Those defaults sit inside what the references do: the series leaves 0.20-0.28 s after the last word and 0.22-0.30 s before the next (a little more head than the engine's 0.1 s), creator and voiceover reels 0.1-0.17 s + 0.09-0.21 s (a little tighter). Fast comedy exchanges run tighter still: the next speaker comes in 0.0-0.25 s after the last. Two shots joined by `say` keep about 0.3 s of air between them, which reads fine in most scenes; for a rapid-fire exchange from one take, keep both lines in one segment so their own timing survives.
- A clipped word is the worst mistake in a speech edit: the studio's clients sent cuts back for it. A "t", "k" or "p" release belongs to the word before it; a trailing "s" is part of the word. When in doubt, leave 0.2-0.35 s after a line rather than 0.1.
- Never let the same syllable play twice across a cut (two takes overlapping by a few frames), and never leave a blank after a transition: speech starts 0.1-0.25 s after the cut.
- When the picture must change while someone keeps talking (an insert, a reaction, a confessional voice running over the scene), the sound does not cut: use a `cutaway` overlay over the continuing shot, or a J/L cut (section 7).

**Cut on the movement, not on a fixed offset from the word.**
- If the speaker is still turning, looking or gesturing at the out point, extend `end` to the end of the movement, up to 0.8 s past the last word. A look to camera is held until it lands (about 1.2 s).
- Cut on the key frame of an action: the door opening, a body crossing the lens, the hand closing on the object, the peak of a gesture, a phone lifting into its own screen, an exit while the last people are still in frame (the next shot showing them arrive within 0-1.1 s).
- A freeze (`hold`) starts on the last syllable of the line it punctuates (0.0-0.2 s after it).

**Silent action caps** (where the "frames that need to be cut" hide; the studio's own series loses 5-25% of its runtime to them):
- an entrance or exit: 1.5 s at most from the cut to the first word; sitting down or standing up: 1.0 s;
- empty air before a scene's first line: 0.5 s at most;
- a reaction or aftermath after a gag: 1.5 s at most in dialogue (longer only in a no-dialogue meme, where the reaction is the punchline);
- after the button: 0.3-0.8 s, then the end. Plan an episode with a 60 s cap at 58 s or less, so the cap never eats the final hold.

## 3. Pauses inside a shot

- Keep the breathing between phrases: 0.15-0.45 s in dialogue (Cluely's median is 0.23 s, The Boyz 0.25-0.45 s), 0.12-0.25 s for a creator or realtor talking head. Under about 0.1 s between sentences sounds frantic, except in a deliberate fast exchange.
- Remove empty pauses. Creator, realtor and voiceover reels never keep more than about 0.3 s inside a shot; dialogue removes gaps over 0.75-0.9 s (the trim pass does this automatically from 0.75 s).
- **Performed pauses are content, not dead air:** the beat before a punchline (0.8-1.6 s in the most played Cluely episodes: "or" / 1.1 s / the punchline), a deadpan hold, a shrug, a stare before a confessional line (0.6-1.3 s), the beat between barked orders. Keep them at 0.6-1.6 s and protect them:
  - keep the setup's last phrase and the punchline in **one** segment labelled `beat: punchline`, and write "beat" (or "pause", "deadpan", "stare") in its `purpose`: the trim pass then leaves that segment exactly as planned. Without the word, it keeps only the pauses before a punchline's last three words and cuts longer gaps before them;
  - a silent reaction is its own segment, `beat: reaction` (never trimmed).
- One deliberate 0.6-0.9 s beat is allowed in a creator reel, right after a claim, while a proof card lands.

## 4. Jump cuts and size changes

- **A size change at a cut inside one take is either 0 or at least 0.3.** A raw jump at the same size reads as an edit and is fine between sentences or list items; a change of 0.3 or more reads as a second camera. A change of 0.08-0.2 reads as a glitch (the studio's clients rejected 1.0 / 1.1 / 1.15). The engine widens anything smaller to 0.3.
- **Monologues, rants and lists** (dialogue comedy): one jump per sentence or list item, the pause removed completely, 0.8-4.3 s apart, the turn or topper on its own jump. Keep the same `zoom` (9 in 10 Cluely jumps change size by under 3%).
- **Creator set-ups:** inside one set-up, cut every 1.2-2.5 s, split at every list item and between a question and its answer, and alternate `zoom` 1.0 and 1.3 on a wide (1.0 and 1.3+ on a chest-up source); the answer and a one-word aside get the tighter size. A same-size jump is allowed only when a `card`, a hero title or a 0.05 s `dip_to_white` starts on the same frame.
- **Coverage from one locked wide** (series): a dialogue shot longer than 6 s gets a change at the next speaker change or on the claim: a static punch-in of 1.3-1.35 (`zoom` start = end, `focus` on the speaker) or a jump cut in a gap of 0.6 s or more. Go back to the wide for group gags and physical comedy, where body language reads. Once per episode, snap to a static 1.6-1.8 on the stunned listener, right after the line.
- **Emphasis zoom** (realtor and creator social reels): about 1.5-1.7x on the key line or number, in 0.3-0.5 s, held 1-2 s, back out in 0.5-0.7 s, at most once per 10-15 s. Build it from three contiguous segments of the same take: `zoom` {1.0 → 1.6} over the 0.3-0.5 s that end on the word, {1.6 → 1.6} for 1-2 s, {1.6 → 1.0} over 0.5-0.7 s (stay within the clip's sharp-zoom limit).
- **Punchlines do not get the punch-in in dialogue comedy.** A punchline gets a new shot (the face, the confessional, the listener); a static punch-in of 1.1-1.25 belongs on the reaction hold.

## 5. Inserts, cutaways and B-roll

- Cut to what the line names: the picture arrives 0.0-0.3 s before the key word (up to 0.75 s for a slower series), so the word lands on its picture. Its in-point is on the noun, its out-point at the end of the phrase.
- Lengths: B-roll under a voice 0.6-3.3 s (median 1.3 s); an object insert 1.0-2.3 s; a screen or card that has to be read 2.5-4 s; a rule-of-three triple about 0.85 s each, the third a little longer; a spoken list (dishes, features) one picture per item, 0.5-0.9 s.
- **Voice-led reels** (narration, reviews, announcements): keep the narration in long segments and lay the pictures on it as cutaways in the gaps between words, never inside a word; never end a segment just to change the picture (the top restaurant reels: 0 of 63 cuts inside a word).
- Lay B-roll as `cutaway` overlays so the voice runs on. End them 0.0-0.2 s before the tag line: the punchline, the call to action and the sign-off are always on the face.
- A confessional or narration that is contradicted by the next shot: the contradicting picture arrives 0.0-0.3 s before the key word, in mid-sentence; the end of the claim plays over the proof.
- For a talking head, cards over the speaker on the word (one every 2-5 s) usually beat full-screen cutaways; proof screens may hold 3-3.5 s.

## 6. Reactions and comedy timing

- **Cut to the listener on the punchline's last syllable** (a 0.1 s L-cut is fine), or straight into the next setup. Do not hold on the speaker after a punchline: 0-0.3 s, then cut away (a confessional deadpan may hold its pose 0.4-0.6 s).
- **Reaction holds:** a silent reaction in dialogue comedy 1.4-2.5 s (median about 1.9 s; with no laugh track, the hold is the laugh); in a slower series 0.8-1.5 s; in a no-dialogue meme the reaction is the punchline, 1.5-5.4 s.
- **Claim → contradiction:** cut from the claim straight to the shot or confessional that contradicts it, on the last word or 0.0-0.3 s before the key word. It is the most used joke device in every comedy account.
- **Instant reply:** when the joke is how fast a character answers, jump out the listener's turn so the reply starts within 0.1 s of the question.
- **Snap cuts:** a jab confessional, an answer, a phone reply: 0.0-0.1 s after the line, 0.0-0.15 s before the reply, 0.3 s combined at most.
- **Confessionals:** in dialogue comedy the face is on screen 1-4 s at a time (median 2.8 s) while the voice runs on over B-roll; in a series, static confessionals of 1.8-4.8 s (median 3.0 s), cut in right after the scene's claim; relays of 2-3 confessionals answering each other, 2-4 s each.
- **The button:** cut within 0.2 s of the button line, or end on a silent 2-3 s reaction. Never add a line after the topper; callbacks to the opening make good buttons.

## 7. J/L cuts (split edits)

- The engine moves the picture automatically at hard cuts between different shots: an L-cut 6 frames early onto a reaction, a J-cut 4 frames late into a new speaker, never off a punchline and never inside one take. That matches in-scene speaker changes in fast dialogue comedy (measured ±0.13 s).
- Longer splits are a cutting choice; build them with a `cutaway` overlay:
  - **sound-first entry into a confessional** (0.6-1.6 s in the top Cluely episodes): start the confessional segment 0.6-1.6 s earlier and cover its first 0.6-1.6 s with a `cutaway` of the scene's continuing picture;
  - **the next scene's line over a still confessional face** (about 1 s): the reverse;
  - **an off-screen question finishing over the subject listening** (0.6-0.9 s);
  - **a sentence bridged between scene and confessional:** split it at a comma or before the key noun, each segment carrying its half in `say`.
- Some shows never split (The Boyz: 0 of 72 cuts). For them, label the last line before a speaker change `punchline` when the picture must stay to the last syllable, and say in `open_questions` that the automatic split edits should be off.
- Under a whip or any designed transition, no split.

## 8. Music-driven cuts

- In talking reels the cuts follow the words; their cuts land on the beat no more often than chance, in every account.
- In no-dialogue memes the cuts land on movements and sound events (an exit, the peak of a gesture, a voice onset within 1 frame, the end of a sound phrase, the music returning after a gap, a lyric gap), not on a beat grid. Snapping them to beats would pull them off the moments that make them work.
- Montages and reveal specials cut every one or two bars: at 120 BPM a bar is 2.0 s; at 100 BPM two beats are 1.2 s. Plan their shot lengths as multiples of the track's beat (the library lists each track's BPM); the sound designer then lines the track up with the cut.

## 9. The hook

- Talking reels: first word by 0.25 s (creators measured 0.0-0.42 s), text on screen by 0.25-0.5 s, first cut or size change within 0.25-2.6 s.
- Dialogue comedy: either the first line within 0.3 s, or a silent action from frame 0 under the POV line, up to about 5 s when the action is the premise; first cut around 3.4 s.
- Meme skits: no cut in the first 2.5 s (median first cut 2.8-3.0 s): a held, composed wide with the premise text on screen from frame 0; the first cut is the twist, at 37-48% of the reel, and the payoff takes the rest.
- Series: a 2-3 s cold open from later in the episode (`beat: punchline`), then at most 2-2.5 s of title. A 5 s title before the first word is the biggest block of dead weight in a 30-60 s episode.

## 10. Transitions

- Hard cuts are the default in every profile; in dialogue comedy and series episodes, all of them (whips only when filmed in camera: cut inside them).
- Creator reels with several set-ups: a 0.2-0.5 s whip on most set-up changes (13 of 16 in the measured slower creators): `slide_left` 0.3 s, or `zoom_in` 0.3 s when the next shot is much wider or closer. Fast cutters (a cut every 1-2 s) hard-cut every change. No split edit under the whip.
- Realtor and argument reels: a 0.1-0.2 s `dip_to_white` on the turns of the argument ("but", claim to proof), at most 3 per reel.
- Memes: a 0.2-0.4 s `dip_to_black` into and out of borrowed clips, 0.4-0.6 s between slow "ritual" steps, a 0.1-0.25 s black beat to reset each step of a rule of three. Hard cuts between the account's own shots.
- A reveal special (a new character) may glitch on every cut; ordinary episodes keep hard cuts.

## 11. What the studio's clients sent back (never again)

- A clipped word at a cut, even when the transcript of the whole cut reads fine. Every word must be heard whole: put every in and out point in a real gap.
- "More time between the transitions": a line starting under a transition, or right on its last frame. Leave 0.1-0.25 s after a transition before the first word, and 0.2-0.35 s after a line before a transition.
- A blank of a few frames after a cut or a transition ("make him talk directly after the chair transition"), and dead air before a line.
- A syllable heard twice across a cut (two takes overlapping: "Nor-Normally", "O-One").
- Punch-ins of 1.0 / 1.1 / 1.15 at cuts inside one take: they read as glitches. Keep the size or change it by 0.3 or more.
- A cut "not in the right time": usually a cut that comes before a movement or a look has finished, or a reaction held past its peak. Watch the frames around every cut.

## 12. Before you submit

- Every speech shot has `say`; no shot starts more than 0.5 s before its first word or ends more than 0.8 s after its last, unless that time is a labelled reaction, beat or action.
- No static framing over 6 s in a dialogue scene without a change (one-take formats, process proofs and lip-syncs excepted; put "pause" in their `purpose`, e.g. "one take, keep the pauses", so the trim pass leaves them whole).
- No size change of 0.08-0.2 at a cut inside one take.
- No cutaway over a punchline, a call to action or a sign-off.
- Reactions and performed pauses are labelled, so the trim pass keeps them.
- Music-only setups and memes have no `say` and are labelled `setup` with a purpose that says "silent".
