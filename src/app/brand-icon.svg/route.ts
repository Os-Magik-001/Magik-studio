import { accentInk, brandInitials } from "@/lib/brand";
import { getBrand } from "@/lib/brand-server";

// The browser tab's icon for a studio that hasn't given one: its initials on its accent colour.
export async function GET() {
  const brand = await getBrand();
  const letters = brandInitials(brand).replace(/[^A-Z0-9]/g, "") || "•";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${brand.accent}"/><text x="32" y="43" text-anchor="middle" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="${letters.length > 1 ? 28 : 34}" font-weight="700" fill="${accentInk(brand)}">${letters}</text></svg>`;
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=3600" } });
}
