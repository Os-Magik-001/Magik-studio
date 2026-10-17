---
name: clean-comedy-edit
description: Clean, effect-free comedy editing like Cluely and The Marketing Interns: performance, timing and cuts only
formats: all
style: clean
---

This client uses the **clean** editing style. The edit is invisible: no motion graphics, no freeze frames, no stickers, no sound effects, no flashy transitions, no highlighted words. Everything rests on choosing the best performance and cutting it with perfect timing, the way Cluely's and The Marketing Interns' skits are edited (measured: 0.26 cuts per second, median shot 3.1 s, speech 83% of the time, 200 words per minute, 71% original audio only).

**What you do**
1. **Pick the best take of every line.** Watch all the takes in the contact sheets and transcripts.
   - Keep the take where the delivery is most natural and the timing funniest, and the face reads.
   - Never keep two takes of the same line, never keep a flub, a laugh that breaks character, a "go", a "3, 2, 1", or the director talking.
2. **Natural timing, not maximum tightness.** Measured across 30 sitcoms, the gap between two lines has a median of 275 ms (Brooklyn Nine-Nine) to 540 ms (The Office), about 700 ms when the line change falls on a cut; under about 200 ms lines step on each other and the edit feels rushed and robotic.
   - Same shot: leave 0.25 to 0.45 s between lines. A speaker change on a cut: about 0.5 to 0.7 s of combined air.
   - Cut out only long gaps (over about 0.9 s), fillers, stutters and retakes. "The only reason to pause is when the joke demands the pause."
   - The engine trims heads and tails to about 0.12 s before the first word and 0.2 s after the last, so place in and out points in the silence around the words.
3. **Label every shot's beat:** `setup`, `punchline`, `reaction` or `other`. The engine uses it:
   - **Punchline:** the picture never leaves the speaker before the last syllable, the beat before the punch is kept (up to 0.45 s), and 0.3 s of hold after it. "Two frames can make the difference between funny and not funny."
   - **Reaction:** never trimmed. Hold it until the reaction peaks and starts to fade, usually 0.6 to 1.2 s: it stands in for the laugh.
   - Compress setups freely (jump cuts are fine there), never the payoff.
4. **Split edits are automatic.** The engine offsets picture from sound on cuts between shots: an L-cut onto a reaction (the listener appears 6 frames before the line ends) and a J-cut into a new speaker (their voice starts 4 frames before we see them). So cut to a reaction or a listener by choosing their shot right after the line; don't try to time the overlap yourself.
5. **Cut to the listener for the funny part.** When someone says something absurd, cut to the face of the person hearing it for the last word or the beat after. In confessionals, the next shot contradicts or confirms the claim, hard cut on the last word.
6. **Coverage from one camera.** If a scene was filmed in one wide shot, alternate the wide (zoom 1.0) with a tighter framing (zoom 1.2 to 1.35, focus on the speaker's face) when the speaker changes or on a punchline. Static framing only: zoom start and end equal. No pushes, no shakes.
7. **Hard cuts only.** Transition `cut` everywhere. When in doubt about a frame, cut long rather than short.
8. **Structure.**
   - Open on the strongest line or the conflict in the first second: no establishing shots, no slow start.
   - If the footage has the series intro clip, it may follow the cold open, trimmed to its shortest version (2 to 3 s).
   - End on the laugh: the punchline or the last reaction, then cut. No outro.
9. **Length:** as short as the story allows. Cut any line that doesn't serve the joke or the character.

**Text**
- Subtitles only. If the dialogue isn't in English, use translate mode with natural English subtitles; otherwise auto captions.
  - Preset `subtitle`, size `small`, position `bottom`, white, 6 to 8 words per screen, sentence case, no highlight words.
  - Keep French or franglais flavour in the translation, and star swear words ("f*ck").
- No titles, labels, stickers, emojis or name cards. The only exception is the episode label the series uses, if the notes ask for it.

**Sound**
- Original dialogue only, at full level.
- Music only under the series intro clip, if there is one, as a music section that ends when the first line after it starts. No music under dialogue.
- No sound effects.

**Look**
- `natural`. Fix only exposure problems (brightness up to +0.08 on dark shots).
