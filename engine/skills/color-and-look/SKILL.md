---
name: color-and-look
description: Choosing the video's look and fixing exposure and color shot by shot
formats: all
---

**Pick one look for the whole video**
- Derive it from the brand and the content, not from a trend:
  - **`natural`:** the default. Use it for talking heads, education, food accuracy, clinical or technical brands, and whenever the footage already looks good.
  - **`warm`:** food, coffee, hospitality, family, lifestyle, stories, golden-hour footage.
  - **`cool`:** tech, clean products, wellness, winter, night.
  - **`punchy`:** sport, fitness, energetic social, colorful products. It adds contrast, saturation and sharpening, so avoid it on faces.
  - **`cinematic`:** premium brands, fashion, storytelling ads and montage. It gives teal shadows, warm highlights and gentle contrast.
  - **`black_and_white`:** only when the brief or brand asks for it.
  - **`vintage`:** nostalgia, retro products, throwback content.
- When the brand style rules mention a mood like warm, moody or clean, follow them.
- On overcast or flat outdoor light, `punchy` overshoots: asphalt turns blue-green and leaves go fluorescent. Use `natural` with a little contrast instead.

**Protect skin tones**
- When people are on screen, keep skin natural above everything else. Strong looks push faces red, orange or grey. For talking heads, see the limits in talking-head.
- Keep saturation at or below about 1.2 on any shot with people.
- Dark is fine as a mood, as long as the person stays lit. Lift them with `adjust` rather than darkening everything.

**Make the shots match**
- A shot that is visibly brighter, darker or a different color from its neighbors is a defect. Fix it with `adjust`, in small steps of about 0.05:
  - **Underexposed:** brightness +0.05 to +0.12. Add contrast 1.05 if it also looks flat.
  - **Overexposed or blown out:** brightness -0.05 to -0.1, and keep contrast at or under 1.04 so highlights don't clip further.
  - **Flat, re-compressed or log-looking:** contrast 1.1 to 1.2, saturation 1.1 to 1.2.
  - **Oversaturated, like neon skin or garish signs:** saturation 0.8 to 0.9.
- Corrections should be gentle. Compression damage can be softened but not undone, and pushing hard makes noise and banding worse.
- Leave correct shots neutral: brightness 0, contrast 1, saturation 1.
- If a shot can't be saved, say so in `open_questions` rather than over-correcting it.
