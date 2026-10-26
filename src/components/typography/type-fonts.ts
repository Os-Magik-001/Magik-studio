import {
  Anton,
  Archivo_Black,
  Barlow_Condensed,
  Bebas_Neue,
  Bodoni_Moda,
  Cormorant_Garamond,
  DM_Serif_Display,
  Instrument_Serif,
  Inter,
  Manrope,
  Montserrat,
  Oswald,
  Playfair_Display,
  Poppins,
  Space_Grotesk,
  Unbounded,
} from "next/font/google";
import { TYPE_FONTS, type FontRole } from "@/lib/typography";

// The edit fonts (TYPE_FONTS), self-hosted by next/font in the weight and style each is drawn in,
// so the picker and its preview show what the engine will draw. Nothing is preloaded: a font
// downloads when the picker first shows it.

const anton = Anton({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
const oswald = Oswald({ weight: "700", subsets: ["latin"], display: "swap", preload: false });
const barlow = Barlow_Condensed({ weight: "800", subsets: ["latin"], display: "swap", preload: false });
const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
const archivo = Archivo_Black({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
const montserrat = Montserrat({ weight: ["600", "900"], subsets: ["latin"], display: "swap", preload: false });
const poppins = Poppins({ weight: ["600", "900"], subsets: ["latin"], display: "swap", preload: false });
const unbounded = Unbounded({ weight: "800", subsets: ["latin"], display: "swap", preload: false });
const bodoni = Bodoni_Moda({ weight: "600", style: "italic", subsets: ["latin"], display: "swap", preload: false });
const playfair = Playfair_Display({ weight: "700", style: "italic", subsets: ["latin"], display: "swap", preload: false });
const dmserif = DM_Serif_Display({ weight: "400", style: "italic", subsets: ["latin"], display: "swap", preload: false });
const instrument = Instrument_Serif({ weight: "400", style: "italic", subsets: ["latin"], display: "swap", preload: false });
const cormorant = Cormorant_Garamond({ weight: "600", style: "italic", subsets: ["latin"], display: "swap", preload: false });
const inter = Inter({ weight: "600", subsets: ["latin"], display: "swap", preload: false });
const manrope = Manrope({ weight: "700", subsets: ["latin"], display: "swap", preload: false });
const space = Space_Grotesk({ weight: "600", subsets: ["latin"], display: "swap", preload: false });

type Face = { style: { fontFamily: string } };
const FACES: Record<FontRole, Record<string, Face>> = {
  title: { anton, oswald, barlow, bebas, archivo, montserrat, poppins, unbounded },
  accent: { bodoni, playfair, dmserif, instrument, cormorant },
  text: { montserrat, inter, poppins, manrope, space },
};

// CSS for text set in a role's font, as the engine draws it.
export function typeFontStyle(role: FontRole, id: string) {
  const font = TYPE_FONTS[role].find((f) => f.id === id) ?? TYPE_FONTS[role][0];
  return {
    fontFamily: FACES[role][font.id].style.fontFamily,
    fontWeight: font.weight,
    fontStyle: font.italic ? "italic" : "normal",
  } as const;
}
