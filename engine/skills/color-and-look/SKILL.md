---
name: color-and-look
description: Choosing the video's look and fixing exposure and color shot by shot
formats: all
---

**Pick one look for the whole video**
- Derive it from the brand and the footage, not from a trend:
  - **`natural`:** the safe default. Use it whenever the footage already looks good, or the brand is clinical, technical or food-accurate.
  - **`warm`:** food, coffee, hospitality, family, lifestyle, golden-hour footage.
  - **`cool`:** tech, clean products, wellness, winter, night.
  - **`punchy`:** sport, fitness, energetic social content, colorful products. It adds contrast, saturation and a little sharpening.
  - **`cinematic`:** premium brands, fashion, storytelling ads. It gives teal shadows, warm highlights and gentle contrast.
  - **`black_and_white`:** only when the brief or brand asks for it, or for a deliberate artistic piece.
  - **`vintage`:** nostalgia, retro products, throwback content.
- When the brand style rules mention a mood like warm, moody or clean, follow them.

**Protect skin tones**
- When people are on screen, keep skin natural above everything else. Dark, crushed or heavily tinted grades push faces red or grey.
- Dark is fine as a mood, as long as the person stays lit. Lift them with `adjust` rather than darkening the whole look.
- Black and white rarely beats color for people on camera. Use it only when asked.

**Make the shots match**
- A shot that is visibly brighter, darker or a different color from its neighbors is a defect. Fix it with `adjust`:
  - **Underexposed:** brightness +0.05 to +0.12. Add contrast 1.05 if it also looks flat.
  - **Overexposed or washed out:** brightness -0.05 to -0.1, contrast 1.05 to 1.1.
  - **Flat, re-compressed or log-looking:** contrast 1.1 to 1.2, saturation 1.1 to 1.25.
  - **Oversaturated, like neon skin or garish signs:** saturation 0.8 to 0.9.
- Corrections should be gentle. Compression damage can be softened but not undone, and pushing hard makes noise and banding worse.
- Leave correct shots neutral: brightness 0, contrast 1, saturation 1.
- If a shot can't be saved, say so in `open_questions` rather than over-correcting it.
