import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/onboarding";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { setPackActive } from "@/app/actions/onboarding";
import { PackForm } from "../forms";
import { OnboardingTabs } from "../progress";
import { WindowPage } from "@/components/desktop/window-page";

export const metadata: Metadata = { title: "Packs" };

// The offers sellers choose from. The studio manager sets them; sellers see them.
export default async function PacksPage() {
  const viewer = await requireRole("admin", "seller");
  const admin = createAdminClient();
  const [{ data: packs }, { data: settings }, { data: clients }] = await Promise.all([
    admin.from("packs").select("*").order("active", { ascending: false }).order("sort").order("price_cents"),
    admin.from("studio_settings").select("currency").maybeSingle(),
    admin.from("clients").select("pack_id").not("pack_id", "is", null),
  ]);
  const currency = settings?.currency ?? "CAD";
  const used = (id: string) => clients?.filter((c) => c.pack_id === id).length ?? 0;
  const editable = viewer.role === "admin";

  return (
    <WindowPage>
      <PageHeader eyebrow="Sales" title="Onboarding" description="The packs the studio sells. A pack sets the price on the invoice and the client's revision rounds." />
      <OnboardingTabs active="packs" />
      <div className="grid gap-6 @min-[80rem]:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-3">
          {!packs?.length ? (
            <EmptyState title="No packs yet">{editable ? "Add the first one: name, price and what's included." : "The studio manager adds them."}</EmptyState>
          ) : (
            packs.map((p) => (
              <Card key={p.id} className={p.active ? "" : "opacity-60"}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[15px] font-semibold text-ink">{p.name}</h3>
                        {!p.active && <Badge>Archived</Badge>}
                      </div>
                      <p className="mt-0.5 truncate text-[12.5px] text-muted">
                        {[p.videos_per_month && `${p.videos_per_month} videos a month`, `${p.revision_rounds} revision rounds`, ...p.features].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-[20px] font-bold text-ink tabular-nums">{formatMoney(p.price_cents, currency)}</p>
                      <p className="text-[12px] text-muted">
                        {p.billing === "monthly" ? "per month" : "one time"} · {used(p.id)} client{used(p.id) === 1 ? "" : "s"}
                      </p>
                    </div>
                  </summary>
                  {editable && (
                    <div className="border-t border-white/[0.07] px-5 py-5">
                      <PackForm pack={p} />
                      <form action={setPackActive} className="mt-3 border-t border-white/[0.07] pt-3">
                        <input type="hidden" name="packId" value={p.id} />
                        <input type="hidden" name="active" value={p.active ? "0" : "1"} />
                        <Button variant="ghost" size="sm">
                          {p.active ? "Archive (sellers won't see it)" : "Bring back"}
                        </Button>
                      </form>
                    </div>
                  )}
                </details>
              </Card>
            ))
          )}
        </div>
        {editable && (
          <Card className="h-fit">
            <CardHeader title="New pack" description="Prices before taxes; taxes are added on the invoice." />
            <div className="p-5">
              <PackForm />
            </div>
          </Card>
        )}
      </div>
    </WindowPage>
  );
}
