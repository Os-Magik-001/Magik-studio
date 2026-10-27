---
name: captions-and-text
description: Writing and timing captions, titles, premise lines and end cards
formats: all
style: dynamic
agents: editor, motion
---

**Captions**
- When there's speech, caption it throughout, because most social video is watched muted. Use `captions.mode: auto`: the engine places every kept word at its exact time. The rules below are for choosing `words_per_screen`, `case` and `position`, and for any manual captions.
- **Words per screen by format** (measured on the studio's references):
  - creator and realtor talking heads: 1-3 words (realtor style 1 word, changing about every 0.5 s), at chest height (55-75% of the height);
  - dialogue comedy (Cluely-style): 2-4 words, lowercase, small white, no box, at about 75-80% of the height;
  - series episodes (The Boyz): 3-6 words, sentence case, small white semibold, no box, at about 70%, built word by word;
  - no-dialogue meme skits: no captions; the premise line carries the text (see below);
  - 1:1 and 16:9: up to 6-8 words and about 42 characters.
- Captions are always one line on vertical video, about 22 characters at most. Split a long sentence into consecutive one-line captions, and divide its time between them by length.
- **Where to break:** at punctuation and natural phrase boundaries. Never split a number from its unit, or break inside a name. Merge one- or two-word leftovers into the neighbouring caption. Avoid a long caption followed by a tiny one.
- **Words:**
  - Captions show the words actually heard in the kept audio, never script words that weren't said, and never invented words.
  - Leave out "um" and "uh", but don't paraphrase. Keep a speaker's own grammar ("show me picture") when it is the character.
  - Transcripts mishear names and keywords, so fix them using the spellings in the script, brief and client name.
  - Check the final stretch especially: after silence or music, transcripts sometimes invent phrases like "thanks for watching" or "see you next time" (found over singing in the references).
  - Star swear words in skits and series ("f*ck", "sh*t"); write shouted lines in capitals.
- **Timing:**
  - Each caption appears with its first word and ends about 0.2s after its last.
  - Keep consecutive captions back to back, so text doesn't flicker off between lines.
  - Each caption stays up at least 0.4s (one-word captions change every 0.5 s in the realtor style).
  - Speed changes and transitions move speech on the finished timeline, so retime captions to match. On muted shots, captions only appear if there's a reason.
- **Punctuation:** no full stops or ellipses at the end of a caption, and no em dashes anywhere. Question and exclamation marks are fine. In series subtitles, a dialogue dash marks two speakers sharing a line.
- **Position:** `bottom` by default (the engine keeps it clear of the app's UI); `center` when the bottom holds hands, a product or text that's already in the shot. Never over a face.
- **Hide the caption while a title is showing the same words.**
- **Never end a caption on a small word** (de, le, la, les, un, une, du, à, au, ton, ta, tes, mon, ma, son, pour, avec, que, qui, et, en, je, tu, ce, sur, dans, par, pas, ne, plus, mais, si): move it to the next caption (« différentes / de le solutionner », not « différentes de le / solutionner »). Same in English for "the", "a", "of", "to", "and".
- Hide the captions while a title, a hero line, a counter or a strike-through says the same thing; bring them back on the next phrase.
- Fix what the transcript mishears in the client's own speech before captioning: names (« Sarah » → « Sara »), and Québec French it turns into nonsense (« Je tenais de » was « J'suis tannée de », « Je peux-tu » is « J'peux-tu »).

**Premise and POV lines** (skits and memes)
- The joke's premise is on screen from frame 0 (25 of 25 top meme reels, 8 of 8 top Cluely episodes): one `on_screen_text` line of 3-12 words, small white, no box, a light shadow, lowercase or sentence case, in the style of Instagram's own text tool. Quotes for a line said to the cast ("\"can i check your chat gpt\""), "POV: ..." for a situation, a colon for a template label ("What I actually do:").
- **Position:** 12-25% from the top over a wide; mid-frame (about 50%) over empty floor in a high-angle wide, or for a Cluely-style POV line; never over a face.
- **Lifetime:** in a meme, to the end, or swapped exactly on the payoff cut in the same place and style ("Startup during the day" → "vs. night"); in a dialogue skit, through the whole first shot or scene (about 5 s), off on the first new shot.

**Titles and hero words** (`style: title`, `hero`, `stacked`)
- Titles are for the hook, key numbers, contrasts, the main claim, section headers and the call to action. How many depends on the format: a calm ad picks the 5-8 moments that deserve one; a creator or realtor reel puts a hero word or title every 2-3 s; a dialogue skit has none beyond the POV line and name cards.
- A title or hero word appears on the onset of the word it lifts (within 0.1 s), or within 0.5 s of when its idea is first spoken, never before it's said.
- Keep a title to 6 words at most, one line, and concrete: name the product, number or benefit. No colon subtitles.
- Hold a 1-3 word hero word 0.8-1.5 s (a number in a countdown 0.5-1.0 s, a section-closing line up to 2.5 s); hold a longer title long enough to read twice, about 0.5 s plus 0.3 s per word.
- The premium look in the references mixes faces in one title: a small italic-serif or thin lead-in, a big accent word (bold caps, a serif or a coloured script word). Put 2-4 per reel `behind_subject` in the head band (20-31% of the height) when the head fills the upper frame.

- Titles and hero lines stay on one line (shrink the font to fit 950 px rather than wrap) and sit in the band above the speaker's head; a wrapped second line lands on the hair.
- Leave about 1 s with no new text before a new section's title.
- On silent footage, keep a title or caption up at least every 3-4 s, so muted viewers always have something to read. Leave the end card itself clean.

**Name cards**
- Dialogue comedy: a flat name card at each character's first confessional in the episode: bold white name over a small white role ("Ling Long / Systems Engineer"), no box, lower left at about 72-78% of the height, fading in 0.1-0.5 s after the cut and held 2-3 s (Cluely, 5 of 8). A `lower_third_3d` is the dynamic version; a series may use parody credits or a freeze-frame intro instead.

**End card**
- The headline is a specific call to action or payoff in 2 to 5 words: "Book your free tasting", not "Learn more". Use one call to action only.
- The call to action must never be the smallest or least visible text in the video.
- Hold the end card 2-3.5 s for ads, and 1.5-2 s for organic social. Creator reels, skits and memes mostly have none: they end on the last word or the payoff.
- Spell brand, product and people's names exactly as the brief and script do.
