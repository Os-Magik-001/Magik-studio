import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { ClientInfosForm } from "../forms";
import { StepRail } from "../progress";
import { WindowPage } from "@/components/desktop/window-page";

export const metadata: Metadata = { title: "New client" };

const EMPTY = { hasInfos: false, packId: null, invoice: null, contract: null, invite: null, hasAccount: false, progress: null };

export default async function NewClientPage() {
  await requireRole("admin", "seller");
  return (
    <WindowPage>
      <PageHeader
        eyebrow={<Link href="/onboarding">Onboarding</Link>}
        title="New client"
        description="Step 1: who they are. Next come the pack, the invoice, the contract and their link."
      />
      <div className="grid gap-6 @min-[64rem]:grid-cols-[250px_1fr]">
        <aside className="hidden @min-[64rem]:block">
          <StepRail clientId={null} facts={EMPTY} active="infos" current="infos" />
        </aside>
        <Card className="p-6">
          <h2 className="mb-5 text-[17px] font-semibold text-ink">Client infos</h2>
          <ClientInfosForm />
        </Card>
      </div>
    </WindowPage>
  );
}
