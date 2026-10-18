---
name: omgadrian-editing-vertical-framing
description: Composition rules for 9:16: center-line weight, lead eye, constant eyeline, UI dead zones, and shot sizes built from reframe and punch-in (learned from @omgadrian)
formats: all
---

# Vertical framing

These rules come from @omgadrian's framing lessons for 9:16. Each one maps to the focus point and `zoom`. They apply to both styles. The client's own skill still sets its punch-in limits.

**How the focus point works.** It is where the subject sits in the source frame (0 to 1), and the crop is centred on it as far as the frame allows. On 9:16 footage at zoom 1.0 the whole frame shows, so the focus point changes nothing; it matters on punch-ins and on wider sources. A point at the centre of the crop lands at the centre of the screen, so to put the eyes higher than the middle, set the focus point below them: for the eyes at about 35% from the top at zoom z, use focus y = eyes y + 0.15 / z (eyes at 0.30 in the source, zoom 1.5: focus y 0.40).

1. **Balance on the center line, not on thirds.** Put the focus point's x on the subject's visual weight, so it lands on the screen's center line. That means a single speaker, the midpoint between two faces in a two-shot, a landmark or a product. A 9:16 frame is too narrow for horizontal rule-of-thirds placement.
2. **Angled speaker: lead eye on the center.** When the speaker is turned three-quarters, set the focus point's x on the eye nearer the camera, not the middle of the face.
3. **Keep the same eye height in every shot.** Eyes sit 33-38% from the top in wides, mediums and close-ups alike. When you punch in, set focus y = eyes y + 0.15 / zoom so the eyes stay on that line. An eyeline that jumps between cuts reads as a mistake.
4. **Respect the dead zones.** The platform UI covers two areas:
   - the bottom 20-25% (username, post caption);
   - the right 10-12% of the width, from mid-frame down (like, comment, share).
   Faces, props and anything the joke needs go in the upper two-thirds. Captions sit just above the bottom band, never inside it. Titles and graphics stay out of both zones.
5. **Build shot sizes from one camera.** Wide = zoom 1.0, medium = 1.3-1.5, close = 1.8-2.0, detail = 2.0-2.5 on the focus point. Punch-in is a crop:
   - On 1080p phone footage, stay at 1.35 or below (the clean-comedy-edit range).
   - Use 1.5-2.5 only on 4K sources, or on detail inserts where softness doesn't show.
6. **Never the same framing twice in a row on a monologue.** Consecutive talking shots from the same angle change zoom by at least 0.3 (1.0 → 1.3, 1.3 → 1.0, 1.0 → 1.8). Two wides in a row are allowed only in three cases: you are still establishing a location, the second wide is a different camera, or it shows a different speaker.
7. **Size follows the emotion.** Use the wide (1.0) for observational, distant or physical moments, where body language reads. Go tighter for confessional or intimate lines and for the most emphatic line of a run. Choose the size for what the line feels like, not just for variety.
8. **Recenter, don't reshoot.** If a locked-off shot is off-center, punch in 1.1-1.2 with the focus point on the subject so it lands back on the center line.
9. **Static by default.** Zoom start equals zoom end. A slow push (1.0 → 1.15-1.2 over the shot) belongs to the dynamic style. Use it on one emotional line, an archive clip or an aerial reveal. Never use it on dialogue in the clean style.
10. **Leave room for a title (dynamic only).** On the one shot that carries a top-third title, set focus y = eyes y + 0.08 / zoom, so the eyes sit near 42% and the space above is plain. Return to the 33-38% eyeline on the next shot.

## Example
Monologue from one camera, 4K source:
Eyes at x 0.48, y 0.30 in the source.
{say: 'So you just bought a car mount.', beat: setup, zoom 1.0, focus {x: 0.48, y: 0.45}}
{say: 'Most people stick it on the windshield.', beat: setup, zoom 1.5, focus on the lead eye {x: 0.46, y: 0.40}}
{say: 'That's the worst spot.', beat: punchline, zoom 1.0}
Why: each cut changes size by 0.5 and the eyes never move vertically. The punchline goes back to the wide, where the shrug reads.

## Example
Two-shot from 1080p phone footage. The setup is at zoom 1.0, with the focus point's x on the midpoint between the two faces. The punchline is at 1.3, with x on the speaker's lead eye and y = eyes y + 0.12. No face or prop sits below 75% of the frame height.
