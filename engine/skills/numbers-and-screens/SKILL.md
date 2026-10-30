---
name: numbers-and-screens
description: Numbers, charts and a client's real app or website in designed motion — earned numbers, charts in reading order, real UI isolated and returned, the cursor, the performed end card
formats: social_short, ad
agents: motion
---

# Numbers and screens

Distilled from HyperFrames' data and launch notes (Apache-2.0), iart.ai and diffusionstudio (MIT), and ideas from Remotion's map notes, October 2026. object-morphs has the morph recipes (chart morph, KPI lift).

**Numbers**
- A number is earned by the scene before it, then made physical: a count that becomes a skyline, a share that becomes a crowd. It is the biggest thing on screen.
- A count-up runs 1.2–1.6 s, then holds, landing on a downbeat, in tabular figures (`font-variant-numeric: tabular-nums`) so the digits don't jitter. Never every number counting at once.
- Odometer digits: each digit is a 0–9 strip behind a 1 em window. Only the digits that change roll, in the last 30% of each step, bezier(0.22, 1, 0.36, 1), with an extra 0 under the 9 so a carry rolls forward.
- Real figures only, rounded the same way everywhere, with a small source line. One data object drives every figure in the video so they agree.

**Charts**
- Build in reading order: the frame and axis, a reference line, the data drawing in, then one annotation on the point that matters. Annotate on the mark, no legends.
- Under a voice, the line draws between the figure words (eased in and out) and stops on each value as it is said; on the word, a dashed drop line, the dot, and the label scaling 0.85 → 1 in 0.4 s.
- Items along a drawing line each start when the line reaches them, then run their own fixed phases (an outline, a fill, a label), never a slice of one global progress, or long items flash by. The line draws at an even speed by its visible length; nodes ease in as it reaches them; a drawing head of about 4.5 px, white, fades 0.5 s after the draw ends.
- Rounded bars and cards are revealed by a mask, never by scaling, or their corners distort.
- Highlight one series and grey the rest. A chart with one thing to say says it in its title.
- The same object carries across beats (a bar becomes the ground of the next scene, a line becomes the road the camera follows); the camera can dive into the one value that matters while the rest falls away.
- Tells: a grid of KPI cards, a dashboard, a pie chart, numbers with no source.

**A client's real app or website**
- Everything that claims to be the product is the product: their recordings, screenshots or captured pages, their logo and icon files. A missing screen is a labelled placeholder, never an invented dashboard.
- Three moves. Establish the workspace (enough real navigation to place the task). Isolate the action: rebuild only that piece from its real labels and values, at 1.6–2× its real size, with text at least 28 px on a 1080 frame after any push. Return the result into its place, or pull back to where it is used.
- A camera move over a frozen screenshot is not the product doing something: let a trace draw, a list fill or a panel open before moving on.
- The camera cycles between the window, one pane and one control: moves of 0.4–0.6 s with motion blur, then a hold while the interface acts.
- Containers morph instead of cutting: the button becomes the menu, the message becomes the bubble (object-morphs).
- The cursor is big (4–7% of the frame), enters from off-screen, and its click causes the next thing on the same frame. No click rings.

**Maps and real places**
- A real place is shown on real imagery (satellite or map tiles); vector outlines read as a diagram. Remove the label layers and inner borders, draw each border a darker shade of its fill, and keep the provider's credit visible in small type.
- A detailed flat plate (a map, a long screenshot) renders once at the deepest zoom needed (at most 4096 px a side) and moves by translate and scale, never scaled above 1, its overlays sharing the same transform. Shimmer means the renderer itself moved.
- Live tiles change between renders: bake the camera move to video once, then draw pins and labels on top while the camera holds.

**The end card**
- The mark lands in the last 5–10% of the video, centred, the lockup 15–30% of the frame width, performed rather than faded in: a fill rising through it, carried in by the story's object, the wordmark wiping in beside it. The call to action holds 1.5–3 s.
- Around the mark, a clearspace of one cap height stays free of motion. The symbol leads into the exact lockup and settles 1.04 → 1.00 in 0.12–0.2 s on the sound accent, then holds at least 0.4 s. A logo sting builds over 40–60% of its length, resolves in 10–15% (the hit lands there) and holds for 25–35%.
