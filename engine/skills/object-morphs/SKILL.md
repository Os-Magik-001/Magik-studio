---
name: object-morphs
description: Designed graphics where one object turns into another on the word (bars into a line, a tile into a big card, a pill into a player, dots into a logo), with the ghost, stagger and live hold that make them look made by a motion designer
formats: social_short, ad
agents: motion
---

# Object morphs

Distilled from Charlie Hills' motion-effects recipes (MIT, October 2026) and rewritten for reels. His effects are 8-second loops for posts; in a reel only the move plays (1.0–1.5 s, on the word that names the thing) and the end state holds under the voice. Frames (f) are at 30 fps.

**The principle**
- A premium graphic is one object changing shape. A crossfade from one picture to another reads as a slideshow.
- Shared elements travel and are never duplicated: a title moves from the card into the window's title bar; a play icon travels to the centre and morphs into pause.
- The shell moves first. Its old contents leave in the first quarter of the move; the new contents wait until the shell is past halfway and fade in over the second half, so nothing is squashed.
- A ghost of the start state (a dashed outline at 20–30% opacity) stays where the object began, so the eye follows the change.
- Parts start a beat apart (rows, letters, dots 2–4 f apart), never all together: everything moving at once reads as a slide transition.
- Width and height spring on their own curves (open soft, close with no overshoot). Work every value out from the whole timeline, not per scene: an object that reopens before it has closed carries on from where it is instead of jumping.
- The hold stays alive with one small thing (a progress bar creeping, a count ticking, a second pulse), and only one focus.
- Values never change between states: the same six numbers are bars, then a line. The viewer trusts it.

**Recipes**
- **Chart morph** (results, before/after): bars slim to hairlines left to right 3 f apart, then the line draws through their tops (drawn, never faded in), a dot appearing as the line reaches each point, the last point in the accent with its value tag. 1.2–1.5 s.
- **KPI lift**: four accent corner brackets snap around one tile (6 f), the rest dims to about 35%, then the tile grows from its exact position and size into a big card, dashed guides joining old and new corners; the number counts up inside.
- **Pill → player / card → window** (apps and websites, on the phone_3d or browser_3d stage): the button's own shell stretches into the player or editor; the label travels into its new place.
- **Tab pill**: the leading edge moves first and the trailing edge a beat later, so the pill stretches, then shortens as it lands. Each label brightens by how much of the pill covers it, never flipping.
- **Card fan** (three offers, three testimonials): cards fan out on springs with different damping, back card heaviest. The top card swings past its angle once (6° at most) and settles within 0.5 s; never a second wobble.
- **Masked type**: footage or artwork rises inside the letters of a big outlined word over 1.2–1.4 s, a thin accent line marking the rising edge. The second line rises from behind a hard mask edge, never fades. Footage inside letters needs letters at least 35% of the frame tall, weight 800 or more, at most 6 characters a line, and slow high-contrast footage, or the word disappears.
- **Merge**: two pills or drops joining into one through a signed-distance smooth union, antialiased with fwidth so the edges stay crisp. Never as blob wallpaper.
- **Stretch type**: letters change width as well as height on a locked baseline, the middle letter peaking first, the rest falling away evenly on each side (a variable font's width axis, or each letter scaled in x and y).
- **Headline → page**: the headline splits into two halves that travel to their places and grow as they go (never retyped); then the kicker, an image wiping open, the body lines and a quote card arrive in reading order.
- **Depth layers** (the layers of a treatment, a service, a method): a flat stack separates in a real three.js camera along one vanishing point, back layer first, each layer keeping real content; in the hold the camera drifts slightly so the stack breathes. Layers built in code only: a client's real screenshot is never tilted (3d-scene-craft).
- **Lens focus** (one line of a price list or menu): a frosted lens slides over a softly blurred list. Only the text inside it is sharp, at 1.1×, with two faint tinted copies a fraction of a pixel to each side; a highlight along the top and a double rim.
- **Flow lines** (one source feeding several channels): pulses leave the source 4 f apart and draw the connectors as they travel. Each node answers on arrival with an expanding ring and a brighter dot; a second wave runs during the hold. No glow.
- **Particle mark or number** (an ending, a milestone): draw the mark or exact number on an offscreen canvas and sample its filled pixels on a grid as targets. Put about 85% of the points on the shape, 2.5 px each at near full opacity on a 1080 frame (fewer points read grey at feed size). Each dot leaves a little after its neighbour (seeded), flies on a gentle arc with a short trail, and lands within 1.2–1.8 s. Use the client's own logo file, and their real number exactly as their source shows it.

**Not for us**: shutter-slat reveals (the owner rejected slats), neon signs with bloom, glowing nodes.

**Checks before showing** (the full list is motion-qc)
- The hero object fills 60–70% of its area, and one frame from the middle of the hold makes the point on its own, even at 200 px wide.
- The values on screen are the brief's, character for character, in both states.
