---
name: 3d-motion
description: Real 3D in a talking-head reel: extruded titles and numbers (some standing behind the speaker), 3D transitions between chapters, a 3D figure to explain the body, a 3D step tracker, the client's logo in 3D on the end card
formats: social_short, podcast_clip, ad
style: dynamic
agents: editor, motion
when: 3D, trois dimensions, chapitre, étapes, posture, corps, anatomie, logo, histoire, fondateur
---

First made for Clinique OzonePlus (October 2026), where the owner asked: « if you see that you can do motion 3D designs and 3D transitions, do them ». 3D is what separates a studio edit from a template one, as long as it follows the client's brand kit and stays sparing: one 3D moment every 6-12 s, the rest clean cuts and captions.

**Extruded type** (three.js, pixel-space camera: field of view 30°, the plane z = 0 maps to the frame pixel for pixel)
- Titles in the brand's title face, extruded about a quarter of their height with a small bevel, glossy brand colour, lit like the room (a key from the window side, a warm fill, a cool rim) with a soft environment for reflections.
- Each letter rises out of depth and turns to face the camera, staggered 0.03 s (0.06-0.08 s for 1-3 characters), easing in over 0.9 s; out, they drop back into depth. Motion blur on arrival (4 subframes).
- The brand's hierarchy in 3D: a small italic accent line (Bodoni-style, warm white, shallow extrusion) over a heavy condensed line in the brand colour, as in the kit's own examples. A soft top shade under them on a light wall.
- Accented capitals (É, Ç, À) are composite glyphs in TrueType: the outline reader must assemble their components, or « ÉQUILIBRE » renders as « QUILIBRE ».

**Behind the speaker** (the number motif)
- The key numbers of a story, extruded large (cap height 250-380 px), standing in the room behind the speaker: drawn after the footage, then the speaker drawn again over them through his person matte (Apple Vision person segmentation, accurate, half resolution, soft edge). Mattes only for the frames that need them.
- Place them so they read: across the wall above and around the head; a single glyph beside the head (« 6 » at x 300), not hidden behind it; long words (« ABSOLUMENT ») may pass behind the head, the caption says the word anyway.
- In a founder story the numbers become a motif (7/7, 10 ANS, 0 $, 5, 10) and the hook's number comes back at the end, struck out with a yellow brush stroke drawn in 3D (behind him too).

**3D transitions** (only at chapter or section changes; whip-zooms or cuts inside)
- The outgoing and incoming shots rendered as textures on cards in a deep brand-coloured room: **cube** (the frame-wide cube turns 90°), **card flip** (the frame turns over, the next shot on its back), **slats** (six vertical strips turning one after another), **push** (the frame falls back into the room, the next arrives from behind the camera; good for « revenir en arrière » or entering an explainer). 0.7-0.9 s, the camera backs off 15-30% at mid-turn so the depth reads, face light from its angle to the camera, 8 subframes of motion blur. A 3D turn gets the « turn » effect (air + a soft thump as it settles).
- 2D labels and stacks step aside during a 3D transition.

**A 3D figure to explain the body** (posture, compensation, where pain comes from)
- A standing mannequin of rounded volumes: a translucent blue shell (bright at the edges, a medical-scan look) over a white spine, pelvis, femurs, tibias and joints; a light ring on the floor; the brand's deep blue room behind.
- Full-frame scenes cut in on the lines they explain (2-7 s each), with Patrick's voice running on and captions lower down (y 1640). Inside a scene, values ease between keyframes on the words: the centre of gravity (an amber orb with a dashed plumb line), the load under each foot (discs that grow), the weight shifting onto one leg (pelvis slides and drops, trunk leans back, the other knee unlocks), soft orbs on a zone (knee red, thigh / hip amber, lower back red, pulsing).
- The camera tells the story: full figure for balance; close on the knee for the injury; from behind for the lower back; then a swing down from the back to the knee on « tout a commencé avec une blessure au genou ».
- Labels pinned to the parts: a white dot, a thin line out to the side, the word in spaced capitals with a Bodoni italic second line (« Bas du dos / là où ça fait mal »); kept inside the frame (shorter line or the other side).

**A 3D step tracker** (a method in steps, a FAQ countdown)
- One rounded tile per step across the top (y about 230), the number extruded on each. The current step lifts toward the camera, scales up 16% and glows in the brand colour; the ones done stay deep blue, the ones ahead dark. Keep the tiles' reflections low (environment ×0.2, little clearcoat): bright reflections wash them white on a light wall and the numbers disappear.

**The logo in 3D on the end card**
- Trace the client's wordmark from their brand kit: separate its colours by keying (blue letters, white letters), upscale, threshold and trace to vectors (potrace), then extrude each part with the brand materials. Each part arrives from depth in turn, a light sweeps over the bevels, the camera settles face-on. Tagline and contact under it in the brand's type. Never imitate a logo you can't trace from the client's own files.
