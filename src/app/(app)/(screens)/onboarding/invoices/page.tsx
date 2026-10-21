import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/onboarding";
import { readTaxes } from "@/lib/invoices";
import { formatCalendarDate } from "@/lib/dates";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { StudioSettingsForm } from "../forms";
import { OnboardingTabs } from "../progress";

export const metadata: Metadata = { title: "Invoices" };

const TONE = { issued: "neutral", sent: "accent", paid: "success", void: "danger" } as const;
const LABEL = { issued: "Ready to send", sent: "Sent", paid: "Paid", void: "Void" } as const;

export default async function InvoicesPage() {
  const viewer = await requireRole("admin", "seller");
  const admin = createAdminClient();
  const [{ data: invoices }, { data: settings }] = await Promise.all([
    admin.from("invoices").select("id, number, status, total_cents, currency, issued_on, due_on, clients(id, name)").order("created_at", { ascending: false }).limit(200),
    admin.from("studio_settings").select("*").maybeSingle(),
  ]);
  const outstanding = (invoices ?? []).filter((i) => i.status === "issued" || i.status === "sent");
  const currency = settings?.currency ?? "CAD";

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Onboarding"
        description={`Every invoice, newest first. Outstanding: ${formatMoney(outstanding.reduce((s, i) => s + i.total_cents, 0), currency)} on ${outstanding.length} invoice${outstanding.length === 1 ? "" : "s"}.`}
      />
      <OnboardingTabs active="invoices" />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        {!invoices?.length ? (
          <EmptyState title="No invoices yet">They&apos;re generated in each client&apos;s onboarding, from the pack.</EmptyState>
        ) : (
          <Card className="h-fit overflow-hidden">
            <ul className="divide-y divide-white/[0.07]">
              {invoices.map((i) => (
                <li key={i.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-ink">
                      {i.clients ? (
                        <Link href={`/onboarding/${i.clients.id}?step=invoice`} className="hover:text-accent">
                          {i.clients.name}
                        </Link>
                      ) : (
                        "Client removed"
                      )}
                    </p>
                    <p className="text-[12.5px] text-muted">
                      {i.number} · {formatCalendarDate(i.issued_on, "date")}
                      {i.due_on && i.status !== "paid" && i.status !== "void" && ` · due ${formatCalendarDate(i.due_on, "date")}`}
                    </p>
                  </div>
                  <span className="text-[14px] font-semibold text-ink tabular-nums">{formatMoney(i.total_cents, i.currency)}</span>
                  <Badge tone={TONE[i.status as keyof typeof TONE] ?? "neutral"}>{LABEL[i.status as keyof typeof LABEL] ?? i.status}</Badge>
                  <a href={`/invoices/${i.id}`} target="_blank" rel="noreferrer" aria-label={`Open invoice ${i.number}`} className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-ink">
                    <ExternalLink size={15} aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {viewer.role === "admin" && settings && (
          <Card className="h-fit">
            <CardHeader title="Invoice details" description="The studio's name, address, taxes and payment terms on every new invoice." />
            <div className="p-5">
              <StudioSettingsForm settings={{ ...settings, taxes: readTaxes(settings.taxes) }} />
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
