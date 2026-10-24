---
name: creator-reels
description: High-retention creator-style Instagram reels (talking head, multi-speaker, walk-and-talk, realtor-style multi-room talking head, process proof), measured frame by frame on the studio's creator references (Oct 2026)
formats: social_short, ad
style: dynamic
agents: editor, sound
---

Use this when the brief or the editor's notes ask for a "creator reel", a "reel like [creator]", or name one of the recipes below. Also use it when the footage is a person talking to camera for organic social and the brief wants energy. It overrides the calmer defaults in edit-styles (use the Punchy profile) and the caption word counts in captions-and-text. The `cutting` skill has the cut mechanics behind these numbers.

**What these reels share** (measured on 9 creator references, 0.03-2 M plays)
- **The voice is one tight stream.** Speech fills 92-97% of the runtime at 200-240 words per minute; pauses inside a shot are 0.12-0.25 s and never over about 0.3 s. Speech starts within 0.25 s of frame 0.
- **The picture cuts between two words, not in pauses.** It changes one word into a new sentence ("And | I know nothing") or about 0.1 s before the key word, so the new shot arrives with it ("from | GTA?"). When a cut sits in a gap, the gap is 0.1-0.42 s (median 0.26 s).
- **Something changes about every second:** a cut, a size change, a new caption (17-20 text changes per 10 s), a hero word or a card.
- **The hook calls out the viewer or makes a claim against what they believe, in the first 2 s,** with text on screen from frame 0: "Realtor from GTA?", "I didn't edit a single second of this video", "Before you hire a realtor, don't just take their word for it".
- **Show what you say, on the word:** cards and graphics over the speaker arrive within 0.1-0.3 s of the word that names them (one every 2-5 s). Full-screen B-roll is rare; proof is shown with cards and screens.
- **A self-referential proof line near the end** ("the reel you're watching now was edited by...") in 3 of 7. Keep it if it's in the footage.
- **The call to action is a comment keyword or "link in my bio"**, on screen the moment it's said and held to the last frame.
- **The reel ends 0.0-0.36 s after the last word** (the engine's 0.2 s out point), so the loop restarts cleanly. No end card unless the brand kit or the notes want one.

**Cutting**
- **Set-up changes:** footage from several locations, outfits, angles or speakers changes set-up every 4-8 s (walk-and-talk 2.5-4.5 s; 5.5-7 s per speaker in a multi-speaker reel). Never put two takes from the same set-up and framing back to back.
- **Whips on set-up changes:** in the slower creator reels 13 of 16 set-up changes are 0.2-0.5 s whip or zoom blurs. Give them `transition_in: slide_left` 0.3 s, or `zoom_in` 0.3 s when the new shot is much wider or closer, with a soft `whoosh`. In a reel that cuts every 1-2 s, hard-cut the set-up changes instead. Inside a set-up, always `cut`.
- **Where the change goes:** start the next segment's `say` on the first or second word of a new sentence, or on the word that names what the new shot shows. Under a whip, the outgoing speaker's last word may run under the blur.
- **Inside one set-up:** one segment per 1.2-2.5 s. Split at every list item ("three things": one cut per thing) and between every question and its answer; give the answer, and a one-word aside ("Fine.", "Cool."), the tighter size.
- **Sizes:** on a full-body or wide source alternate `zoom` 1.0 and 1.3 (`focus` on the face); on a chest-up source 1.0 and at least 1.3. Never a change of 0.08-0.2 at a cut inside one take. A same-size jump only when a `card`, a hero title or a 0.05 s `dip_to_white` starts on the same frame.
- **Pauses:** cut every pause over 0.3 s inside a shot. One deliberate 0.6-0.9 s beat is allowed right after a claim, while a proof card lands.
- **Multi-speaker:** no gap at a speaker change under a whip (0.0-0.15 s); open each speaker's segment 0.5-0.9 s before her key word or number, so that word can get a hero title.
- **"Watch" / "Watch this"** is the hinge into the demo: start the demo or proof set-up on that word.

**Text, mapped to our tools**
- **Captions:** `captions.mode: auto`, preset `bold_pop` (or `editorial` for premium brands), 1-3 words per screen (`words_per_screen` 2; 1 for the realtor style), `lower`, at 55-75% of the height (`center`), one accent word per line in `highlight_words`. The engine times every word; leave out nothing that's kept.
- **Hero words:** lift the key word of a line (a number, a promise, a payoff) into a `hero` of 1-3 words, `pop`, starting on the word's onset and held 0.8-1.5 s (numbers 0.5-1.0 s, a section-closing line up to 2.5 s), about one every 2-3 s. Put 2-4 per reel `behind_subject` when the speaker's head fills the upper frame. Use an `accent` word in italic serif on the hook and the proof line ("Claude *did.*").
- **Countdown device:** when the script lists items or several speakers each add one ("FIVE of us... FOUR states... THREE hours..."), each number is a hero title of 0.5-1.0 s.
- **Mood changes happen on the word that names them** ("the colours go dark"): split the segment at that word and give the second part the new `adjust`.
- **The CTA keyword:** a `boxed` title or a `comment_cta` with the keyword, up from the moment it is said to the last frame. Making the keyword the biggest word is a good choice, not a rule (1 of 4 references does it).

**Grade by section**
- One base look: `natural` for talking heads, `warm` for lifestyle, `punchy` for outdoor promos with blue skies.
- **"Moody":** brightness -0.08, contrast 1.15, saturation 0.75. **"Aesthetic" or "warm":** brightness +0.03, contrast 0.95, saturation 1.1. **"Clean" or "bright":** brightness +0.06, contrast 1.05.
- Keep faces natural (see talking-head).

**Recipes**
1. **Talking-head creator reel** (25-55 s; one person, several set-ups): hook claim plus title, 0-3 s; a point every 2-4 s, each with a hero title or a card on its word; a new set-up every 4-8 s with a whip; the proof line; the CTA title held to the end; no end card.
2. **Multi-speaker countdown** (30-40 s; 3-5 people filmed separately): one speaker per 5.5-7 s in the order that builds the countdown; a whip between speakers with the voices butting up (0.0-0.15 s); each number a hero title; the last speaker delivers the CTA, held about 1.5-2 s; warm, soft look.
3. **Walk-and-talk promo** (12-20 s; one presenter, several outdoor locations): a new location every 2.5-4.5 s; wide and medium-close alternating; a 1-2 frame `dip_to_white` flash on the hook's first cut; a hero title per sentence; `punchy` look; ends on the CTA, no end card.
4. **Fast single-set-up reel** (the hard-cut variant, about 45 s): a cut every 1.2-1.6 s inside one set-up by alternating 1.0 and 1.3, hard cuts on the rare set-up changes, one-word captions in gold italic accents, cards on every claim.
5. **Realtor-style multi-room talking head** (40-50 s; the style behind the studio's approved Prospera edits):
   - Cuts only at sentence ends, 0.1-0.15 s after the last word (a 0.12 s tail on cuts between rooms) and about 0.1 s before the next; never a jump cut inside a sentence.
   - A new room every 5-7 s, with a size change at each (`zoom` 1.0 against 1.3-1.5).
   - One emphasis zoom per 10-15 s on the key line or number: three contiguous segments of the same take, `zoom` {1.0 → 1.6} over the 0.3-0.5 s that end on the word, {1.6 → 1.6} for 1-2 s, {1.6 → 1.0} over 0.5-0.7 s.
   - `cut` everywhere, plus a `dip_to_white` of 0.15-0.2 s on up to 3 turns of the argument ("but", claim to proof) and into and out of a photo insert.
   - No B-roll: everything she names becomes a graphic on the word (logos as pills or cards, a stat as a big `hero` number held 2-3 s or a `counter`, qualities as dark gold-edged pills 0.5 s apart). Titles every 2.5-3 s: a small italic-serif lead-in plus a big accent word, 2-3 of them `behind_subject` in the head band (20-31% of the height).
   - Captions 1 word per screen at chest height. End 0.15-0.6 s after the last word, no end card; the CTA is a small pill or spoken.
6. **Process proof** (15-25 s; one continuous shot of a screen or a making-of): one segment with its in point on the first action and its out point after the shown result ends; `zoom` 1.0; one `top` caption for the whole reel (about 9% from the top) with a short reaction line from the brief. No other text, no end card.

**Graphics, overlays and sound** (see graphics-and-sound)
- **Show what you say** with cards on the word; use `cutaway` overlays only for a real demo or screen (proof screens may hold 3-3.5 s).
- **Proof numbers** get a `counter`: raw length against final length, views, a percentage.
- **Sound:** a music bed at `medium` under talking (it dips under speech by itself; `low` disappears under the voice): upbeat or hip-hop for energy, chill for lifestyle; in the references a bed sits 4-7 dB under the voice when there is one. A soft effect on every graphic that appears (a `pop` on hero words and cards, a `whoosh` on whips and titles), and a `hit` on the hook payoff and the proof line.

**Flag what we can't make yet** (in `open_questions`, briefly)
- A motion-blurred whip (the closest is `slide_left` or `zoom_in`).
- Subject cut-outs: the speaker on a solid colour with type behind him.
- Animated UI mock-ups (typing prompt bars, timelines, DM and comment bubbles), a wall of reels around the speaker, a picture-in-picture of the reel itself, 3D scenes and logo stings.
- Footage that was never filmed.

Deliver the closest version with real footage and the tools above, and name what's missing.
