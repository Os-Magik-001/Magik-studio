import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { agencyDb } from "@/lib/supabase/agency";
import { WindowPage } from "@/components/desktop/window-page";
import { SettingsGroup, SettingsRow, SettingsShell } from "@/components/settings/settings-shell";
import { monthStart, summarize, tokensText } from "@/lib/usage";
import { ReferralRewardForm } from "./reward-form";

export const metadata: Metadata = { title: "Studio settings" };

// Settings > Studio, for the studio manager: what a referral is worth, and where the studio's
// other settings live.
export default async function StudioSettingsPage() {
  const viewer = await requireRole("admin");
  const db = await agencyDb();
  const [{ data: studio }, { data: usage }] = await Promise.all([
    db.from("studio_settings").select("business_name, referral_reward").maybeSingle(),
    db.from("usage_events").select("kind, quantity").gte("created_at", monthStart()).limit(100000),
  ]);
  const used = summarize(usage ?? []);
  return (
    <WindowPage>
      <SettingsShell role={viewer.role} platform={viewer.platformAdmin} active="studio" title="Studio" description={`Settings for ${studio?.business_name ?? "the studio"}: shared by everyone.`}>
        <SettingsGroup title="Referrals" description="Credits go to the person who referred a client, when you mark the referral as signed in the Referrals app.">
          <div className="p-4">
            <ReferralRewardForm reward={studio?.referral_reward ?? 100} />
          </div>
        </SettingsGroup>
        <SettingsGroup title="This month" description="What the studio has used since the first of the month: edits made by the engine, the AI's reading and writing, and trend-research runs.">
          <SettingsRow label="Edits made">
            <span className="text-[13.5px] font-semibold text-ink tabular-nums">{used.edits}</span>
          </SettingsRow>
          <SettingsRow label="AI tokens">
            <span className="text-[13.5px] font-semibold text-ink tabular-nums">{tokensText(used.tokens)}</span>
          </SettingsRow>
          <SettingsRow label="Research runs">
            <span className="text-[13.5px] font-semibold text-ink tabular-nums">{used.scrapes}</span>
          </SettingsRow>
        </SettingsGroup>
        <SettingsGroup title="Elsewhere">
          {[
            { href: "/onboarding/invoices", label: "Invoice details: address, taxes, payment instructions" },
            { href: "/onboarding/packs", label: "Packs: the offers you sell" },
            { href: "/team", label: "Team: people, roles, paused accounts" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="flex items-center justify-between px-4 py-3 text-[13.5px] text-ink hover:bg-white/[0.04]">
              {l.label}
              <ChevronRight size={16} className="text-muted" aria-hidden />
            </Link>
          ))}
        </SettingsGroup>
      </SettingsShell>
    </WindowPage>
  );
}
