import {
  Archivo_Black,
  Bebas_Neue,
  Cormorant_Garamond,
  DM_Serif_Display,
  Montserrat,
  Playfair_Display,
  Poppins,
  Space_Grotesk,
  Syne,
  Unbounded,
} from "next/font/google";
import { LOGO_FONTS, type LogoFontId } from "@/lib/logo-templates";

// The logo creator's ten typefaces (LOGO_FONTS), self-hosted by next/font in the one weight
// each is offered in. The canvas draws with `font.style.fontFamily`; a font only downloads
// once something asks for it, so the creator calls loadLogoFonts before it draws.

const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], display: "swap", variable: "--logo-font-bebas" });
const archivo = Archivo_Black({ weight: "400", subsets: ["latin"], display: "swap", variable: "--logo-font-archivo" });
const montserrat = Montserrat({ weight: "800", subsets: ["latin"], display: "swap", variable: "--logo-font-montserrat" });
const space = Space_Grotesk({ weight: "700", subsets: ["latin"], display: "swap", variable: "--logo-font-space" });
const unbounded = Unbounded({ weight: "700", subsets: ["latin"], display: "swap", variable: "--logo-font-unbounded" });
const syne = Syne({ weight: "800", subsets: ["latin"], display: "swap", variable: "--logo-font-syne" });
const poppins = Poppins({ weight: "600", subsets: ["latin"], display: "swap", variable: "--logo-font-poppins" });
const playfair = Playfair_Display({ weight: "700", subsets: ["latin"], display: "swap", variable: "--logo-font-playfair" });
const dmserif = DM_Serif_Display({ weight: "400", subsets: ["latin"], display: "swap", variable: "--logo-font-dmserif" });
const cormorant = Cormorant_Garamond({ weight: "600", subsets: ["latin"], display: "swap", variable: "--logo-font-cormorant" });

export const LOGO_FONT_FACES = {
  bebas,
  archivo,
  montserrat,
  space,
  unbounded,
  syne,
  poppins,
  playfair,
  dmserif,
  cormorant,
} satisfies Record<LogoFontId, { className: string; variable: string; style: { fontFamily: string } }>;

// Put on a wrapper: it declares --logo-font-<id> for each font without changing the wrapper's
// own font, so CSS can use any of them.
export const logoFontsClassName = Object.values(LOGO_FONT_FACES)
  .map((f) => f.variable)
  .join(" ");

const WEIGHT = Object.fromEntries(LOGO_FONTS.map((f) => [f.id, f.weight])) as Record<LogoFontId, number>;

// The CSS font-family list for a logo font (with next/font's metric-matched fallback).
export function logoFontFamily(id: LogoFontId) {
  return LOGO_FONT_FACES[id].style.fontFamily;
}

export function logoFontWeight(id: LogoFontId) {
  return WEIGHT[id];
}

// CSS for a picker option set in its own typeface.
export function logoFontStyle(id: LogoFontId) {
  return { fontFamily: logoFontFamily(id), fontWeight: WEIGHT[id] };
}

// ---------------------------------------------------------------- loading
// Canvas text doesn't wait for web fonts. Previews subscribe to this version number and redraw
// whenever a font finishes loading.

let version = 0;
const listeners = new Set<() => void>();
let watching = false;

function bump() {
  version += 1;
  for (const l of listeners) l();
}

export function subscribeLogoFonts(listener: () => void) {
  listeners.add(listener);
  if (!watching && typeof document !== "undefined" && document.fonts) {
    watching = true;
    document.fonts.addEventListener("loadingdone", bump);
  }
  return () => {
    listeners.delete(listener);
  };
}

export function logoFontsVersion() {
  return version;
}

// Loads the faces needed to draw `text` in these fonts (the latin set, plus latin-ext when the
// text needs it). Resolves once they're ready; already-loaded fonts resolve at once.
export async function loadLogoFonts(ids: readonly LogoFontId[], text = "") {
  if (typeof document === "undefined" || !document.fonts) return;
  const sample = `Aa${text}`;
  const pending = [...new Set(ids)]
    .map((id) => `${WEIGHT[id]} 64px ${logoFontFamily(id)}`)
    .filter((font) => {
      try {
        return !document.fonts.check(font, sample);
      } catch {
        return true;
      }
    });
  if (!pending.length) return;
  await Promise.all(pending.map((font) => document.fonts.load(font, sample).catch(() => [])));
  bump();
}
