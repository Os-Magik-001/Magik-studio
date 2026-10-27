---
name: clone-scenes
description: One person playing several versions of herself in the same frame (the « 3 approches » format), from the shoot to the composite, the camera moves, the verdict tags and the sound
formats: social_short, ad
agents: editor, motion, scriptwriter
---

The format: the same problem, three versions of the client side by side (the quick fix, the not-bad, the right approach), each one saying her line in turn. The viewer recognises herself in one of them in the first seconds, and the series repeats with a new problem every time. First made for Sara, naturopathe (October 2026).

**The shoot (shoot plan)**
- A tripod that never moves, the same zoom and focus for every take; one framing wide enough for three people standing (full body, about 30% of the frame width between them).
- Three marks: left (about 20% of the width), centre (about 49%), right (about 79%). Each take is one person on one mark saying one line.
- Every take holds 3 s still before and after the line: those seconds are the "listening" footage the other clones need while someone else talks. A take or two of each position with no line at all helps a lot.
- Same outfit, same light; switch auto exposure off if you can (the camera's auto exposure moved the brightness by up to 35% between takes).
- Shoot the hook line alone on the centre mark, a step closer to the camera.

**The composite**
- Align every take on one reference take with a homography from the static set (a textured wall is ideal); the takes drifted 2-7 px.
- Match exposure per frame from the static set (wall and floor), not once per take.
- Build the room from the centre take, then lay the left and right clones in with person mattes (Apple Vision person segmentation, accurate, half resolution, soft edge). Vertical bands with seams sliced a clone the moment she leaned; mattes have no seams. Draw the centre clone last so she stays in front.
- Idle clones play their own take running into and out of their line (continuous footage); fill the rest with other still stretches of the same mark, slowed to 0.85x and crossfaded over 0.3 s.

**Direction of the eye**
- The camera pushes to whoever speaks: zoom 1.32 on her mark in 0.45 s, a slow drift to 1.37 during the line, back to the wide (1.03) on the recap. The two who listen dim to about 76%.
- A verdict tag pops over the speaker's head 0.15 s into her line, in words and colour only: red « À côté de la plaque », ochre « Pas mauvais », green « La meilleure approche » (no ✗ / ✓ / emoji glyphs: they read as a template; a hand-drawn tick or cross stroked on is fine). After her line the tag shrinks to a small coloured dot, so three full tags never collide; the recap shows the three.
- Each topic opens on a numbered title card over the wide (1 s), then the three lines, then a 0.85 s recap.
- The hook: the client alone says the line; on its key word (« trois ») the two other clones fade in from a flash while the camera pulls out from 1.34 to the wide.
- A topic's list (« digestion, sommeil, stress ») becomes pills next to the speaker, one per word. One quick cutaway of the quick fix (coffee pouring after « un café de plus ») is funny; more breaks the device.

**Sound**
- A light bed about 10 dB under the voice. Effects from the designed family (see sound-design): a short air swish on each camera move, a soft felt thump when a verdict lands (lower and duller for the wrong one, brighter for the right one), a breath swell into the reveal. No cartoon sounds (buzzers, dings, boings, record scratches): the owner rejected that palette outright.

**Ending**: a question card (« Pourquoi la 3e approche ? ») and a push into the client's own story on another set, then the call to action.
