---
name: motion-curves
description: Easing by role, springs, overlap, amplitude, motion blur and holds for designed motion, plus the notes that fix it, so moves stop looking generated
formats: social_short, ad
agents: motion
---

# Motion curves

Distilled from HeyGen's HyperFrames motion notes (Apache-2.0, measured frame by frame on their launch films) and Isaac Mello's extreme-motion-design doctrine (MIT), October 2026. Frames (f) are at 30 fps. Text timings are in kinetic-type; this skill covers everything else that moves.

**Ease by role** (the same ease-out at 0.5 s on every element is what makes a film look generated)
- Arrive: a long tail, bezier(0.16, 1, 0.3, 1) or expo-out. Landing takes longer than leaving. Never ease-in on an entrance.
- Hero arrival: bezier(0.05, 0.7, 0.1, 1).
- Move or change shape, camera moves, colour floods: ease both ways, bezier(0.77, 0, 0.175, 1) for a strong move, a softer power2 in-out for a camera.
- Settle with no overshoot (a reveal, a pull-out): bezier(0, 0.65, 0.51, 0.99).
- Exit or zoom through: accelerate, bezier(0.7, 0, 0.84, 0) or power3-in. An exit is one smooth motion, never slide, stop, then leave.
- A move cut before it settles (into a cut or behind a mask): fast-slow-fast, bezier(0.15, 0.85, 0.95, 0.05).
- Linear only for rotation, progress bars and constant speed that is the point.
- Across a seam, mirror the curve (power3-in out, power3-out in) so the speed matches.
- One motion language means the same curves and blur everywhere, not the same entrance: vary how scenes enter.

**Springs and overshoot**
- Name springs by damping ratio: 1.0 never bounces, 0.7–0.85 reads premium, 0.4–0.6 playful, under 0.3 cartoon (never). Compute them in closed form from t so any frame renders on its own.
- Position and size may overshoot once, 3–8% past the target, on the focus element only, once per scene. Opacity and colour never overshoot. No bounce or elastic with several cycles.
- By material: rigid (metal, stone) 1.2× the base duration with no overshoot; glass 0.9×, none; paper and cards 1.0×, 3–5%; liquids 1.5×, 5%; smoke and fog 2×, none.

**Order and amplitude**
- One primary action per beat. Secondary moves at most 30% of its amplitude, ambient drift at most 5% (a wiggle of 6 px at most). Two primaries at once is a mistake.
- Overlap: the next element starts when the previous one is 30–50% done. Fully sequential looks robotic, all at once looks cheap. List items 40–80 ms apart.
- Per property: opacity resolves early while position and scale keep settling.
- After each arrival, 12–24 f where only ambient things move.
- A scene builds over its first 30%, breathes from 30 to 70% and resolves in the last 30%. The slowest scene lasts about 3× the fastest.
- A short anticipation before a big move, 2–4 f of follow-through on loose parts, moves along arcs.

**Motion blur**
- Fast moves (0.3–0.6 s) carry blur along their own path, peaking on the fastest frame: 6–12 px on text, 15–20 px on full-frame moves, horizontal only on a horizontal move.
- A whip travels about 12% of the frame in 6–8 f; the arriving element lands blurred and sharpens in about 4 f.

**What stays still**
- A landed title is dead still until it leaves; the motion passes to the next element, the camera or the world behind. 3D objects may drift and turn (one-world-explainer); titles and UI never breathe, float or pulse.
- Signs of generated motion: titles that keep scaling after they land, a slow creeping push late in a scene, bounce on UI, click rings, every scene entering the same way, every element fading and sliding up.

**On the music**
- Beat n is at round(n × fps × 60 / BPM). Compute each beat from its index, never by adding a rounded beat (at 128 BPM and 30 fps that drifts 2 f in 32 beats). Cut on the beat, change the layout on the bar.
- A move that must land on a hit starts 40–190 ms early; a reaction starts 0–45 ms after; the hit itself is a set, never eased. Any single treatment goes stale after about 6 s.

**Notes and their fix**
- "Too fast": slow every zoom and pan to 0.7× of its speed, nothing else.
- "The titles move": land them, then hold them dead still until they leave.
- "It feels like slides" or "PowerPoint": enter the next scene through an object already on screen, and cut a move mid-flight (designed-transitions).
