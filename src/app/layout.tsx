import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

// San Francisco is the system font on Apple devices; Inter stands in everywhere else.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Magik OS", template: "%s · Magik OS" },
  description: "The workspace that runs Magik Studio: shoot, edit with Claude, review and approve.",
};

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "dark" };

// Runs before the first paint: a page inside a desktop window drops its own background, and the
// desktop shows the wallpaper the person picked.
const EMBED = `try{if(window.top!==window.self)document.documentElement.classList.add("embedded")}catch(e){document.documentElement.classList.add("embedded")}try{var w=localStorage.getItem("magik.wallpaper");if(w)document.documentElement.dataset.wallpaper=w}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: EMBED }} />
      </head>
      <body className={`${inter.variable} ${cormorant.variable} ${geistMono.variable} min-h-dvh antialiased`}>
        {children}
      </body>
    </html>
  );
}
