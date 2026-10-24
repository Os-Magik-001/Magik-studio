---
name: trailer-and-montage
description: Cutting mostly visual footage (B-roll, events, parties, products, travel) into a promo, recap or trailer, with the cut grid chosen from the music
formats: social_short, ad
style: dynamic
agents: editor, sound
---

Use this when most of the footage has no talking, and the video is carried by pictures, music and titles. Measured on the event and nightlife promos of @j.k.hamington (founder of Platinum Game) and the food and event reels of @kapsalon.mtl, Oct 2026. A narrated food reel or visit is voice-led, not a montage: the pictures follow the voice (see social-short and `cutting`).

**Choose a spine**
- **Craft:** how something is made.
- **Transformation:** before and after (an outfit change, a room, a dish).
- **Spectacle:** the most striking images.
- **Mystery:** reveal something gradually.
- **Journey:** going from place to place (a POV arrival at a venue).
- **Event recap:** the night as it happened, from the name of the place to the crowd at its peak.

The spine sets the order, so never order shots by file name.

**Choose the cut grid from the music first** (one mode per section)
- **Bar mode**, for a clear 4/4 track and steady or pro footage: every segment lasts a whole number of bars (one bar is 4 beats: 2.0 s at 120 BPM, about 1.7-1.9 s at 128-140 BPM), and the hero shot gets 2 bars. Equal lengths are fine here when every cut changes subject and size. The best-cut gala recap holds one bar per shot, five in a row.
- **Free mode**, for phone footage: segments of 0.45-1.8 s (median 0.75-1.15 s), never three in a row within 0.1 s of each other, each cut on an action (a step, a turn, a look into the lens, the peak of a spin).
- **Never** hold shots for a fixed time with no musical value: 4 s stills over a 130 BPM track was the weakest recap measured.
- The engine has no beat snapping for cuts: plan segment lengths from the track's BPM in the library list, and let the sound designer line the track up with the cut.

**Put the single biggest change on a phrase onset** (within about 0.05 s): dark to bright, the hero shot, the reveal, the unmasking, on the first sound of a sung line, the drop or the song's hook word. When the music has an intro, the first full-frame shot starts on the drop. When a lyric matches a picture ("now I'm up" on the rooftop), put that picture there.

**Shape of a 30-45 s piece**

| Section | Shots | Length |
|---|---|---|
| Hook | 1-3, with the name of the place or event in the first 1.2 s | 2-4 s |
| Setup | 3-5 slower shots (1.6-3.5 s), people first | 7-10 s |
| Breath | one logo or title card | 1.9-2.0 s |
| Body | the grid (bar or free mode) | 10-14 s |
| Climax | a faster run of 1.0-1.2 s shots | 6-9 s |
| CTA / end | 1-3 cards of 2.0-3.0 s; the last one the flyer (date, time, venue) | 2.5-3.5 s |

For 15-25 s, drop most of the setup.

**Building an event recap**
- The name in the first 1.2 s: the venue's sign in the footage, or a 0.5-0.7 s logo.
- Alternate people with things and rooms, and change size on every cut (wide, medium, close): spectacle, crowd, details; or place, product, hero, details, brand, people.
- The host in the first 3 s and again in the last shot.
- The last footage shot is the longest of the montage (2.0-2.3 s).
- A 1 s gap in a voice-over is filled with a burst of three 0.4-0.6 s shots, or a held logo card.

**Food footage**
- Food clips start 0.1-0.3 s after a hand starts acting (pour, press, pull, tear, bite); a still plate gets a slow push {1.0, 1.10} with `focus` on the food.
- Several angles of one hero dish in a row are fine; alternate food with eaters' faces in a long list; true match cuts carry one action across two shots (the cheddar held up, then dropping on the patty).
- Shots shorten into the climax (1.7-2.5 s down to 0.7-1.0 s as the burger closes); a closing recap flurry of very short reused shots (0.13-0.57 s) is allowed once, at the end.

**Every cut changes something**
- Each cut changes at least one of: size, direction of motion, brightness, colour or subject. Never put near-identical shots side by side.
- Never use the same shot twice. Never put three or more shots of the same kind or size in a row.
- No single scene or angle should take more than about 40% of the runtime in a montage. (Transformation, outfit-change and single-action formats are the exception: there the fixed frame is the device.)
- Put high-motion shots on the peaks and calm shots in the valleys.
- Never cover a moment the viewer should see with a transition or flash.

**Cut on the footage's own cover and moves**
- When something fills 70% or more of the frame (a thrown jacket, people crossing the lens), end the outgoing shot on the frame of maximum cover and start the incoming one 0.1-0.2 s before its own cover clears.
- For a whip, end and start both shots inside the whip.
- A reveal by pan, tilt or pull-back is never cut: keep the whole move (1.5-3.4 s).
- A single complete action that pays off at its end (a play, a mask going on) may run up to 11 s when the hook text has told the viewer what to wait for; end it with a hard cut exactly on the payoff, to a 0.5-0.6 s black card or a 2.5-3 s reaction.

**List and transformation formats** (one locked-off set-up)
- One shot per item (5.3-6.0 s), cut on a cover action; one `on_screen_text` per item typed on 0.25-0.4 s after the cut and complete by 1.5-2.5 s; the last item is the payoff and holds 6-7 s. Write the text as a joke with a payoff, not plain labels (the joke version got almost twice the plays of the label version of the same cut).

**Speed**
- Leave `speed` at 1.0 for event footage (19 of 20 measured promos never change it). Use slow motion only for one hero moment on 50 fps or faster footage.

**Transitions**
- Hard cuts inside every section. At most one designed transition per section change, at most 3 per video: `zoom_in` 0.3-0.4 s from the hook into the body and into the end card; `glitch` 0.3-0.5 s on a logo or brand reveal.
- Short `dip_to_black` blinks of 0.1-0.3 s between POV arrival moments in a journey opening; 1.0 s of black before a trailer's title card; a cut to black with the CTA typed on 0.3 s later.
- A `crossfade` of 0.5-0.6 s only into the last footage shot or out of a logo card.
- A very short `dip_to_black` (0.1 s) just before the biggest hit makes it land harder; a `dip_to_white` flash (0.1 s or less) works only on true peaks.
- Never start on black for more than 0.1 s.

**Text**
- No captions in a pure montage. A hook `on_screen_text` from 0.0 s: 3-8 words, a scarcity or call-out line plus the event name ("A FEW SPOTS LEFT FOR / WORLD CUP / Final"), removed 0.3-0.6 s after the first cut. Then no text until the CTA, except a small persistent series tag (about 30% of the width) when the brand uses one.
- With a voice-over, put each key phrase on screen as it is said, 1-4 words per card, built word by word.

**Spoken lines and voice-over in a montage**
- Keep 1-4 short lines (1-3 s each) per 40 s, with their sound. A line earns its place only if it creates mystery, states the stakes, makes someone human, or sets up the climax.
- On-camera: a line right before a music hit ends 0.2-0.6 s before the cut.
- Voice-over: at each section point, start the new shot 0.0-0.15 s before the first sound of the phrase; inside a continuous read, B-roll of 0.9-1.9 s may change between or inside words.

**Self-check**
- **If it feels chaotic:** remove 20-30% of the shots, group shots by visual logic, and add a held shot before the climax.
- **If it feels slow:** shorten the setup; check that no still or take is held 4 s or more without a reason.
- **Shot lengths:** no shot under 0.4 s (0.45 s in party footage), and no shot over 6 s except the final hold or a single action that pays off.
