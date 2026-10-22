import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { WindowPage } from "@/components/desktop/window-page";
import { SettingsGroup, SettingsShell } from "@/components/settings/settings-shell";
import { ReferralRewardForm } from "./reward-form";

export const metadata: Metadata = { title: "Studio settings" };

// Settings > Studio, for the studio manager: what a referral is worth, and where the studio's
// other settings live.
export default async function StudioSettingsPage() {
  const viewer = await requireRole("admin");
  const { data: studio } = await createAdminClient().from("studio_settings").select("business_name, referral_reward").maybeSingle();
  return (
    <WindowPage>
      <SettingsShell role={viewer.role} active="studio" title="Studio" description={`Settings for ${studio?.business_name ?? "the studio"}: shared by everyone.`}>
        <SettingsGroup title="Referrals" description="Credits go to the person who referred a client, when you mark the referral as signed in the Referrals app.">
          <div className="p-4">
            <ReferralRewardForm reward={studio?.referral_reward ?? 100} />
          </div>
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
