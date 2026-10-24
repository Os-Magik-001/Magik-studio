---
name: clean-comedy-edit
description: Clean, effect-free comedy editing like Cluely and The Marketing Interns: performance, timing and cuts only
formats: all
style: clean
agents: editor, sound
---

This client uses the **clean** editing style. The edit is invisible: no motion graphics, no freeze frames, no stickers, no sound effects, no flashy transitions, no highlighted words. Everything rests on choosing the best performance and cutting it with the right timing, the way Cluely's skits are cut. Measured on the 23 most played Cluely episodes (4-21 M plays, Oct 2026): 0.36 cuts per second (median shot about 2.1 s), 135-224 words per minute, original audio only, hard cuts only, and more than half of the cuts inside continuous sound (jumps inside a running sentence, a voice over an insert, a speaker change with no air), not in pauses.

<how_the_engine_helps>
You choose; the engine times. Knowing what it does keeps you from fighting it:
- **Words, not seconds.** For every shot with speech, copy the exact words you keep into `say`. The engine finds them in the transcript and sets the in and out points from their measured timing (about 0.1 s before the first word and 0.2-0.35 s after the last, inside a real gap in the sound). Your `start` and `end` only need to be close. Two takes of the same words are told apart by where you put `start`.
- **Takes are pre-sorted.** Transcript lines carry notes: `[take 2 of 3 of this line; the last take is C9 34.9s]`, `[director cue: never keep]`, `[not in the script: likely crew talk or coaching]`. Speakers usually nail a line on the final attempt, so the last take is the default.
- **Split edits are automatic.** On cuts between different shots, the picture moves a few frames off the sound: an L-cut onto a reaction (the listener appears 6 frames before the line ends) and a J-cut into a new speaker (heard 4 frames before seen). That matches Cluely's in-scene speaker changes (measured ±0.13 s). Never inside one take, never off a punchline. Don't time the overlap yourself.
- **Beats drive the trim.** The trim pass cuts empty pauses over 0.75 s inside a shot, leaves `reaction` shots alone, in a `punchline` shot keeps only the pauses before its last three words, and leaves alone any shot whose `purpose` contains "beat", "pause", "deadpan" or "stare". Two shots joined by `say` keep about 0.3 s of air between them.
</how_the_engine_helps>

<rules>
1. **Pick the best take of every line.** Use the take notes, the contact sheets and the transcript. Keep the take where the delivery is most natural, the timing funniest and the face reads; otherwise the last complete one. One take per line, whole sentences from one take, never a flub, a laugh that breaks character, a slate ("go", "3, 2, 1") or the director talking. A viewer who hears a line twice or hears crew talk stops believing the scene.

2. **Natural timing, not maximum tightness.** Keep 0.15-0.4 s between lines on the same shot (Cluely's median 0.23 s). Quick exchanges run tighter than any pad allows (0.0-0.25 s): when two lines come from the same take, keep them in one segment so their timing survives. Slower scenes keep 0.5-0.7 s at a speaker change. Remove fillers, stutters, retakes and empty gaps over about 0.75-0.9 s, not the breathing between lines. "The only reason to pause is when the joke demands the pause."

3. **Label every shot's beat**, because the comedy lives in a few frames:
   - `punchline`: the line that lands the joke. 17 of the 23 best episodes keep a **0.8-1.6 s beat before it, up to 2.3 s** before a deadpan one-word reply ("No."), on a held face, a stare, an insert or B-roll. Setup lines are crushed; the punch word gets the beat. To keep that beat, put the setup's last phrase and the punchline in **one** segment labelled `punchline` and write "beat" in its purpose: the trim pass then leaves the segment as planned. Put the funniest word at the end of the shot. After it, 0.0-0.3 s, then cut away.
   - `reaction`: a face reacting, never trimmed. Hold a silent reaction **1.4-2.5 s** (median about 1.9 s): with no laugh track, it stands in for the laugh. A final or shock reaction may run 1.9-5.3 s.
   - `setup`: compress freely; jump cuts are fine here, never in the payoff.

4. **Cut to the listener for the funny part.** When someone says something absurd, the next shot is the face hearing it, cut on the punchline's last syllable. In confessionals, the next shot contradicts or confirms the claim: the contradicting picture arrives on the last word or 0.0-0.3 s before the key word. Three reaction shots in a string feel right; four is too many.

5. **Jump cuts and coverage from one camera.** In a rant or a list, jump at each sentence or item with the pause removed and the size kept (9 in 10 of Cluely's jumps change size by under 3%); give the topper its own jump. If a scene was filmed in one wide shot, cut to a tighter framing (static `zoom` 1.3-1.35, `focus` on the speaker's face; 1080p footage softens beyond that) when the speaker changes, and give the reaction hold a static 1.3. A punchline gets a new shot, not a zoom. Never a size change of 0.08-0.2 at a cut inside one take. Comedy often plays best in the wide, where body language reads.

6. **Hard cuts only.** Transition `cut` everywhere. When the footage has an in-camera whip or pan, cut inside it. When in doubt about a frame, cut long rather than short.

7. **Structure.** Open on the strongest line or the conflict within the first second: no establishing shot, no slow start. If the footage has the series intro clip, it may follow the cold open, trimmed to 2 to 3 s. Cap silent action: an entrance at most 1.5 s before the first word, empty air before a scene's first line at most 0.5 s. End on the biggest laugh (the button) and cut within 0.2 s of it (0.5-1.0 s after a confessional tag), or end on a silent 1.9-3.7 s reaction: no outro. As short as the story allows; drop any line that doesn't serve the joke or the character.

8. **Text.** Subtitles only (the clean style removes everything else). If the dialogue isn't in English, use translate mode with natural English subtitles; otherwise auto captions. Preset `subtitle`, size `small`, position `bottom`, white, 4-5 words per screen, as spoken, no highlight words. Keep the French or franglais flavour and the speaker's own grammar, and star swear words ("f*ck"). Fix misheard names from the script's spellings.

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
{clip: "C6", start: 1.0, end: 2.9, say: "", beat: "reaction", zoom 1.2}

Why: the last takes, kept as one fluent run; the question gets a tighter framing so the cut has a reason; the slate is skipped and Racine's stare is the reaction, held about 1.9 s, the length of a laugh.
</example>

<example>
Transcript excerpt:
C8 1.4–7.0: Je vais construire et je construis et je vais construire un unicorn.
C8 8.1–9.6: A billion dollar company.
C8 10.3–11.2: Et on peut le faire.

Good shots:
{clip: "C8", start: 1.3, end: 9.8, say: "Je vais construire et je construis et je vais construire un unicorn. A billion dollar company.", beat: "punchline", purpose: "the unicorn claim, 1.1 s beat before the payoff", zoom 1.0}

Why: the stumble-like repetition is the character, so it stays; setup and payoff stay in one punchline segment so the 1.1 s beat before "A billion dollar company" survives the trim; "Et on peut le faire" deflates the joke after the button, so it goes.
</example>
</examples>
