---
name: one-world-explainer
description: Explain a process, a product or a structure as one designed 3D world — one object per idea, a camera that travels between them with no cut, a progress bar, small captions; for voice-overs and talking clips that explain something
formats: social_short, ad
style: dynamic
agents: editor, motion
---

# One-world explainer

## When to use
When someone explains how something works (a treatment, a method, a framework, a product's parts) and the footage of them talking is not the interesting part. Measured on @robin_linkerpro (« the perfect structure for short-form content », 33.7 s, no cut at all) and @aslaniedits' 8 s « You are growing » piece. It worked for Institut Curves' Morpheus8 explainer (showcase reel 1, Oct 28).

## The world
- One background for the whole video: near black with one or two coloured hazes (deep brand colour low on the horizon, a warm light far away), a fine grid floor fading into the haze, slow dust in the air. Never a flat colour, never a stock nebula.
- One material family: glass (transmission, a thin glowing edge in the accent colour), lit by one warm key and one cool rim. Objects that are not glass (skin, steel, a product) get the same light.
- Bloom on what is bright (glowing edges, lit text), a soft vignette, light film grain. Nothing else.
- The brand's colours rule the world. Robin gives each block its own neon colour (pink hook, amber lead, cyan body, violet open loop, green call to action); a brand with one accent uses it for every object and keeps amber only as light.

## One object per idea
- Each idea of the script is one station: a single object that shows it, not a text slide. Examples that worked: a glass monolith with the product name, a wire globe whose cities light up on « tous les pays » with a gold ring on « prix », two glass slabs that slide in on their names and fold together on « donc, ensemble », a block of skin layers pressed by steel needles that glow at their tips on « chaleur », a lifted surface on « relifter », a frosted card with the person's own call to action.
- Robin's objects: a stack of glass slabs that builds one slab per word, scrolling cards with one that breaks out tilted (« Wait, what? ») for the hook, a retention chart that counts 0.0 s to 15.0 s with an « anchored » badge at 10 s for the lead, a glass cube « VALUE » on a ring pedestal, a ring drawing around a « ? » that turns into a green tick when the loop closes, funnel rings of avatars for the call to action.
- Every object moves on the word that names it (kinetic-type sync). Between words it breathes: a slow turn, a drift, a pulse. Nothing holds still more than 1.5 s.
- A station never opens empty: its first object arrives within 0.4 s of the camera landing.

## The camera
- The transition is the camera travelling: 0.9–1.0 s from one station to the next, eased in and out (cubic), arcing up and back on the way (it pulls back about 40% of the distance at mid-move so both objects read), 8 subframes of motion blur while it moves, 2 at rest.
- Inside a station: a slow push and a slight orbit (about 4% of the distance per second).
- Portrait frames are limited by their width: place the camera far enough that the widest object fills 70–85% of 1080 px. Too close is the first mistake every time.

## The interface layer
- A thin top bar under the platform zone: the subject in tracked caps (« MORPHEUS8 · EXPLIQUÉ »), a counter « 03/06 » and one progress segment per station that fills as it plays.
- The station's name as a small tracked label under the bar, appearing on each move.
- Captions small and low (2–3 words, the word being said in white bold, the others at 60%), clear of the interface (text-placement-and-legibility).
- Labels attached to 3D points: projected from the object each frame, a tracked caps word and a gloss in the italic accent font; they fade out before the next label comes.
- The speaker in a round glass bubble (bottom left, 250 px, a glowing rim in the accent colour, a name card under it), cropped round the face from a face track so the head stays centred. Her lips stay visible: the viewer must see who speaks.

## Structure and ending
- The object that carries the structure comes back at the end as the recap (Robin's whole stack with « ×1 ×2 » brackets, then « 8 blocks » with a « Save this » button a cursor clicks into « Saved »).
- End: one white frame (not more) into the brand's signature on its own backdrop, then the call to action and the address.

## Sound
- An atmospheric bed about 10 dB under the voice, back-timed so its own ending lands on the signature. One air pass per camera move peaking on its fastest frame, one designed sound per object event (glass, paper, a low hit, a swell), moved to the nearest breath under speech (motion-sfx-sync).

## Engine mapping
When the comp pipeline isn't available: `scene3d` explainer scenes per line, `progress` bar, `pip` circle for the speaker, word-by-word captions with `highlight_current`.
