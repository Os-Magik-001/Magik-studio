---
name: color-and-look
description: Correcting and matching every shot first, then choosing the video's one look, in a colorist's order
formats: all
---

**Work in a colorist's order**
1. Correct each shot with `adjust`, white balance first, until the shots of a scene match: neutral whites, natural skin, same face brightness, blacks black, whites not blown.
2. Only then choose one `look` for the whole video. A look on uncorrected footage multiplies its problems, and two looks never stack.
3. Judge on the contact sheets: compare each shot with its neighbors and with the best-looking shot of the scene, which is the reference.

**Correct each shot** (steps of about 0.05; good shots stay neutral: brightness 0, contrast 1, saturation 1, warmth 0, tint 0)
- **White balance** (`warmth`, `tint`, -1 to 1): white walls, shirts, grey cars and overcast skies should look neutral, and skin natural.
  - Blue or shaded shot: warmth +0.2 to +0.4. Orange tungsten shot: warmth -0.2 to -0.4.
  - Green fluorescent cast: tint +0.2 to +0.3. Magenta cast: tint -0.2.
  - Match every shot's warmth to the scene's reference shot. Leave a neutral shot at 0, and don't use white balance to create a mood: that's the look's job.
- **Underexposed:** brightness +0.05 to +0.12 together with contrast 1.05 to 1.1. Brightness alone lifts the blacks too and the shot goes milky.
- **Overexposed (bright sky, white walls, blown faces):** brightness -0.05 to -0.1, contrast at or under 1.04 so highlights don't clip further.
- **Flat, washed out, re-compressed or log-looking:** contrast 1.1 to 1.2, saturation 1.05 to 1.15.
- **Oversaturated (neon skin, garish signs, glowing grass):** saturation 0.8 to 0.9.
- **Matching:** a shot visibly brighter, darker or a different color from its neighbors is a defect. Faces should sit at about the same brightness in every shot of a scene.
- Stay gentle: compression damage can be softened, not undone, and pushing hard brings out noise and banding.

**Pick one look** (the brand's style rules and the client's notes win)
- **`natural`:** the default. Talking heads, education, food accuracy, clinical or technical brands, and whenever the footage already looks good. A client who asked for a natural grade keeps it.
- **`warm`:** food, coffee, hospitality, family, lifestyle, stories, golden-hour footage.
- **`cool`:** tech, clean products, wellness, winter, night.
- **`punchy`:** sport, fitness, energetic social, colorful products. It adds contrast, saturation and sharpening, so avoid it on faces.
- **`cinematic`:** premium brands, real estate, fashion, storytelling ads and montage: teal shadows, warm highlights, gentle contrast.
- **`black_and_white`:** only when the brief or brand asks for it.
- **`vintage`:** nostalgia, retro products, throwback content.
- On overcast or flat outdoor light, `punchy` overshoots (asphalt turns blue-green, leaves go fluorescent): use `natural` with contrast 1.05 to 1.1 instead.

**Protect skin tones**
- Keep skin natural above everything. Strong looks push faces red, orange or grey. For talking heads, see the limits in talking-head.
- Keep saturation at or below about 1.2 on any shot with people.
- Dark is fine as a mood as long as the person stays lit: lift them with `adjust` rather than darkening everything.

**Check before you finish**
- Blacks still black, skies and white shirts not clipped, faces at a similar brightness everywhere, no shot that jumps out in color.
- If a shot can't be saved, say so in `open_questions` rather than over-correcting it.
