import { z } from "zod";

// The brand an agency's people see: the app's name, the studio's name, its logos, its accent
// colour and its default wallpaper. Nothing a user reads or looks at names a studio directly;
// it all comes from here (resolved per request in @/lib/brand-server, shared with client
// components through @/components/brand).

export type Brand = {
  slug: string;
  // The app's name: "Magik OS".
  product: string;
  // The name set in capitals in the menu bar; the second part takes the accent colour.
  wordmark: [string, string];
  // The business: "Magik Studio".
  studio: string;
  // The name in a sentence: "your website with Magik".
  short: string;
  // What the studio belongs to, when it says so ("Magik Management").
  parent: string | null;
  // Addresses of the logo files. Without a mark, the studio's initials are drawn instead.
  logos: { mark: string | null; horizontal: string | null; horizontalDark: string | null };
  // The browser tab's icon. Without one, the studio's initials are drawn (/brand-icon.svg).
  icon: string | null;
  appleIcon: string | null;
  // The system accent, #RRGGBB.
  accent: string;
  // The wallpaper before a person picks one (an id of @/lib/wallpapers).
  wallpaper: string;
  // Motchi, the desktop's assistant.
  mascot: boolean;
};

export const MAGIK: Brand = {
  slug: "magik",
  product: "Magik OS",
  wordmark: ["MAGIK", "OS"],
  studio: "Magik Studio",
  short: "Magik",
  parent: "Magik Management",
  logos: {
    mark: "/brand/magik-monogram.svg",
    horizontal: "/brand/magik-horizontal.svg",
    horizontalDark: "/brand/magik-horizontal-dark.svg",
  },
  icon: "/brand/magik-icon.png",
  appleIcon: "/brand/magik-apple-icon.png",
  accent: "#f6d43a",
  wallpaper: "magik",
  mascot: true,
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const FILE = z.string().regex(/^(\/|https:\/\/)[^\s"'()<>]+$/).max(500);
const NAME = z.string().trim().min(1).max(60);

// What an agency's record may set (agencies.brand). Anything left out is worked out from its name.
export const BrandRecord = z
  .object({
    product: NAME,
    wordmark: z.tuple([z.string().trim().max(24), z.string().trim().max(12)]),
    studio: NAME,
    short: NAME,
    parent: NAME.nullable(),
    logos: z.object({ mark: FILE.nullable(), horizontal: FILE.nullable(), horizontalDark: FILE.nullable() }).partial(),
    icon: FILE.nullable(),
    appleIcon: FILE.nullable(),
    accent: z.string().regex(HEX),
    wallpaper: z.string().regex(/^[a-z0-9-]{1,30}$/),
    mascot: z.boolean(),
  })
  .partial();

// An agency's brand: its record over plain defaults built from its name. The first agency keeps
// Magik's own brand underneath.
export function brandFrom(agency: { slug: string; name: string; brand: unknown }): Brand {
  const parsed = BrandRecord.safeParse(agency.brand ?? {});
  const set = parsed.success ? parsed.data : {};
  const base: Brand =
    agency.slug === MAGIK.slug
      ? MAGIK
      : {
          slug: agency.slug,
          product: `${agency.name} OS`,
          wordmark: [agency.name.toUpperCase(), "OS"],
          studio: agency.name,
          short: agency.name,
          parent: null,
          logos: { mark: null, horizontal: null, horizontalDark: null },
          icon: null,
          appleIcon: null,
          accent: "#0a84ff",
          wallpaper: "graphite",
          mascot: false,
        };
  return { ...base, ...set, slug: agency.slug, logos: { ...base.logos, ...set.logos } };
}

const channels = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};

// "246 212 58": for rgb(var(--accent-rgb) / 0.2) in the CSS.
export const accentRgb = (brand: Brand) => channels(brand.accent).join(" ");

// Text set on the accent: black on a light colour, white on a dark one.
export function accentInk(brand: Brand) {
  const [r, g, b] = channels(brand.accent).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#000000" : "#ffffff";
}

// The variables the CSS draws the brand from, set on <html>.
export function brandVars(brand: Brand): Record<string, string> {
  return {
    "--accent": brand.accent,
    "--accent-rgb": accentRgb(brand),
    "--accent-ink": accentInk(brand),
    "--wall-default": `url("/wallpapers/${brand.wallpaper}.webp")`,
  };
}

// The letters drawn when a studio has no logo yet.
export const brandInitials = (brand: Brand) =>
  brand.short
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

// Sentences written once for every studio: {product}, {studio} and {short} take its names.
export const brandText = (text: string, brand: Brand) =>
  text.replaceAll("{product}", brand.product).replaceAll("{studio}", brand.studio).replaceAll("{short}", brand.short);
