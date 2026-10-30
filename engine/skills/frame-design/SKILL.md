---
name: frame-design
description: Designing each frame of a motion piece — where the hero sits, empty space, what bleeds off the edge, type spacing by size, French capitals, the colour ladder and area split, and graphics that sit inside real footage
formats: social_short, ad
agents: motion
---

# Frame design

Distilled from Isaac Mello's extreme-motion-design design notes (MIT, October 2026) with iart.ai's colour notes and diffusionstudio's design notes (MIT). Sizes are on a 1080 × 1920 frame. The brand kit and motion-design-system win where they set a value.

**Composition**
- The hero sits on one of the four thirds intersections or bleeds off an edge; never the geometric centre by default (except a symmetric logo or end card), and not the same intersection scene after scene.
- Tilted elements and paths follow the frame's diagonal: 60.6° in 9:16 (29.4° in 16:9), or its complement, not 15° or 45° by habit.
- Empty space is a number: 55–80% of the frame on brand or product frames, 30–50% on data or interface frames. Keep it on one side: the widest free margin at least twice the opposite one.
- Something bleeds off the frame or is cut by a mask in at least half the scenes; a frame where everything fits with room to spare reads as a slide. A blurred foreground element (8 px or more, at most 15% of the area) adds depth.
- Vertical frames stack in three bands: context in the top third, the hero in the middle, support in the lower third, all inside the safe zone (text-placement-and-legibility). The hero's letter height is 12–20% of the frame width; lines of 12–18 characters.
- On a designed frame the hero is at least 3× the next text on it (1.2–2× reads as a mistake); at most four text sizes.
- The highest-contrast element is where the eye enters; the second sits on its path.

**Type**
- Tracking tightens with size: up to 32 px, 0 to +0.01 em; 32–80 px, −0.01 em; 80–160 px, −0.02 to −0.03 em; over 160 px, −0.03 to −0.05 em. Capitals get 5–12% more (0 to +2% for giant condensed display), never negative.
- Line height: 0.90–1.05 for display over 120 px; capitals may go to 0.85 but stay at 1.05 or more when accented (É, À, Ç, Ô), or the accents hit the line above.
- French capitals in a mask reveal: pad the mask at least 0.18 em above the cap height, or the accents are clipped. Use text-transform on the real accented text instead of typing capitals.
- Condensed faces (Anton, Bebas Neue, Oswald, Barlow Condensed) only for display of 3 words a line or fewer, 48 px or larger; below that they close up on a phone.
- Mixed sizes on one row (a label and a value, a name and a number) align by their cap-height centres, not a shared baseline, or the small one sinks. The gap from a title to the line under it is 0.5–0.8 of the title's cap height.
- Letter-spaced capital labels only when they carry information (a chapter, a counter, the subject); as decoration they are a sign of generated design.

**Subtract**
- No card or divider that space could replace; one surface tone and one divider style. The frame must still read with every effect turned off.

**Colour**
- Build the palette as a lightness ladder before choosing hues (OKLCH): ground and ink at least 0.60 apart, surfaces 0.04–0.08 off the ground, secondary ink 0.25–0.35 off the ink. Tint the neutrals slightly toward the brand hue (chroma 0.005–0.02). On dark grounds, accents at lightness 0.70–0.85.
- Area split: dominant 55–70%, secondary 20–35%, accent 3–10%. An accent over 15% of the frame stops being an accent; it carries one meaning and appears in at most 40% of the scenes.
- A colour script before animating: one dominant colour per scene, the biggest change at the climax.
- Gradients interpolate in oklab (`linear-gradient(in oklab, …)`) to avoid the grey middle, with grain over them (motion-qc).
- Duotone maps lightness to two inks (shadow at lightness 0.15–0.25, light at 0.85–0.95, hues at least 60° apart), never a colour laid over a photo.

**Graphics inside footage**
- Take the graphic's black and white from the shot (sample its black and white points), never pure #000 and #FFF over video.
- Soften vector edges 0.3–0.6 px over 1080 footage and add the grain after the graphics, so both share it.
- Text pinned to the scene gets the shot's perspective (a corner pin) and its motion blur; text that floats still while the camera shakes is the first thing that looks fake (3d-scene-craft).
- Cut-outs either look like collage on purpose (a visible paper edge of 4–10 px and a short shadow of 2–6 px in one direction) or are perfect; anything in between looks like a mistake.
- Ken Burns on a still: 3–8% over 4–6 s, one direction (toward the subject or away from it), already moving on its first and last frame.
- 2.5D photo parallax: cut the subject out and fill behind it; the background scales 1.00 → 1.03, the subject → 1.08, the foreground → 1.15, with 1–2% of sideways drift, 2–6 px of blur on the background and the cut-out edge feathered 1–2 px.
