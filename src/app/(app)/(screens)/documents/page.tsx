import type { Metadata } from "next";
import { ExternalLink, FileText, Receipt } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/onboarding";
import { formatCalendarDate } from "@/lib/dates";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { LocalDate } from "@/components/local-date";

export const metadata: Metadata = { title: "Documents" };

// The client's invoices and contract.
export default async function DocumentsPage() {
  await requireRole("client");
  const supabase = await createClient();
  const [{ data: invoices }, { data: contracts }] = await Promise.all([
    supabase.from("invoices").select("id, number, status, total_cents, currency, issued_on, due_on").neq("status", "void").order("created_at", { ascending: false }),
    supabase.from("contracts").select("id, file_name, status, signed_at, signed_name, signed_outside, storage_path").order("created_at", { ascending: false }),
  ]);
  // RLS returned only this client's contracts; sign their links.
  const urls = new Map<string, string>();
  for (const c of contracts ?? []) {
    const { data } = await createAdminClient().storage.from("contracts").createSignedUrl(c.storage_path, 60 * 60);
    if (data?.signedUrl) urls.set(c.id, data.signedUrl);
  }

  return (
    <>
      <PageHeader title="Documents" description="Your invoices and your contract with Magik." />
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader title="Invoices" />
          {invoices?.length ? (
            <ul className="divide-y divide-white/[0.07]">
              {invoices.map((i) => (
                <li key={i.id} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/[0.07] text-ink-2">
                    <Receipt size={18} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-ink">{i.number}</p>
                    <p className="text-[12.5px] text-muted">
                      {formatCalendarDate(i.issued_on, "date")}
                      {i.due_on && i.status !== "paid" && ` · due ${formatCalendarDate(i.due_on, "date")}`}
                    </p>
                  </div>
                  <span className="text-[14px] font-semibold text-ink tabular-nums">{formatMoney(i.total_cents, i.currency)}</span>
                  <Badge tone={i.status === "paid" ? "success" : "neutral"}>{i.status === "paid" ? "Paid" : "To pay"}</Badge>
                  <a href={`/invoices/${i.id}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.08] px-3.5 text-[13px] font-medium text-ink hover:bg-white/[0.13]">
                    Open <ExternalLink size={13} aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5">
              <EmptyState title="No invoices yet" />
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Contract" />
          {contracts?.length ? (
            <ul className="divide-y divide-white/[0.07]">
              {contracts.map((c) => (
                <li key={c.id} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#ff453a]/15 text-[#ff6b61]">
                    <FileText size={18} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">{c.file_name}</p>
                    <p className="text-[12.5px] text-muted">
                      {c.status === "signed" ? (
                        c.signed_at ? (
                          <LocalDate value={c.signed_at} preset="date" prefix={c.signed_name ? `Signed by ${c.signed_name}, ` : "Signed "} />
                        ) : (
                          "Signed"
                        )
                      ) : (
                        "Waiting for your signature"
                      )}
                    </p>
                  </div>
                  <Badge tone={c.status === "signed" ? "success" : "warning"}>{c.status === "signed" ? "Signed" : "To sign"}</Badge>
                  {urls.get(c.id) && (
                    <a href={urls.get(c.id)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.08] px-3.5 text-[13px] font-medium text-ink hover:bg-white/[0.13]">
                      Open <ExternalLink size={13} aria-hidden />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5">
              <EmptyState title="No contract yet" />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
