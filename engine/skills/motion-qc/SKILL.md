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
- A fresh reviewer (a sub-agent with no context) gets only the contact sheet and the brief. It first says in three lines what the video says, to whom and what it asks (if it can't, the text doesn't work muted), then PASS or FIX per frame, no praise.
- The pictures alone: with the words covered, the beat frames still tell the story. The still test: one frame from the middle of a hold makes its point on its own.

**Measure, don't eyeball**
- Measure motion against the start frame, never the halfway frame (a sine is back to zero there). A scene that doesn't change for longer than its hold is frozen.
- Something meaningful moves in every second; after each arrival, 12–24 f of ambient motion only.
- Text contrast at least 3:1 against what is behind it, over its whole time on screen.
- Compare scenes as 24 × 24 grey thumbnails: neighbours that correlate above 0.90 share one composition. The busiest scene moves at least 1.5× more than the calmest.
- At most 3 flashes a second, and no single-frame pops.

**Signs of the generated look** (three or more across the stills means it looks model-made; two is close)
- A near-black ground with one accent, or only two colours, in most frames.
- The visual centre in the same place in every scene; the biggest text always starting at the left margin.
- The biggest text in a giant condensed face in most frames, more than half the text in capitals, one heavy weight everywhere, monospace as decoration.
- The same entrance in every scene; glow, grain and colour fringing on everything.
- A brand whose type really is condensed capitals (Institut Curves' Anton) keeps it: vary the layout, the weights and the ground instead.

**Render pitfalls**
- Full-screen linear gradients on dark grounds band under H.264: use a radial gradient, a solid fill with a local light, or add grain.
- An accent at 5% opacity disappears in compression: use 15–25% for atmosphere and full saturation for the focal element.
- Colour on delivery (measured October 30): the engine's renders are tagged BT.709 at limited range and convert colours exactly. Hand pipelines must match: `-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv` on single-pass encodes (never on a two-pass one: it throws the size off), never yuvj420p or full range (Apple's players crushed the shadows, 20 came out 17), and exact conversion (`-sws_flags bicubic+accurate_rnd+full_chroma_int`, or `sws_flags=…;` as a filter graph's first line), because ffmpeg's fast path reads 1080-wide frames 2–4 levels dark.
- Measure colour from the raw planes with the BT.709 formula, not ffmpeg's RGB output (it has the same 1080-wide error). Apple's players show any BT.709 video lighter (mid-grey 128 as about 139), tagged or not: judge a brand colour against the footage beside it, not against its hex on a Mac.
- Footage with keyframes more than about 1 s apart freezes when seeked: re-encode it with a keyframe every second (`-g` at the frame rate) before using it as a design asset.
- Frame 0 must already be in the right font: load every font before drawing it. Canvas pixel reads need `getContext("2d", { willReadFrequently: true })`, or Chrome can draw the same frame two ways.
- Fade a caption group or its words, never both: the opacities multiply and read as a pop.
- A fix changes one thing: keep the motion and timing that were liked, change only what the note names, and keep the earlier version.
