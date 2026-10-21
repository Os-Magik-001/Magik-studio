import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight, Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { onboardingFacts } from "@/lib/home";
import { stepByKey } from "@/lib/onboarding";
import { createAdminClient } from "@/lib/supabase/admin";
import { Avatar, Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, Select, cx } from "@/components/ui";
import { LocalDate } from "@/components/local-date";
import { SegmentedNav } from "@/components/segmented";
import { startOnboarding } from "@/app/actions/onboarding";
import { LaneProgress, OnboardingTabs } from "./progress";

export const metadata: Metadata = { title: "Onboarding" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireRole("admin", "seller");
  const { show } = await searchParams;
  const admin = createAdminClient();
  const [all, { data: packs }, { data: sellers }, { data: clients }] = await Promise.all([
    onboardingFacts(),
    admin.from("packs").select("id, name"),
    admin.from("profiles").select("id, full_name, email").in("role", ["admin", "seller"]),
    admin.from("clients").select("id, name, onboardings(client_id)").order("name"),
  ]);
  const finished = all.filter((o) => o.step === "done");
  const open = all.filter((o) => o.step !== "done");
  const list = (show === "done" ? finished : open).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const packName = (id: string | null) => packs?.find((p) => p.id === id)?.name;
  const sellerName = (id: string | null) => {
    const s = sellers?.find((p) => p.id === id);
    return s ? (s.full_name ?? s.email.split("@")[0]) : null;
  };
  // Clients from before onboarding, who can be taken through it too.
  const legacy = (clients ?? []).filter((c) => !c.onboardings);

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Onboarding"
        description="Set a new client up (details, pack, invoice, contract), then send one link. They open their account and finish with their brand."
        actions={
          <LinkButton href="/onboarding/new" variant="primary">
            <Plus size={16} aria-hidden /> New client
          </LinkButton>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <OnboardingTabs active="clients" />
        <div className="mb-6">
          <SegmentedNav
            active={show === "done" ? "done" : "open"}
            items={[
              { key: "open", label: "In progress", href: "/onboarding", count: open.length },
              { key: "done", label: "Finished", href: "/onboarding?show=done", count: finished.length },
            ]}
          />
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState title={show === "done" ? "No finished onboarding yet" : "Nobody to onboard right now"}>
          {show === "done" ? "Clients appear here once they've set up their brand." : "Start with New client: it takes two minutes."}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {list.map((o) => {
            const step = o.step === "done" ? null : stepByKey(o.step);
            return (
              <li key={o.client.id}>
                <Link
                  href={`/onboarding/${o.client.id}`}
                  className="frost group flex items-center gap-4 rounded-[18px] px-5 py-4 transition-colors hover:bg-white/[0.07]"
                >
                  <Avatar name={o.client.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[15px] font-semibold text-ink">{o.client.name}</span>
                      {packName(o.client.pack_id) && <Badge>{packName(o.client.pack_id)}</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-[12.5px] text-muted">
                      {o.client.contact_name ?? "No contact yet"}
                      {o.client.email && ` · ${o.client.email}`}
                      {sellerName(o.client.seller_id) && ` · sold by ${sellerName(o.client.seller_id)}`}
                    </p>
                  </div>
                  <div className="hidden flex-col items-end gap-1.5 sm:flex">
                    <LaneProgress facts={o.facts} current={o.step} />
                    <span className={cx("text-[12px]", step?.lane === "seller" ? "text-accent" : "text-muted")}>
                      {step ? (step.lane === "seller" ? `Your turn: ${step.label}` : `The client: ${step.label}`) : <LocalDate value={o.createdAt} preset="date" prefix="Started " />}
                    </span>
                  </div>
                  <ChevronRight size={18} className="text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {legacy.length > 0 && (
        <Card className="mt-8">
          <CardHeader title="An existing client" description="Take a client from before onboarding through it: pick the pack, invoice, contract and send them their link." />
          <form action={startOnboarding} className="flex flex-wrap items-center gap-3 px-5 py-4">
            <Select name="clientId" required defaultValue="" className="max-w-xs">
              <option value="" disabled>
                Choose a client…
              </option>
              {legacy.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <button className="h-9 rounded-full bg-white/[0.08] px-4 text-[13.5px] font-medium text-ink hover:bg-white/[0.13]">Start onboarding</button>
          </form>
        </Card>
      )}
    </>
  );
}
