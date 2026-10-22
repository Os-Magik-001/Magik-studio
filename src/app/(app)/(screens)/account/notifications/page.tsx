import type { Metadata } from "next";
import { getViewer, type Role } from "@/lib/auth";
import { Button } from "@/components/ui";
import { WindowPage } from "@/components/desktop/window-page";
import { SettingsGroup, SettingsRow, SettingsShell } from "@/components/settings/settings-shell";
import { markNotificationsRead } from "@/app/actions/workflow";
import { NotificationSettings } from "./notification-settings";

export const metadata: Metadata = { title: "Notifications" };

// The kinds of news each role can get.
const CATEGORIES: Record<Role, string[]> = {
  admin: ["videos", "comments", "scripts", "shoots", "production", "onboarding", "calendar", "referrals", "studio"],
  editor: ["videos", "comments", "scripts", "shoots", "production", "calendar", "referrals", "studio"],
  videographer: ["videos", "shoots", "calendar", "referrals", "studio"],
  seller: ["onboarding", "calendar", "referrals", "studio"],
  client: ["videos", "comments", "scripts", "shoots", "calendar", "referrals", "studio"],
};

export default async function NotificationSettingsPage() {
  const viewer = await getViewer();
  return (
    <WindowPage>
      <SettingsShell role={viewer.role} active="notifications" title="Notifications" description="Choose what Magik OS tells you about.">
        <NotificationSettings initial={viewer.preferences.muted ?? []} categories={CATEGORIES[viewer.role]} />
        <SettingsGroup>
          <SettingsRow label="Mark everything as read" hint="Clears the badge on the bell.">
            <form action={markNotificationsRead}>
              <Button variant="secondary" size="sm">
                Mark all as read
              </Button>
            </form>
          </SettingsRow>
        </SettingsGroup>
      </SettingsShell>
    </WindowPage>
  );
}
