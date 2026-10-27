---
name: picking-takes
description: Choosing the best take of each line and trimming speech cleanly
formats: all
---

**Rebuild the script from the takes**
- People repeat a line until it lands. A whole-line retake can come 5–60s after the first attempt.
- Transcript lines carry take notes (`[take 2 of 3 of this line; the last take is ...]`, `[director cue]`, `[not in the script]`). Use them; check against the script's lines when they look wrong.
- Drop slate talk ("okay, again", "take two", "let me redo that") and abandoned starts.
- Use the **last complete, clean take** of each line: no stumble, no restart, no trailing off.
  - Choose an earlier take when it's clearly better, or when the later one lost a lead-in or context the earlier one had.
  - Follow the editor's notes when they point to a take.
- If several sentences were said in one fluent run, keep them as one shot. One clean run beats four best-of picks stitched together.
- Never splice half a sentence from one take onto half from another (a sentence deliberately bridged between a scene and a confessional is the exception: split it at a comma or before the key noun).
- If two takes each hold a different piece of information, you can keep a part of each.

**Distrust suspicious transcript lines**
- A transcript line with few words over a long time (under about 1.6–2 words per second) usually hides a pause, a false start or a retake inside it. Don't trust its timing.
- A line that seems said twice may have been merged into one by the transcriber. Check whether its length makes sense.
- Word times can be off by a few tenths of a second, most often on the first word after a pause. The engine's own word timing from `say` and its trim pass are measured on the audio; trust them over arithmetic on transcript times.

**Pad around speech**
- Copy the exact words of each speech shot into `say`. The engine sets the in and out points from the words' measured timing (about 0.12s before the first word, 0.2s after the last), which is more precise than any time you could write.
- A clipped first or last syllable is the most noticeable mistake in a speech edit; the studio's clients send cuts back for it. A "t", "k" or "p" release belongs to the word before it.
- No shot of speech shorter than 0.35s unless it's a needed connecting word.
- Never let two takes overlap at a cut, so no syllable is heard twice ("Nor-Normally").

**Pauses and fillers**
- Compress pauses rather than removing them. What to keep between phrases depends on the format (measured on the studio's references): 0.15-0.45 s in dialogue comedy and series (Cluely's median 0.23 s, The Boyz 0.25-0.45 s); 0.12-0.25 s in creator and realtor talking heads, where nothing over about 0.3 s is left inside a shot. Speech with no gaps at all sounds frantic.
- Long empty pauses (over about 0.75 s) shrink to that gap.
- **A performed pause is not an empty pause:** the beat before a punchline (0.8-1.6 s in top comedy), a shrug, a stare, a gesture between two orders. Keep it and protect it (see `cutting`: label the shot `punchline` or `reaction`, or write "beat" in its purpose).
- Never cut out laughter, a gasp or a one-word punchline. Mark punchlines `beat: punchline`, so their beat before and after is kept.
- Cut filler where the line allows: um, uh, "like", "you know", "I mean", "basically", and weak openers such as "so", "okay so" and "anyway".
  - Keep a single filler when it's the only bridge between thoughts, or carries the speaker's warmth.
- Always keep negations, numbers, names and deliberate repetition, even when tightening hard.

**Scripted sessions with many takes** (a client reading a script, a director calling « parfait »: OzonePlus, October 2026, up to 30 takes of one line)
- The take the director approves is followed by « parfait » (or « ok, next »): prefer it; otherwise the last complete take.
- A whole session's transcript blurs repeated takes together: a line's first word can sit seconds before the rest (it belongs to an earlier attempt), a burst of a line squeezed into a few hundredths of a second is not a take, and asides (« Ah, t'as vraiment chaud », « Ah, merde ») hide inside long stretches the transcriber smoothed over.
- So hear each chosen take again: transcribe each take on its own (a 2 s window around it, all windows in one run), find the line's words there (the best complete match; if the line is said twice, the later one), and cut just before the first word and after the last, on the quiet. Then lay all the lines end to end and transcribe that once more: in context the transcriber hears asides and repeats it skipped on a take alone; move an edge only when a pause separates the extra words from the line.
- When a take still won't separate (a false start and the clean line in one breath), set its edges by ear (speech onsets measured on the audio) rather than trusting the transcript.
- A slip in the middle of an otherwise good take (« ...n'est pas nécessairement... Ah, merde ! L'endroit d'où provient le problème ») can be cut out, with the take continuing on the other camera across the cut; lift the quieter half to match.
- Then read the transcript of the finished voice track against the script before rendering: it is the only check that catches a line said twice, a missing first word or an aside left in.

**Two cameras**
- Line the second camera up by its sound (cross-correlation of the two tracks, then the waveform around the peak; check the offset at three points along the take: within a few milliseconds). The sound always comes from the main camera's take (the lav), whatever camera is on screen.
- Switch camera on every line and at the joins inside a split take; never the same framing on the same camera twice in a row. A camera that stopped recording early cannot cover the end of the session: check its coverage before choosing it.

**Flag what you couldn't fix**
- If no clean take of a line exists, use the best one and say which line in `open_questions`.
