import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getBrand } from "@/lib/brand-server";
import { createPlatformClient } from "@/lib/supabase/admin";
import { WindowPage } from "@/components/desktop/window-page";
import { SettingsShell } from "@/components/settings/settings-shell";
import { BrandingForm } from "./branding-form";

export const metadata: Metadata = { title: "Branding" };

// Settings > Branding, for the studio manager: the names, logos, accent colour and wallpaper
// that everyone in the studio and its clients see.
export default async function BrandingPage() {
  const viewer = await requireRole("admin");
  const brand = await getBrand();
  const { data: agency } = await createPlatformClient().from("agencies").select("brand").eq("id", viewer.agencyId).maybeSingle();
  const stored = (agency?.brand ?? {}) as { logos?: Record<string, unknown>; icon?: unknown };
  // Which files are the studio's own (they can be taken away), not the ones it started with.
  const own = {
    mark: typeof stored.logos?.mark === "string",
    horizontal: typeof stored.logos?.horizontal === "string",
    horizontalDark: typeof stored.logos?.horizontalDark === "string",
    icon: typeof stored.icon === "string",
  };
  return (
    <WindowPage>
      <SettingsShell role={viewer.role} platform={viewer.platformAdmin} active="branding" title="Branding" description={`How ${brand.studio} looks to its team and its clients: on the sign-in page, the desktop, scripts and invoices.`}>
        <BrandingForm brand={brand} own={own} customized={Object.keys(stored).length > 0} />
      </SettingsShell>
    </WindowPage>
  );
}
