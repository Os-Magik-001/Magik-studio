import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAGIK, brandFrom, type Brand } from "@/lib/brand";

// Which studio's brand this request shows: the agency whose record lists the address the person
// came in by (agencies.domains). An address no agency claims shows the first agency, Magik.

// A second brand to look at the app in, without a second agency. Development only.
const PREVIEW: Brand = brandFrom({
  slug: "northlight",
  name: "Northlight",
  brand: { studio: "Northlight Studio", accent: "#4f8cff" },
});

async function brandForHost(host: string): Promise<Brand> {
  "use cache";
  cacheLife("hours");
  cacheTag("brand");
  try {
    const { data, error } = await createAdminClient().from("agencies").select("slug, name, brand").contains("domains", [host]).limit(1).maybeSingle();
    if (error || !data) return MAGIK;
    return brandFrom(data);
  } catch {
    return MAGIK;
  }
}

export const getBrand = cache(async (): Promise<Brand> => {
  if (process.env.NODE_ENV !== "production" && process.env.BRAND_PREVIEW === "1") return PREVIEW;
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
  if (!host) return MAGIK;
  return brandForHost(host);
});
