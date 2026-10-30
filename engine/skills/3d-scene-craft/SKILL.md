---
name: 3d-scene-craft
description: How a three.js scene for a reel is shot, lit and rendered so it looks expensive and renders the same every time — a hero object, dives rather than orbits, light and materials, parallax, 3D glued to footage
formats: social_short, ad, podcast_clip
agents: motion
---

# 3D scene craft

Complements 3d-motion (the 3D we make for clients) and one-world-explainer (the 3D explainer). Distilled from HyperFrames' 3D notes (Apache-2.0) extreme-motion-design's compositing and match-moving notes and iart.ai's WebGL notes (MIT), and ideas from Remotion's fly-through notes, October 2026.

**Drawn from time alone**
- Every frame is drawn from t. Physics, particles and crowds are simulated once at load into arrays, and the frame looks up the state at t. Every random choice is a seeded hash of an index.
- Animated GLTF models: drive the AnimationMixer with setTime(t), never with a clock delta.
- Particles need no simulation: life = fract(seed + t × rate), opacity = sin(π × life). A seamless loop samples its noise along a circle, (cos φ, sin φ) × R with φ = 2πt / period.
- Long renders: dispose of every geometry, material and texture when a scene ends and check that renderer.info.memory returns to its baseline, or the WebGL context is lost and frames go black.
- One NaN pixel turns the whole frame black through bloom: clamp anything that can divide by zero.

**Camera and story**
- One hero object beats a crowd. Fly into it or through it rather than orbiting it: one dive is worth ten turns. A slow orbit of a background stage stays at 3–5° a second.
- Cutaways, exploded views and labels with real numbers turn a 3D object into an explanation.
- Flat interfaces are never tilted in perspective: a client's real screenshot goes on a modelled device (phone_3d, browser_3d) or stays flat. Only generated content tilts.
- A camera path on a CatmullRomCurve3 uses getPointAt with an eased progress (by arc length), so the speed doesn't bunch at the control points.
- A fly-through: resample the route evenly, smooth it (a moving average, then three passes of Chaikin corner cutting, swerves damped), and move along it at constant speed by distance. Aim at a real point about a tenth of the route ahead, never along the local direction; bank into turns with roll = clamp(0.6 × heading change, ±7.5°) and keep the pitch constant. The same 13 km flight felt calm in 24 s and rushed in 8 s.
- Layered parallax: the background moves at 0.2–0.5× the focal plane, the foreground at 1.2–1.5×.
- A push in goes from 1.0 to 1.08–1.15 over the scene; a reveal pulls out from 1.15 to 1.0 and settles with no overshoot.
- Dolly zoom: move the camera so that distance × tan(fov / 2) stays constant while the field of view changes, and the subject keeps its size.

**Light and materials** (on top of the design brief's softbox studio)
- A warm key, a cool rim, a dark environment with two or three soft strips. Turn the environment, not the object, so highlights sweep across it; a contact shadow under it.
- Bloom only on the brightest points: it eats detail. Glossy metal under low light streaks white: roughness about 0.45 or more, environment intensity about 0.5.
- An illustrated brand can take a cel look: a toon material with a three-tone gradient map, outlined by an inverted hull (the mesh scaled 1.03, back faces only, in the ink colour).

**3D glued to footage**
- A graphic on a phone screen, a sign or a wall: track the plane's four corners and corner-pin it. For 3D objects on that plane, solve a camera per frame from the tracked quad (the plane's real size and the lens's field of view) and place them at z = 0. Check the corners land on the real corners at the start, middle and end.
- An object in a hand or above a head: an orthographic camera where one unit is one pixel; move the object's group to the tracked point each frame, not the camera. Hide it on frames where the track is lost rather than faking it.
- To sit in the footage: a light wrap (the background's light bleeding 4–8 px over the subject's edge in screen blend), a contact shadow, and the footage's own grain over the 3D.
