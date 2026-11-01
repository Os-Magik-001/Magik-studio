---
name: mixed-type-captions
description: Mixed-type caption lockups (the `mixed_type` preset) — thin lead-in, one big key word in a colour gradient behind the person, small tail; fonts, colours, layout and timing measured on @blackmedia.ve's walk-and-talk reels
formats: social_short, ad
agents: editor, motion
---

Learned on 2026-10-31 from @blackmedia.ve's showreel (instagram.com/p/DetzPtXAG8t, 12 real-estate agent reels, 47 s), every lockup measured frame by frame. The owner wants the engine and the motion director able to make this.

## What it is

Each spoken phrase becomes a small type lockup at head height, never a subtitle bar:
- **Lead-in** (the words before the key word): small and thin, left-aligned just inside the key word, sitting on its cap line.
- **Key word**: one word (or a 2–3 word highlight phrase), set big in a heavy face with a colour gradient, usually **behind the person** so the head overlaps it.
- **Tail** (the words after): small, tucked under the key word, right-aligned to it.
- Phrases with no strong word ("and it", "with", "doing it") are a small bold italic white line at chest height, one or two words at a time.

Examples from the reference: "I positioned / **Home** / this", "and make / ***major decisions*** / today,", "because / **repetition** / builds demand", "*Houses* (script) / **Appreciate**", "Find me a / ***home*** / that's easy to", "and / ***ZERO ENTRY***".

## The fonts (free equivalents, all in engine/assets/fonts)

| Job | Reference look | Ours |
|---|---|---|
| Geometric key word | "Home", "Appreciate", "repetition", "100000" | Poppins ExtraBold (Black for numbers), upright; ExtraBold Italic for a verb ("Strategically") |
| Serif key word | "We know", "decisions", "well the city", "price", "pool" | Playfair Display Black Italic |
| Grotesk key word | "SIRI!", "home", "live in", "6814 W 5th St" | Inter Black Italic |
| Wide key word | "ZERO ENTRY" | Archivo Expanded ExtraBold Italic (wdth 125), capitals |
| Massive word | "DIE.", "FUTURE" | Archivo Black or Poppins Black, capitals, dark slate |
| Thin lead-in / tail | "I positioned", "because", "at this", "the" | Poppins Light / ExtraLight |
| Bold italic lead-in, lines | "and make", "how", "they", "doing it" | Inter Bold Italic |
| Thin italic lead-in | "but most", "Hey", "Find me a", "How about" | Inter Light / ExtraLight Italic |
| Script | "Flowers", "Houses", "Ladies," | Great Vibes |

One video uses 2–3 of these families, not all of them: the Siri video is thin italic + grotesk black + wide; the teal-wall video is serif + geometric capitals; the kitchen video is script + massive + geometric. The engine's preset alternates geometric and serif key words, gives numbers the wide face and a one-word sentence opener the script lead-in.

## Colour ("colour font")

- One colour family per video, picked against the footage: sky blue on grey streets and white houses, pink/violet on warm interiors and brick, cyan + coral on a teal wall, gold for one romantic word. Lead-ins, tails and lines are white (dark slate or near-black on a bright sky).
- Key words get a **horizontal two-stop gradient** in that family: light tint to the full colour (geometric: #A9DDF7 → #3AA7E8), or two neighbouring hues (serif: violet → pink, cyan → coral). Never more than two hues, never a rainbow.
- Massive words are dark slate (#2C3540) or black at 85–95% opacity; the script word is solid gold (#F2C230) or white.
- No outline stroke and no glow. White words get a soft shadow (about 0 2px 18px rgba(0,0,0,.4)); key words almost none.

## Layout (1080 x 1920)

- Key word centre at head height: y ≈ 640–860 for a walk-and-talk or medium shot (preset position `center` = 0.40 H), 0.29 H for a tight head, never below 0.76 H.
- Key word width 60–80% of the frame; font size 0.09–0.25 W (a 4-letter word is capped, it doesn't fill the width).
- Lead-in and tail 0.34–0.45 of the key word's size, at least 44 px; the tail of a serif lockup stays serif, about half the key word's size.
- Lines overlap: the lead-in's descenders touch the key word's cap line; the script lead-in overlaps the key word's top by about 12% of its size.
- Behind the person: the head may hide 20–40% of the key word's box; more than 40% (or the face) and it goes in front. The engine checks this with the cut-out at three moments of the lockup.
- Keep 64 px side margins; nothing in the top 12% or below 76%.

## Timing and motion

- Every word appears on its own syllable (about 40 ms early), out of a blur: 0.18 s for small words, 0.26 s for the key word; opacity 0→1, blur from about 15% of its size to 0, scale 108–112% → 100%, a few pixels of rise. Cubic or expo ease-out, no bounce.
- The lockup stays until the next phrase starts (gaps under 0.5 s), then cuts or fades in 2–3 frames. It drifts about 2.5% larger while it's up, so it never sits dead still.
- A new lockup every 0.8–2 s; a key word every 1–2 phrases. Two plain lines in a row is fine; four lockups in a row with no line feels shouty.
- A list ("search, communicate") can swap the key word in the same place while the lead-in stays.

## Extras the reference uses (motion director / design pass only, once or twice a video)

- A gradient ring behind the head drawing on with the key phrase ("your home is seen").
- Black pills with a thin amber rim for a list ("Presentation", "Price", "Marketing"), popping beside the person on each word. The reference glows the rim; ours stays crisp (house rule: no glow).
- Platform icons (Facebook, Instagram, TikTok, Zillow) lining up under "platforms"; floating listing screens in 3D beside the agent.
- A white silhouette flash of the person for one frame on a cut, then the key word lands.
- A light sweep across one gradient word ("Appreciate"). The house rules ban shine sweeps: only when the brief asks for it, and once.
- A Siri orb and waveform for a scene where the person talks to a phone.

## Building it

- Engine (no design pass): `captions.preset: mixed_type` does all of the above from the spoken words: key words from `highlight_words`, else the strongest word of the phrase; behind the person automatically, in front when the person would cover more than 40% of it.
- Motion designer (design pass): write the lockups in the composition from DATA.words; give key words the class `behind` and the engine cuts the person out over them. CSS: `background: linear-gradient(90deg, a, b); -webkit-background-clip: text; color: transparent` for the gradient, `filter: blur()` plus opacity for the entrance.

## When to use it

Premium talking heads and walk-and-talks: real estate, coaches, beauty, lifestyle, personal brands, ads with a presenter. Not for comedy dialogue (use `subtitle`), not over a busy wide shot with no person (the key word has nothing to sit behind), and not when the brand guide sets its own caption style. In the plan: `captions.mode: auto`, `preset: mixed_type`, `position: center`, the highlight colour chosen against the footage, and `highlight_words` = the phrase's real key words (product, number, payoff), since they become the big words.
