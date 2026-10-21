// The logo creator's building blocks: a client without a brand builds a logo from these
// templates in the setup assistant. Suggestions (written by Claude when it's connected, from
// these lists) and the client's edits are all LogoSpecs; the browser draws them on a canvas
// and saves a transparent PNG as the brand's logo.

export const LOGO_FONTS = [
  { id: "bebas", name: "Bebas Neue", weight: 400, feel: "bold, condensed, sporty, urban" },
  { id: "archivo", name: "Archivo Black", weight: 400, feel: "heavy, confident, modern" },
  { id: "montserrat", name: "Montserrat", weight: 800, feel: "clean, geometric, versatile" },
  { id: "space", name: "Space Grotesk", weight: 700, feel: "techy, modern, friendly" },
  { id: "unbounded", name: "Unbounded", weight: 700, feel: "wide, playful, contemporary" },
  { id: "syne", name: "Syne", weight: 800, feel: "artsy, editorial, distinctive" },
  { id: "poppins", name: "Poppins", weight: 600, feel: "rounded, warm, approachable" },
  { id: "playfair", name: "Playfair Display", weight: 700, feel: "elegant, premium, editorial serif" },
  { id: "dmserif", name: "DM Serif Display", weight: 400, feel: "classic, luxurious serif" },
  { id: "cormorant", name: "Cormorant Garamond", weight: 600, feel: "refined, delicate, high-end serif" },
] as const;

export const LOGO_TEMPLATES = [
  { id: "wordmark", name: "Wordmark", hint: "The name on its own, with an optional tagline under it" },
  { id: "underline", name: "Underline", hint: "The name over a short accent bar" },
  { id: "monogram-circle", name: "Badge", hint: "Initials in a circle, the name beside it" },
  { id: "monogram-tile", name: "Tile", hint: "Initials in a rounded square, the name under it" },
  { id: "stacked", name: "Stacked", hint: "A symbol above the name and the tagline" },
  { id: "emblem", name: "Emblem", hint: "A round seal: the name along the top, the tagline along the bottom" },
] as const;

export const LOGO_SYMBOLS = [
  { id: "none", name: "None" },
  { id: "spark", name: "Spark" },
  { id: "star", name: "Star" },
  { id: "diamond", name: "Diamond" },
  { id: "circle", name: "Ring" },
  { id: "bolt", name: "Bolt" },
  { id: "leaf", name: "Leaf" },
  { id: "wave", name: "Wave" },
  { id: "crown", name: "Crown" },
  { id: "heart", name: "Heart" },
  { id: "scissors", name: "Scissors" },
  { id: "camera", name: "Camera" },
  { id: "coffee", name: "Cup" },
  { id: "home", name: "House" },
] as const;

export type LogoFontId = (typeof LOGO_FONTS)[number]["id"];
export type LogoTemplateId = (typeof LOGO_TEMPLATES)[number]["id"];
export type LogoSymbolId = (typeof LOGO_SYMBOLS)[number]["id"];

export type LogoSpec = {
  template: LogoTemplateId;
  // The brand name as it appears in the logo, and an optional line under it.
  name: string;
  tagline: string;
  // 1 to 3 letters, for the badge, tile and emblem templates.
  initials: string;
  font: LogoFontId;
  uppercase: boolean;
  // Letter spacing in em, -0.05 to 0.4.
  tracking: number;
  // #RRGGBB. primary: the name; accent: symbol, bar, badge; background: a solid ground, or
  // null for a transparent logo.
  colors: { primary: string; accent: string; background: string | null };
  symbol: LogoSymbolId;
};

// Ready-made color pairs the creator offers next to the color pickers.
export const LOGO_PALETTES: { name: string; primary: string; accent: string }[] = [
  { name: "Magik", primary: "#111111", accent: "#F6D43A" },
  { name: "Ink & red", primary: "#141414", accent: "#E0222B" },
  { name: "Navy & gold", primary: "#14213D", accent: "#FCA311" },
  { name: "Forest", primary: "#1B4332", accent: "#95D5B2" },
  { name: "Terracotta", primary: "#3D2C29", accent: "#E07A5F" },
  { name: "Blush", primary: "#4A2C3A", accent: "#F4A6B8" },
  { name: "Ocean", primary: "#0B2545", accent: "#13C4A3" },
  { name: "Violet", primary: "#231942", accent: "#9F86C0" },
  { name: "Mono", primary: "#111111", accent: "#8A8A8A" },
  { name: "White on black", primary: "#FFFFFF", accent: "#F6D43A" },
];

const HEX = /^#[0-9a-f]{6}$/i;

export function initialsOf(name: string) {
  const words = name
    .replace(/[^\p{L}\p{N}\s&-]/gu, " ")
    .split(/[\s&-]+/)
    .filter(Boolean);
  const letters = words.length > 1 ? words.slice(0, 2).map((w) => w[0]) : [...(words[0] ?? "M")].slice(0, 2);
  return letters.join("").toUpperCase() || "M";
}

// A spec from anywhere (Claude, a saved logo, the editor) made safe to draw.
export function cleanSpec(raw: Partial<LogoSpec> | null | undefined, fallbackName: string): LogoSpec {
  const r = raw ?? {};
  const pick = <T extends { id: string }>(list: readonly T[], id: unknown, dflt: T["id"]) =>
    (list.some((x) => x.id === id) ? id : dflt) as T["id"];
  const name = (typeof r.name === "string" && r.name.trim() ? r.name.trim() : fallbackName).slice(0, 40);
  const colors = r.colors ?? { primary: "#111111", accent: "#F6D43A", background: null };
  return {
    template: pick(LOGO_TEMPLATES, r.template, "wordmark"),
    name,
    tagline: typeof r.tagline === "string" ? r.tagline.trim().slice(0, 48) : "",
    initials: (typeof r.initials === "string" && r.initials.trim() ? r.initials.trim() : initialsOf(name)).slice(0, 3).toUpperCase(),
    font: pick(LOGO_FONTS, r.font, "montserrat"),
    uppercase: typeof r.uppercase === "boolean" ? r.uppercase : true,
    tracking: typeof r.tracking === "number" && Number.isFinite(r.tracking) ? Math.max(-0.05, Math.min(0.4, r.tracking)) : 0.04,
    colors: {
      primary: HEX.test(colors.primary ?? "") ? colors.primary.toUpperCase() : "#111111",
      accent: HEX.test(colors.accent ?? "") ? colors.accent.toUpperCase() : "#F6D43A",
      background: colors.background && HEX.test(colors.background) ? colors.background.toUpperCase() : null,
    },
    symbol: pick(LOGO_SYMBOLS, r.symbol, "none"),
  };
}

// Suggestions without Claude: the six templates, each with a font and palette that suit the
// client's personality words. Deterministic, so the same answers give the same ideas.
export function suggestLogos(name: string, tone = ""): LogoSpec[] {
  const t = tone.toLowerCase();
  const premium = /premium|luxe|lux|elegant|élégant|classy|chic|haut|high/.test(t);
  const playful = /fun|playful|drôle|funny|young|jeune|friendly|warm|chaleur/.test(t);
  const bold = /bold|audac|strong|fort|street|urban|sport|energ/.test(t);
  const fonts: LogoFontId[] = premium
    ? ["playfair", "cormorant", "dmserif", "montserrat", "syne", "bebas"]
    : playful
      ? ["unbounded", "poppins", "syne", "space", "bebas", "playfair"]
      : bold
        ? ["bebas", "archivo", "unbounded", "montserrat", "space", "dmserif"]
        : ["montserrat", "bebas", "playfair", "space", "archivo", "dmserif"];
  const palettes = premium ? [2, 0, 7, 4, 8, 1] : playful ? [5, 6, 0, 3, 4, 2] : [0, 1, 2, 6, 3, 8];
  const symbols: LogoSymbolId[] = ["none", "none", "spark", "none", "star", "none"];
  return LOGO_TEMPLATES.map((tpl, i) => {
    const p = LOGO_PALETTES[palettes[i % palettes.length]];
    return cleanSpec(
      {
        template: tpl.id,
        name,
        tagline: "",
        font: fonts[i % fonts.length],
        uppercase: !["playfair", "cormorant", "dmserif"].includes(fonts[i % fonts.length]),
        tracking: ["bebas", "montserrat", "space"].includes(fonts[i % fonts.length]) ? 0.08 : 0.02,
        colors: { primary: p.primary, accent: p.accent, background: null },
        symbol: tpl.id === "stacked" ? "spark" : symbols[i],
      },
      name,
    );
  });
}
