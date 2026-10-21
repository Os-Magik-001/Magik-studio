import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InvoiceDocument } from "@/components/invoice-document";
import { PrintButton } from "./print-button";

export const instant = false;

export const metadata: Metadata = { title: "Invoice" };

// An invoice on its own page, to print or save as PDF. Sales see every invoice, a client
// their own (RLS decides).
export default async function InvoicePage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  await getViewer();
  if (!/^[0-9a-f-]{36}$/i.test(invoiceId)) notFound();
  const supabase = await createClient();
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!invoice) notFound();
  return (
    <main className="min-h-dvh bg-[#e9e9ee] px-4 py-8 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-5 flex max-w-[820px] items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-[#3a3a3c]">{invoice.number}</p>
        <PrintButton label={invoice.language === "en" ? "Print or save as PDF" : "Imprimer ou enregistrer en PDF"} />
      </div>
      <InvoiceDocument invoice={invoice} />
    </main>
  );
}
