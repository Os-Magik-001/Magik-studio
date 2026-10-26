// The fonts and colors an editor picks for a video before launching its edit, the way a
// brand guide sets them: three typefaces with three jobs (titles, accent words, text) and
// five colors. The app lists the same ids (src/lib/typography.ts) and saves the choice on
// the video; every caption, title, card, the end card, the motion templates and the
// designed graphics are drawn with it.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { GlobalFonts } from "@napi-rs/canvas";
import { z } from "zod";

const FONTS_DIR = fileURLToPath(new URL("../assets/fonts", import.meta.url));

// The canvas can't choose a weight inside a variable font, so each choice has a static file
// at the weight it's drawn in (instances of the variable fonts, made with fontTools). Text
// faces have a heavier cut for word-by-word captions.
type Face = { family: string; file: string; weight: number; italic?: boolean; heavy?: string };
export const TYPEFACES = {
  title: {
    anton: { family: "Anton", file: "Anton-Regular.ttf", weight: 400 },
    oswald: { family: "Oswald", file: "Oswald-Bold.ttf", weight: 700 },
    barlow: { family: "Barlow Condensed", file: "BarlowCondensed-ExtraBold.ttf", weight: 800 },
    bebas: { family: "Bebas Neue", file: "BebasNeue-Regular.ttf", weight: 400 },
    archivo: { family: "Archivo Black", file: "ArchivoBlack-Regular.ttf", weight: 400 },
    montserrat: { family: "Montserrat", file: "Montserrat-Black.ttf", weight: 900 },
    poppins: { family: "Poppins", file: "Poppins-Black.ttf", weight: 900 },
    unbounded: { family: "Unbounded", file: "Unbounded-ExtraBold.ttf", weight: 800 },
  },
  accent: {
    bodoni: { family: "Bodoni Moda", file: "BodoniModa-SemiBoldItalic.ttf", weight: 600, italic: true },
    playfair: { family: "Playfair Display", file: "PlayfairDisplay-BoldItalic.ttf", weight: 700, italic: true },
    dmserif: { family: "DM Serif Display", file: "DMSerifDisplay-Italic.ttf", weight: 400, italic: true },
    instrument: { family: "Instrument Serif", file: "InstrumentSerif-Italic.ttf", weight: 400, italic: true },
    cormorant: { family: "Cormorant Garamond", file: "CormorantGaramond-SemiBoldItalic.ttf", weight: 600, italic: true },
  },
  text: {
    montserrat: { family: "Montserrat", file: "Montserrat-SemiBold.ttf", heavy: "Montserrat-ExtraBold.ttf", weight: 600 },
    inter: { family: "Inter", file: "Inter-SemiBold.ttf", heavy: "Inter-ExtraBold.ttf", weight: 600 },
    poppins: { family: "Poppins", file: "Poppins-SemiBold.ttf", heavy: "Poppins-ExtraBold.ttf", weight: 600 },
    manrope: { family: "Manrope", file: "Manrope-Bold.ttf", heavy: "Manrope-ExtraBold.ttf", weight: 700 },
    space: { family: "Space Grotesk", file: "SpaceGrotesk-SemiBold.ttf", heavy: "SpaceGrotesk-Bold.ttf", weight: 600 },
  },
} satisfies Record<string, Record<string, Face>>;

export type FontRole = keyof typeof TYPEFACES;
export const COLOR_ROLES = ["title", "accent", "text", "highlight", "background"] as const;
export type Typography = { fonts: Record<FontRole, string>; colors: Record<(typeof COLOR_ROLES)[number], string> };

const face = (role: FontRole, id: string): Face => (TYPEFACES[role] as Record<string, Face>)[id];
const alias = (role: FontRole, id: string, heavy = false) => `Magik ${role} ${id}${heavy ? " heavy" : ""}`;

for (const role of Object.keys(TYPEFACES) as FontRole[]) {
  for (const [id, f] of Object.entries(TYPEFACES[role]) as [string, Face][]) {
    GlobalFonts.registerFromPath(path.join(FONTS_DIR, f.file), alias(role, id));
    if (f.heavy) GlobalFonts.registerFromPath(path.join(FONTS_DIR, f.heavy), alias(role, id, true));
  }
}

const HEX = /^#[0-9a-f]{6}$/i;
const Stored = z.object({
  fonts: z.object({ title: z.string(), accent: z.string(), text: z.string() }),
  colors: z.object(Object.fromEntries(COLOR_ROLES.map((r) => [r, z.string().regex(HEX)])) as Record<(typeof COLOR_ROLES)[number], z.ZodString>),
});

// The video's saved choice, or null when the editor didn't make one (the engine then styles the
// edit itself, as before). A font this engine doesn't have yet falls back to its role's first.
export function parseTypography(raw: unknown, warn?: (msg: string) => void): Typography | null {
  if (raw == null) return null;
  const parsed = Stored.safeParse(raw);
  if (!parsed.success) {
    warn?.("fonts and colors: unreadable, the engine styles the edit itself");
    return null;
  }
  const fonts = { ...parsed.data.fonts };
  for (const role of Object.keys(TYPEFACES) as FontRole[]) {
    if (face(role, fonts[role])) continue;
    const first = Object.keys(TYPEFACES[role])[0];
    warn?.(`fonts and colors: no ${role} font "${fonts[role]}" here, using ${first}`);
    fonts[role] = first;
  }
  return { fonts, colors: { ...parsed.data.colors } };
}

// A canvas font string in the chosen face of a role.
export function canvasFont(t: Typography, role: FontRole, size: number, heavy = false) {
  const id = t.fonts[role];
  const f = face(role, id);
  return `${Math.round(size)}px "${alias(role, id, heavy && !!f.heavy)}", "Apple Color Emoji", sans-serif`;
}

// For the people writing about the edit (planner, motion designer): the faces by name.
export function describeTypography(t: Typography) {
  const f = (role: FontRole) => face(role, t.fonts[role]);
  return [
    `Titles: ${f("title").family} ${f("title").weight}, always in capitals, in ${t.colors.title}.`,
    `Accent words (one or two words of a title, for emotion): ${f("accent").family} italic ${f("accent").weight}, in ${t.colors.accent}.`,
    `Text (captions, subtitles, small text): ${f("text").family} ${f("text").weight}, in ${t.colors.text}.`,
    `Highlight (highlighted words, lines, underlines, arrows, circles): ${t.colors.highlight}.`,
    `Background (boxes, cards, the end card): ${t.colors.background}.`,
  ].join("\n");
}

// The choice as the browser pages get it: each role's family, weight, style and color.
export function pageTypography(t: Typography) {
  const role = (r: FontRole, color: string) => {
    const f = face(r, t.fonts[r]);
    return { family: f.family, weight: f.weight, style: f.italic ? "italic" : "normal", color };
  };
  return {
    title: role("title", t.colors.title),
    accent: role("accent", t.colors.accent),
    text: role("text", t.colors.text),
    highlight: t.colors.highlight,
    background: t.colors.background,
  };
}

// @font-face rules that point the motion templates' own families at the chosen faces. They use
// the same descriptors as the defaults in motion/index.html, and the last rule wins. The
// templates set headlines in heavy Magik Sans (800), so heavy weights take the title face.
export function motionFaces(t: Typography) {
  const title = face("title", t.fonts.title);
  const accent = face("accent", t.fonts.accent);
  const text = face("text", t.fonts.text);
  const rule = (family: string, file: string, extra = "") => `@font-face { font-family: "${family}"; src: url("/fonts/${file}");${extra} }`;
  return [
    rule("Magik Heavy", title.file),
    rule("Magik Display", title.file),
    ...[500, 600].map((w) => rule("Magik Sans", text.file, ` font-weight: ${w};`)),
    ...[800, 900].map((w) => rule("Magik Sans", title.file, ` font-weight: ${w};`)),
    rule("Magik Serif", accent.file),
    rule("Magik Elegant", accent.file),
    rule("Magik Elegant", accent.file, " font-style: italic;"),
  ].join("\n");
}

// Text that reads on a background: the wanted color when it contrasts enough, else black or white.
export function readableOn(background: string, wanted: string) {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  if (!HEX.test(background) || !HEX.test(wanted)) return wanted;
  const [a, b] = [lum(background), lum(wanted)].sort((x, y) => y - x);
  if ((a + 0.05) / (b + 0.05) >= 3) return wanted;
  return lum(background) > 0.4 ? "#141413" : "#FFFFFF";
}
