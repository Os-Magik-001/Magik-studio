import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { cacheLife, cacheTag } from "next/cache";
import { createPlatformClient } from "@/lib/supabase/admin";
import { MAGIK, brandFrom, type Brand } from "@/lib/brand";

// Which agency a request is for: the one whose record lists the address the person came in by
// (agencies.domains). An address no agency claims is the first agency's, Magik. The agency
// decides the brand a person sees and the rows the server may touch (@/lib/supabase/agency).

export type Agency = { id: string; slug: string; brand: Brand };

// A second brand to look at the app in, without a second agency. Development only: the rows
// are still the first agency's.
const PREVIEW: Brand = brandFrom({
  slug: "northlight",
  name: "Northlight",
  brand: { studio: "Northlight Studio", accent: "#4f8cff" },
});

// Remembered for a while; a failed lookup throws, so it is never remembered.
async function findAgency(host: string): Promise<Agency> {
  "use cache";
  cacheLife("hours");
  cacheTag("brand");
  const db = createPlatformClient();
  const pick = "id, slug, name, brand";
  const { data: mine } = host ? await db.from("agencies").select(pick).contains("domains", [host]).limit(1).maybeSingle() : { data: null };
  const { data, error } = mine ? { data: mine, error: null } : await db.from("agencies").select(pick).eq("slug", MAGIK.slug).maybeSingle();
  if (!data) throw new Error(error?.message ?? "No agency.");
  return { id: data.id, slug: data.slug, brand: brandFrom(data) };
}

const agencyForHost = (host: string) => findAgency(host).catch(() => null);

const requestHost = async () => {
  const h = await headers();
  return (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
};

// The agency of this request. Without one the app can't tell whose rows to read, so it stops.
export const getAgency = cache(async (): Promise<Agency> => {
  const agency = await agencyForHost(await requestHost());
  if (!agency) throw new Error("No agency for this address.");
  return agency;
});

export const getBrand = cache(async (): Promise<Brand> => {
  if (process.env.NODE_ENV !== "production" && process.env.BRAND_PREVIEW === "1") return PREVIEW;
  return (await agencyForHost(await requestHost()))?.brand ?? MAGIK;
});
