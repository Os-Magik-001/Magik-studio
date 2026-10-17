---
name: creator-reels
description: High-retention creator-style Instagram reels (talking head, multi-speaker, walk-and-talk, process proof), from six analysed top-performing reels
formats: social_short, ad
---

Use this when the brief or the editor's notes ask for a "creator reel", a "reel like [creator]", or name one of the recipes below. Also use it when the footage is a person talking to camera for organic social and the brief wants energy. It overrides the calmer defaults in edit-styles (use the Punchy profile) and the caption word counts in captions-and-text.

**What these reels share** (measured on six reels with 0.5k to 58k likes)
- **Something visible changes every 1 to 1.5s:** a cut, a punch-in, a new caption or a title. Hard cuts alone are rare: 2–6 per 45s. The rhythm comes from text changes and framing changes.
- **No dead air:** pauses over about 0.25s are gone, and speakers land at 200–240 words per minute. Keep the 0.1–0.15s gap between phrases from picking-takes, so speech still sounds natural.
- **The hook calls out the viewer or makes a bold claim in the first 2s,** with a title on screen from frame 0: "Realtor from GTA?", "I didn't edit a single second of this video."
- **Show what you say:**
  - When a line names something (a place, a product, a result, a change), cut to the shot that shows it at that moment.
  - When the speaker describes a change ("the colors go dark"), make it happen on screen as they say it.
- **A self-referential proof line near the end:** "the reel you're watching now was edited by…". Keep it if it's in the footage.
- **The call to action is a comment keyword:** "Comment MIAMI", "Comment DEMO". It goes on screen as a title the moment it's said and stays to the end. Make the keyword the biggest word in the title.
- **End card:** usually none. End on the speaker within 0.5–1s of the last word, so the loop restarts cleanly. Set `end_card.include` to false, unless the brand kit or the editor's notes want a card. If they do, use the comment keyword as its headline.

**Text, mapped to our tools**
- **Captions:** `captions.mode: auto`, preset `bold_pop` (or `editorial` for premium brands), 2–3 words per screen, `lower`, `center` (chest height), keywords in `highlight_words`. The engine times every word; leave out nothing that's kept.
- **Hero words:** each 2–4s, lift the key word of the line (a number, a promise, a payoff) into a `hero` of 1–3 words, `pop` in.
  - Show it as the word is spoken, and hold it 1.5–2.5s. Use one at a time; the matching caption hides itself.
  - Put 2–4 of them `behind_subject` when the speaker's head fills the upper frame: the signature look of these reels.
  - Use an `accent` word in italic serif on the hook and the proof line ("Claude *did.*").
- **Countdown device:** when the script lists items or several speakers each add one ("FIVE of us… FOUR states… THREE hours… TWO things… ONE night"), make each number a hero title. The countdown pulls viewers to the end.
- **Asides** ("no, seriously", "not techy? cool") get a caption of their own, so the joke lands on its own beat.

**Shots and framing**
- **Hide cut-out takes by changing setup:** footage from several locations, outfits or angles gets intercut so the location changes every 4–8s. Never put two takes from the same setup and framing back to back.
- **Within one setup,** alternate wide (zoom 1.0) and close (1.2–1.3, or up to about 1.8 if the clip's sharp-zoom limit allows) on every cut. Set `focus` on the face.
- **Natural pushes:** when the speaker walks toward the camera or reaches toward the lens, add a push from 1.0 to 1.25–1.4 over that shot.
- **Transitions:** hard cuts inside a setup. Between setups, mostly hard cuts, plus at most 2 `slide_left` (0.25s) or `zoom_in` (0.3s) whips on the biggest changes. Use a `dip_to_white` flash (0.1s) only on the hook's first beat.
- **Raw-footage or process montages** ("I drop in the raw footage", "while you sleep"): speed 2–3x with sound muted, plus a title naming it ("RAW TAKE 1:16"). Hold 2–4s.

**Grade by section**
- Pick one base look: `natural` for talking heads, `warm` for lifestyle, `punchy` for outdoor promos with blue skies.
- When a line asks for a mood change, apply it with `adjust` on the shots after that line:
  - **"Moody":** brightness -0.08, contrast 1.15, saturation 0.75.
  - **"Aesthetic" or "warm":** brightness +0.03, contrast 0.95, saturation 1.1.
  - **"Clean" or "bright":** brightness +0.06, contrast 1.05.
- Keep faces natural (see talking-head).

**Recipes**
1. **Talking-head creator reel** (25–55s; one person, several setups)
   - Hook claim plus title, 0–3s.
   - A feature or point every 2–4s, each with a hero title, with setup changes every 4–8s.
   - The proof line.
   - "Comment KEYWORD" title held to the end, with no end card.
2. **Multi-speaker countdown** (30–40s; 3–5 people filmed separately)
   - One speaker per 5–7s, in the order that builds the countdown.
   - Each speaker's number as a hero title.
   - Hard cuts or one whip between speakers.
   - The last speaker delivers the call to action, held about 2s.
   - Warm, soft look.
3. **Walk-and-talk promo** (12–20s; one presenter, gimbal, several outdoor locations)
   - A new location every 2.5–4.5s.
   - Alternate wide and medium-close shots, with a `dip_to_white` flash into the second shot.
   - Fast voice, with a hero title per sentence.
   - `punchy` look.
   - Ends on the call to action with no end card.
4. **Process proof** (15–25s; one continuous shot of a screen or a making-of)
   - Keep the take whole, or trim only its ends.
   - One `top` caption for the whole video: a short reaction line, for example "Claude ate with this one", from the brief.
   - No other text, and no end card.

**Graphics, overlays and sound** (see graphics-and-sound)
- **Show what you say** with `cutaway` overlays: the B-roll plays while the voice continues. Use `card` overlays for proof, such as screenshots, earlier reels or results, tilted a few degrees above or beside the head.
- **Call to action:** a `comment_cta` bubble with the keyword, plus a `boxed` title, held to the end. Add a `follow_pill` in the last 2s for organic reels.
- **Proof numbers** get a `counter`: raw length against final length, views.
- **Sound:** a music bed at `low` under talking (upbeat or hip-hop for energy, chill for lifestyle). Add a `whoosh` on whips, a `pop` on hero words, and a `hit` on the hook payoff and the proof line.

**Flag what we can't make yet** (in `open_questions`, briefly)
- Fully animated graphics: logo stings, 3D scenes, animated app mock-ups.
- Footage that was never filmed.

Deliver the closest version with real footage and the tools above, and name what's missing.
