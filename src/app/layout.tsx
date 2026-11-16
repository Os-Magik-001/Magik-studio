import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { brandVars } from "@/lib/brand";
import { getBrand } from "@/lib/brand-server";
import { BrandProvider } from "@/components/brand";

// San Francisco is the system font on Apple devices; Inter stands in everywhere else.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// The studio's brand comes from the address of the request, so the document waits for it.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return {
    title: { default: brand.product, template: `%s · ${brand.product}` },
    description: `The workspace that runs ${brand.studio}: plan, script, shoot, edit, review and approve.`,
    icons: { icon: brand.icon ?? "/brand-icon.svg", apple: brand.appleIcon ?? brand.icon ?? "/brand-icon.svg" },
  };
}

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "dark" };

// Runs before the first paint, so the look the person picked (Settings > Appearance: wallpaper,
// dimming, Dock, windows) shows at once. components/shell/look.ts writes what it reads.
const WALLPAPER = `try{var h=document.documentElement,s=JSON.parse(localStorage.getItem("magik.look")||"null");if(s){var r=s.r||{};if(r.id)h.dataset.wallpaper=r.id;if(r.url)h.style.setProperty("--wall-url",r.url);if(r.base)h.style.setProperty("--wall-base",r.base);if(r.glow)h.style.setProperty("--wall-glow",r.glow);h.style.setProperty("--wall-dim",String((s.dim||0)/100));h.dataset.dock=s.dock||"large";h.dataset.labels=s.labels===false?"off":"on";h.dataset.solid=s.solid?"1":"0"}else{var w=localStorage.getItem("magik.wallpaper");if(w)h.dataset.wallpaper=w}}catch(e){}`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const brand = await getBrand();
  return (
    <html lang="en" data-brand={brand.slug} data-wall={brand.wallpaper} style={brandVars(brand) as React.CSSProperties} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: WALLPAPER }} />
      </head>
      <body className={`${inter.variable} ${cormorant.variable} ${geistMono.variable} min-h-dvh antialiased`}>
        <BrandProvider brand={brand}>{children}</BrandProvider>
      </body>
    </html>
  );
}
