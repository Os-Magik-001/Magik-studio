import type { Metadata } from "next";

export const metadata: Metadata = { title: { absolute: "Magik OS" } };

// "/": the desktop itself, no window in front. Home lives in the layout, under every window.
export default function DesktopPage() {
  return null;
}
