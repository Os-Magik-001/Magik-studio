import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { brandFrom } from "@/lib/brand";
import { createPlatformClient } from "@/lib/supabase/admin";
import { WindowPage } from "@/components/desktop/window-page";
import { LocalDate } from "@/components/local-date";
import { SettingsGroup, SettingsShell } from "@/components/settings/settings-shell";
import { DomainsForm, NewAgencyForm } from "./agency-forms";

export const metadata: Metadata = { title: "Agencies" };

// Settings > Agencies, for the platform's owner only: every studio that uses the app, the
// address its people sign in at, and a new one. Nothing of an agency's own work shows here,
// only how many people and clients it has.
export default async function AgenciesPage() {
  const viewer = await getViewer();
  if (!viewer.platformAdmin) notFound();
  const db = createPlatformClient();
  const [{ data: agencies }, { data: people }, { data: clients }] = await Promise.all([
    db.from("agencies").select("id, slug, name, domains, brand, created_at").order("created_at"),
    db.from("profiles").select("agency_id, role"),
    db.from("clients").select("agency_id"),
  ]);
  const count = (rows: { agency_id: string }[] | null, id: string) => (rows ?? []).filter((r) => r.agency_id === id).length;
  return (
    <WindowPage>
      <SettingsShell role={viewer.role} platform active="agencies" title="Agencies" description="The studios that use the app. Each has its own name and look, its own people and clients, and sees nothing of the others.">
        {(agencies ?? []).map((a) => {
          const brand = brandFrom(a);
          const team = (people ?? []).filter((p) => p.agency_id === a.id && p.role !== "client").length;
          return (
            <SettingsGroup key={a.id}>
              <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <span aria-hidden className="h-9 w-9 shrink-0 rounded-[10px]" style={{ background: brand.accent }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold text-ink">{a.name}</p>
                  <p className="text-[12.5px] text-muted">
                    {brand.product} · {team} on the team · {count(clients, a.id)} client{count(clients, a.id) === 1 ? "" : "s"} · since <LocalDate value={a.created_at} preset="short" />
                  </p>
                </div>
                <code className="rounded-md bg-white/[0.07] px-2 py-0.5 text-[12px] text-ink-2">{a.slug}</code>
              </div>
              <div className="px-4 py-3.5">
                <DomainsForm agencyId={a.id} domains={a.domains} first={a.slug === "magik"} />
              </div>
            </SettingsGroup>
          );
        })}
        <SettingsGroup title="New agency" description="Its first studio manager signs in at the address you give, then adds the team, the branding, the packs and the invoice details. The address must also point to the app at your hosting provider before anyone can open it.">
          <div className="p-4">
            <NewAgencyForm />
          </div>
        </SettingsGroup>
      </SettingsShell>
    </WindowPage>
  );
}
