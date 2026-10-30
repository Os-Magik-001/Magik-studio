---
name: motion-qc
description: Frame checks for designed motion before anyone sees it — cut strips, the phone sheet, the still test, motion measured, the signs of the generated look and the render pitfalls
formats: all
agents: motion
---

# Motion QC

Distilled from the review steps of HyperFrames (Apache-2.0), extreme-motion-design (MIT) and Charlie Hills' motion skills (MIT), October 2026.

**The sheets to look at**
- A strip across every cut, from -0.2 s to +0.2 s. A jump at a cut means the outgoing and incoming states differ at the seam; a change of speed means the curves are not mirrored (motion-curves).
- One frame just after each scene starts, and one from its middle.
- The beat frames at phone width (360 px wide): every line meant to be read must still read. A graphic's key frame at 200 px wide (a feed thumbnail): if the changing thing disappears, make it bigger.
- The pictures alone: with the words covered, the beat frames still tell the story. The still test: one frame from the middle of a hold makes its point on its own.

**Measure, don't eyeball**
- Measure motion against the start frame, never the halfway frame (a sine is back to zero there). A scene that doesn't change for longer than its hold is frozen.
- Something meaningful moves in every second; after each arrival, 12–24 f of ambient motion only.
- Text contrast at least 3:1 against what is behind it, over its whole time on screen.

**Signs of the generated look** (three or more across the stills means it looks model-made; two is close)
- A near-black ground with one accent, or only two colours, in most frames.
- The visual centre in the same place in every scene; the biggest text always starting at the left margin.
- The biggest text in a giant condensed face in most frames, more than half the text in capitals, one heavy weight everywhere, monospace as decoration.
- The same entrance in every scene; glow, grain and colour fringing on everything.
- A brand whose type really is condensed capitals (Institut Curves' Anton) keeps it: vary the layout, the weights and the ground instead.

**Render pitfalls**
- Full-screen linear gradients on dark grounds band under H.264: use a radial gradient, a solid fill with a local light, or add grain.
- An accent at 5% opacity disappears in compression: use 15–25% for atmosphere and full saturation for the focal element.
- Footage with keyframes more than about 1 s apart freezes when seeked: re-encode it with a keyframe every second (`-g` at the frame rate) before using it as a design asset.
- Frame 0 must already be in the right font: load every font before drawing it. Canvas pixel reads need `getContext("2d", { willReadFrequently: true })`, or Chrome can draw the same frame two ways.
- A fix changes one thing: keep the motion and timing that were liked, change only what the note names, and keep the earlier version.
