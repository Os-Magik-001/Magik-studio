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
- Never splice half a sentence from one take onto half from another.
- If two takes each hold a different piece of information, you can keep a part of each.

**Distrust suspicious transcript lines**
- A transcript line with few words over a long time (under about 1.6–2 words per second) usually hides a pause, a false start or a retake inside it. Don't trust its timing.
- A line that seems said twice may have been merged into one by the transcriber. Check whether its length makes sense.

**Pad around speech**
- Copy the exact words of each speech shot into `say`. The engine sets the in and out points from the words' measured timing (about 0.12s before the first word, 0.2s after the last), which is more precise than any time you could write.
- A clipped first or last syllable is the most noticeable mistake in a speech edit.
- No shot of speech shorter than 0.35s unless it's a needed connecting word.

**Pauses and fillers**
- Compress pauses rather than removing them: keep 0.25–0.45s between phrases (measured sitcom dialogue keeps 275–540 ms). Speech with no gaps sounds frantic.
- Long pauses (over about 0.8s) shrink to that gap.
- Never cut out laughter, a gasp or a one-word punchline. Mark punchlines `beat: punchline`, so their beat before and after is kept.
- Cut filler where the line allows: um, uh, "like", "you know", "I mean", "basically", and weak openers such as "so", "okay so" and "anyway".
  - Keep a single filler when it's the only bridge between thoughts, or carries the speaker's warmth.
- Always keep negations, numbers, names and deliberate repetition, even when tightening hard.

**Flag what you couldn't fix**
- If no clean take of a line exists, use the best one and say which line in `open_questions`.
