---
name: clean-comedy-edit
description: Clean, effect-free comedy editing like Cluely and The Marketing Interns: performance, timing and cuts only
formats: all
style: clean
---

This client uses the **clean** editing style. The edit is invisible: no motion graphics, no freeze frames, no stickers, no sound effects, no flashy transitions, no highlighted words. Everything rests on choosing the best performance and cutting it with the right timing, the way Cluely's and The Marketing Interns' skits are edited (measured: 0.26 cuts per second, median shot 3.1 s, speech 83% of the time, about 200 words per minute, 71% original audio only).

<how_the_engine_helps>
You choose; the engine times. Knowing what it does keeps you from fighting it:
- **Words, not seconds.** For every shot with speech, copy the exact words you keep into `say`. The engine finds them in the transcript and sets the in and out points from their measured timing (about 0.12 s before the first word, 0.2 s after the last). Your `start` and `end` only need to be close. Two takes of the same words are told apart by where you put `start`.
- **Takes are pre-sorted.** Transcript lines carry notes: `[take 2 of 3 of this line; the last take is C9 34.9s]`, `[director cue: never keep]`, `[not in the script: likely crew talk or coaching]`. Speakers usually nail a line on the final attempt, so the last take is the default.
- **Split edits are automatic.** On cuts between different shots, the picture moves a few frames off the sound: an L-cut onto a reaction (the listener appears 6 frames before the line ends) and a J-cut into a new speaker (heard 4 frames before seen). Never inside one take, never off a punchline. Don't time the overlap yourself.
- **Beats drive the trim.** Each shot's `beat` (setup, punchline, reaction, other) changes how it is trimmed: see the timing rules.
</how_the_engine_helps>

<rules>
1. **Pick the best take of every line.** Use the take notes, the contact sheets and the transcript. Keep the take where the delivery is most natural, the timing funniest and the face reads; otherwise the last complete one. One take per line, whole sentences from one take, never a flub, a laugh that breaks character, a slate ("go", "3, 2, 1") or the director talking. A viewer who hears a line twice or hears crew talk stops believing the scene.

2. **Natural timing, not maximum tightness.** Measured across 30 sitcoms, the median gap between two lines is 275 ms (Brooklyn Nine-Nine) to 540 ms (The Office), and about 700 ms when the speaker change falls on a cut. Under about 200 ms, lines step on each other and the edit feels rushed and robotic.
   - Same shot: 0.25 to 0.45 s between lines. Speaker change on a cut: about 0.5 to 0.7 s of combined air.
   - Remove fillers, stutters, retakes and gaps over about 0.9 s, not the breathing between lines. "The only reason to pause is when the joke demands the pause."

3. **Label every shot's beat**, because the comedy lives in a few frames ("two frames can make the difference between funny and not funny"):
   - `punchline`: the line that lands the joke. The engine keeps up to 0.45 s of beat before it and 0.3 s after it, and the picture never leaves the speaker before the last syllable. Put the funniest word at the end of the shot.
   - `reaction`: a face reacting. Never trimmed. Hold it until the reaction peaks and starts to fade, usually 0.6 to 1.2 s: with no laugh track, it stands in for the laugh.
   - `setup`: compress freely; jump cuts are fine here, never in the payoff.

4. **Cut to the listener for the funny part.** When someone says something absurd, the next shot is the face hearing it. In confessionals, the next shot contradicts or confirms the claim, hard cut on the last word. Three reaction shots in a string feel right; four is too many.

5. **Coverage from one camera.** If a scene was filmed in one wide shot, alternate the wide (zoom 1.0) with a tighter framing (zoom 1.2 to 1.35, focus on the speaker's face) when the speaker changes or on a punchline, so each cut has a reason. Static framing only: zoom start and end equal. Comedy often plays best in the wide, where body language reads.

6. **Hard cuts only.** Transition `cut` everywhere. When in doubt about a frame, cut long rather than short.

7. **Structure.** Open on the strongest line or the conflict within the first second: no establishing shot, no slow start. If the footage has the series intro clip, it may follow the cold open, trimmed to 2 to 3 s. End on the biggest laugh (the button) and cut right after it: no outro. As short as the story allows; drop any line that doesn't serve the joke or the character.

8. **Text.** Subtitles only. If the dialogue isn't in English, use translate mode with natural English subtitles; otherwise auto captions. Preset `subtitle`, size `small`, position `bottom`, white, 6 to 8 words per screen, sentence case, no highlight words. Keep the French or franglais flavour and star swear words ("f*ck"). Fix misheard names from the script's spellings. No titles, labels, stickers, emojis or name cards, except the series' episode label if the notes ask for it.

9. **Sound and look.** Original dialogue at full level. Music only under the series intro clip, as a music section that ends when the first line after it starts. No sound effects. Look `natural`; fix only exposure problems (brightness up to +0.08 on dark shots).
</rules>

<examples>
<example>
Transcript excerpt:
C4 4.4–6.2: L'équipe, c'est une idée de malade. [take 1 of 2 of this line; the last take is C5 0.3s]
C4 8.9–10.4: Racine, tu peux le faire ? [take 1 of 2 of this line; the last take is C5 5.7s]
C5 0.3–2.1: L'équipe, c'est une idée de malade. [take 2 of 2 of this line; the last take is C5 0.3s]
C5 3.6–5.4: Et vraiment, cette idée, elle dépend de Racine. [take 2 of 2 of this line; the last take is C5 3.6s]
C5 5.7–7.0: Racine, tu peux le faire ?
C6 0.0–0.4: Go ! [director cue: never keep]
C6 1.0–4.0: (Racine stares, no speech)

Good shots:
{clip: "C5", start: 0.2, end: 5.6, say: "L'équipe, c'est une idée de malade. Et vraiment, cette idée, elle dépend de Racine.", beat: "setup", zoom 1.0}
{clip: "C5", start: 5.6, end: 7.2, say: "Racine, tu peux le faire ?", beat: "setup", zoom 1.3}
{clip: "C6", start: 1.0, end: 2.0, say: "", beat: "reaction", zoom 1.25}

Why: the last takes, kept as one fluent run; the question gets a tighter framing so the cut has a reason; the slate is skipped and Racine's stare is the reaction, held about a second.
</example>

<example>
Transcript excerpt:
C8 1.4–7.0: Je vais construire et je construis et je vais construire un unicorn.
C8 8.1–9.6: A billion dollar company.
C8 10.3–11.2: Et on peut le faire.

Good shots:
{clip: "C8", start: 1.3, end: 7.2, say: "Je vais construire et je construis et je vais construire un unicorn.", beat: "setup", zoom 1.0}
{clip: "C8", start: 7.9, end: 9.9, say: "A billion dollar company.", beat: "punchline", zoom 1.3}

Why: the stumble-like repetition is the character, so it stays; the punchline gets the punch-in and keeps its beat before; "Et on peut le faire" deflates the joke after the button, so it goes.
</example>
</examples>
