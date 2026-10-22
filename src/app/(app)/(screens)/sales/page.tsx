import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { WindowPage } from "@/components/desktop/window-page";

export const metadata: Metadata = { title: "Sales" };

// The Sales app: its tools are coming; meanwhile, where today's sales work lives.
export default async function SalesPage() {
  await requireRole("admin", "seller");
  return (
    <WindowPage>
      <PageHeader title="Sales" />
      <div className="flex flex-col items-center rounded-[22px] border border-dashed border-white/15 bg-white/[0.02] px-6 py-14 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-success-soft text-success">
          <ChartNoAxesCombined size={30} aria-hidden />
        </span>
        <h2 className="mt-5 text-[19px] font-semibold text-ink">Your sales workspace is on its way.</h2>
        <p className="mt-2 max-w-md text-[13.5px] text-muted">This app is being set up. Until then, new clients start in Onboarding and referred businesses wait in Referrals.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {[
            { href: "/onboarding", label: "Onboarding" },
            { href: "/referrals", label: "Referrals" },
            { href: "/onboarding/invoices", label: "Invoices" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.08] px-4 text-[13.5px] font-medium text-ink hover:bg-white/[0.13]">
              {l.label} <ArrowRight size={14} aria-hidden />
            </Link>
          ))}
        </div>
      </div>
    </WindowPage>
  );
}
