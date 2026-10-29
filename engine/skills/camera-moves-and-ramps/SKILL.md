---
name: camera-moves-and-ramps
description: Easing, durations and motion blur for pushes, snaps, zoom-throughs, flash zooms, walk-through whips and speed ramps
formats: all
style: dynamic
agents: editor, motion
---

# Camera moves and ramps

**Zoom and pushes**
- Interpolate scale in log space, so a push in and a pull out feel the same speed.
- Pushes: 1.0–1.8 s, cubic ease in and out. Snaps: 0.35 s, expo-out. A slow drift inside a held shot: about 4–9% over the shot.
- Size changes inside one take: 0, or at least 0.3 (1.0 to 1.3+). Smaller reads as a glitch. The one exception is a deliberate jump cut inside an answer in a high-energy style (about 1.12×).

**Transitions made of camera moves**
- **Zoom-through:** the outgoing shot grows 24% over its last 6 f; the incoming one lands from 20% closer over 9 f, with a 24–32-sample radial blur toward the matched subject and 6–10 subframes.
- **Flash zoom** (energy styles only, where the music comes in): 1 washed frame, 1 white frame, then the next shot lands from 20% closer with a radial blur over 0.34 s. More white frames look cheap.
- **Walk-through push:** continue the camera's own pan, measured with optical flow on the clip (direction and speed): about 0.2 s out and 0.27 s in, a directional blur of about 270 px at its peak, and a small push (8%). Only on shots of 2 beats or more; shots of 1 beat get true hard cuts on the beat.
- **Dive:** an accelerating push into a dark area of the frame, an instant of black, then out of a dark area of the next shot.
- **Settle** (where music stops and someone starts to talk): the incoming shot starts 7% closer and settles to 1.0 over 0.4 s.

**Motion blur**
- Only on moves: 6–10 subframes on transitions, 4 on fast camera moves, 2 at rest.
- Clamp the transition state within ±0.05 s of a cut, or the cut frame shows the incoming shot unzoomed.
- All the subframes of one frame draw that frame's own shot. Never blend two shots across a hard cut.

**Speed**
- The incoming move starts at the outgoing move's speed.
- Slow-motion floor: source fps ÷ output fps (60p into 30 fps gives 0.5×). Go slower only with real frame interpolation.
- Speed-ups for crowds and process: 4–5×, eased in over 0.3 s; their sound plays at natural speed under the music.
- Ramps: ease the speed over 4–8 f, once per video, with a music drop on it. Mute 0.14 s into the ramp so the last word rings out.
