import type { Metadata } from "next";
import { getBrand } from "@/lib/brand-server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: (await getBrand()).product } };
}

// "/": the desktop itself, no window in front. Home lives in the layout, under every window.
export default function DesktopPage() {
  return null;
}
