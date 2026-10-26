// Fonts and colors for an edit: the editor picks them before launching it, the way a brand
// guide sets them (three typefaces with three jobs, and the colors of each). They're saved on
// the video, and the edit engine sets every caption, title, card and the end card in them
// (engine/src/typefaces.ts has the same ids, with the font files).

export const FONT_ROLES = [
  { id: "title", label: "Titles", hint: "Big headlines, always in capitals" },
  { id: "accent", label: "Accent words", hint: "A word or two of a title, in italic" },
  { id: "text", label: "Text", hint: "Captions and small text" },
] as const;
export type FontRole = (typeof FONT_ROLES)[number]["id"];

export type TypeFont = { id: string; name: string; weight: number; italic?: boolean };

export const TYPE_FONTS: Record<FontRole, readonly TypeFont[]> = {
  title: [
    { id: "anton", name: "Anton", weight: 400 },
    { id: "oswald", name: "Oswald", weight: 700 },
    { id: "barlow", name: "Barlow Condensed", weight: 800 },
    { id: "bebas", name: "Bebas Neue", weight: 400 },
    { id: "archivo", name: "Archivo Black", weight: 400 },
    { id: "montserrat", name: "Montserrat", weight: 900 },
    { id: "poppins", name: "Poppins", weight: 900 },
    { id: "unbounded", name: "Unbounded", weight: 800 },
  ],
  accent: [
    { id: "bodoni", name: "Bodoni Moda", weight: 600, italic: true },
    { id: "playfair", name: "Playfair Display", weight: 700, italic: true },
    { id: "dmserif", name: "DM Serif Display", weight: 400, italic: true },
    { id: "instrument", name: "Instrument Serif", weight: 400, italic: true },
    { id: "cormorant", name: "Cormorant Garamond", weight: 600, italic: true },
  ],
  text: [
    { id: "montserrat", name: "Montserrat", weight: 600 },
    { id: "inter", name: "Inter", weight: 600 },
    { id: "poppins", name: "Poppins", weight: 600 },
    { id: "manrope", name: "Manrope", weight: 700 },
    { id: "space", name: "Space Grotesk", weight: 600 },
  ],
};

export const COLOR_ROLES = [
  { id: "title", label: "Titles" },
  { id: "accent", label: "Accent words" },
  { id: "text", label: "Text" },
  { id: "highlight", label: "Highlight", hint: "Highlighted words, lines, arrows" },
  { id: "background", label: "Background", hint: "Boxes, cards, the end card" },
] as const;
export type ColorRole = (typeof COLOR_ROLES)[number]["id"];

export type Typography = { fonts: Record<FontRole, string>; colors: Record<ColorRole, string> };

export const TYPE_PRESETS: { id: string; name: string; typography: Typography }[] = [
  {
    id: "ocean",
    name: "Ocean",
    typography: {
      fonts: { title: "anton", accent: "bodoni", text: "montserrat" },
      colors: { title: "#168BDF", accent: "#F8F7F2", text: "#F8F7F2", highlight: "#FFD83D", background: "#103C62" },
    },
  },
  {
    id: "emerald",
    name: "Emerald",
    typography: {
      fonts: { title: "anton", accent: "playfair", text: "inter" },
      colors: { title: "#0FA67A", accent: "#FFFFFF", text: "#FFFFFF", highlight: "#0FA67A", background: "#083428" },
    },
  },
  {
    id: "gold",
    name: "Gold",
    typography: {
      fonts: { title: "bebas", accent: "dmserif", text: "poppins" },
      colors: { title: "#FFFFFF", accent: "#E9C46A", text: "#FFFFFF", highlight: "#E9C46A", background: "#141413" },
    },
  },
  {
    id: "punch",
    name: "Punch",
    typography: {
      fonts: { title: "archivo", accent: "instrument", text: "inter" },
      colors: { title: "#FFFFFF", accent: "#FFFFFF", text: "#FFFFFF", highlight: "#FF4D2E", background: "#111111" },
    },
  },
  {
    id: "blush",
    name: "Blush",
    typography: {
      fonts: { title: "montserrat", accent: "cormorant", text: "manrope" },
      colors: { title: "#F6E7D8", accent: "#F6E7D8", text: "#FFFFFF", highlight: "#E8A598", background: "#3B2A26" },
    },
  },
];

const HEX = /^#[0-9A-F]{6}$/;

export function sameTypography(a: Typography, b: Typography) {
  return FONT_ROLES.every((r) => a.fonts[r.id] === b.fonts[r.id]) && COLOR_ROLES.every((r) => a.colors[r.id] === b.colors[r.id]);
}

// A saved or posted choice, checked: known fonts and #RRGGBB colors only, else null.
export function parseTypography(value: unknown): Typography | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { fonts?: Record<string, unknown>; colors?: Record<string, unknown> };
  const fonts = {} as Typography["fonts"];
  for (const r of FONT_ROLES) {
    const id = v.fonts?.[r.id];
    if (typeof id !== "string" || !TYPE_FONTS[r.id].some((f) => f.id === id)) return null;
    fonts[r.id] = id;
  }
  const colors = {} as Typography["colors"];
  for (const r of COLOR_ROLES) {
    const c = v.colors?.[r.id];
    if (typeof c !== "string" || !HEX.test(c.toUpperCase())) return null;
    colors[r.id] = c.toUpperCase();
  }
  return { fonts, colors };
}

// ---------------------------------------------------------------- from the brand kit

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lightness = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
};
const saturation = (hex: string) => {
  const [r, g, b] = rgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  return max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
};
// A color mixed toward black: a deep shade of the brand color for boxes and cards.
const deepen = (hex: string, keep: number) =>
  `#${rgb(hex)
    .map((c) => Math.round(c * keep * 255).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();

// A first choice made from the client's brand kit: its fonts where they fit a role, its
// strongest color for titles and highlights, its darkest (or a deep shade) for backgrounds.
export function typographyFromKit(kit: { fonts: string[]; colors: string[] } | null): Typography {
  const base = TYPE_PRESETS[0].typography;
  const named = (role: FontRole) => {
    const names = (kit?.fonts ?? []).map((n) => n.trim().toLowerCase());
    return TYPE_FONTS[role].find((f) => names.includes(f.name.toLowerCase()))?.id;
  };
  const colors = (kit?.colors ?? []).map((c) => c.trim().toUpperCase()).filter((c) => HEX.test(c));
  if (!colors.length && !named("title") && !named("accent") && !named("text")) {
    return { fonts: base.fonts, colors: { title: "#FFFFFF", accent: "#FFFFFF", text: "#FFFFFF", highlight: "#F6D43A", background: "#141413" } };
  }
  const vivid = [...colors].filter((c) => lightness(c) > 0.2 && lightness(c) < 0.9).sort((a, b) => saturation(b) - saturation(a));
  const main = vivid[0] ?? colors.find((c) => lightness(c) > 0.2) ?? "#FFFFFF";
  const dark = colors.filter((c) => lightness(c) <= 0.2).sort((a, b) => lightness(a) - lightness(b))[0];
  return {
    fonts: { title: named("title") ?? base.fonts.title, accent: named("accent") ?? base.fonts.accent, text: named("text") ?? base.fonts.text },
    colors: {
      title: main,
      accent: "#FFFFFF",
      text: "#FFFFFF",
      highlight: vivid.find((c) => c !== main && lightness(c) >= 0.45) ?? main,
      background: dark ?? (main === "#FFFFFF" ? "#141413" : deepen(main, 0.28)),
    },
  };
}
