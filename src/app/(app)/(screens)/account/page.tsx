import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { displayName, getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL } from "@/lib/workflow";
import { Avatar } from "@/components/ui";
import { LocalDate } from "@/components/local-date";
import { WindowPage } from "@/components/desktop/window-page";
import { SettingsGroup, SettingsRow, SettingsShell } from "@/components/settings/settings-shell";
import { NameForm } from "./forms";

export const metadata: Metadata = { title: "Settings" };

export default async function AccountPage() {
  const viewer = await getViewer();
  const supabase = await createClient();
  const [{ data: profile }, { data: client }] = await Promise.all([
    supabase.from("profiles").select("created_at").eq("id", viewer.id).maybeSingle(),
    viewer.clientId ? supabase.from("clients").select("name").eq("id", viewer.clientId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const name = displayName(viewer);
  return (
    <WindowPage>
      <SettingsShell role={viewer.role} active="general" title="General" description="Your name, your account, and what you can do in Magik OS.">
        <div className="frost flex items-center gap-4 rounded-[18px] p-5">
          <Avatar name={name} size={64} />
          <div className="min-w-0">
            <p className="truncate text-[19px] font-semibold text-ink">{name}</p>
            <p className="truncate text-[13.5px] text-muted">{viewer.email}</p>
            <p className="mt-1 text-[12.5px] text-ink-2">
              {ROLE_LABEL[viewer.role]}
              {client && ` · ${client.name}`}
            </p>
          </div>
        </div>
        <SettingsGroup title="Name" description="How you appear on comments, assignments and the calendar.">
          <div className="p-4">
            <NameForm fullName={viewer.fullName ?? ""} />
          </div>
        </SettingsGroup>
        <SettingsGroup title="Account">
          <SettingsRow label="Email" hint="You sign in with it. Ask your studio manager to change it.">
            <span className="text-[13.5px] text-ink-2">{viewer.email}</span>
          </SettingsRow>
          <SettingsRow label="Role">
            <span className="text-[13.5px] text-ink-2">{ROLE_LABEL[viewer.role]}</span>
          </SettingsRow>
          {profile && (
            <SettingsRow label="Member since">
              <span className="text-[13.5px] text-ink-2">
                <LocalDate value={profile.created_at} preset="date" />
              </span>
            </SettingsRow>
          )}
        </SettingsGroup>
        <SettingsGroup title="More">
          {[
            { href: "/account/appearance", label: "Wallpaper, Dock and windows" },
            { href: "/account/notifications", label: "What you're notified about" },
            { href: "/account/calendar", label: "Sync your calendar with Google or Apple" },
            { href: "/referrals", label: "Your referral link and credits" },
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
