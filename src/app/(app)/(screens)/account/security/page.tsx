import type { Metadata } from "next";
import { getViewer } from "@/lib/auth";
import { Button } from "@/components/ui";
import { WindowPage } from "@/components/desktop/window-page";
import { SettingsGroup, SettingsRow, SettingsShell } from "@/components/settings/settings-shell";
import { signOutEverywhere } from "@/app/actions/account";
import { ChangePasswordForm } from "../forms";

export const metadata: Metadata = { title: "Password & security" };

export default async function SecurityPage() {
  const viewer = await getViewer();
  return (
    <WindowPage>
      <SettingsShell role={viewer.role} active="security" title="Password & security" description="Change your password, or sign out everywhere if you used a computer that isn't yours.">
        <SettingsGroup title="Password" description="At least 8 characters. Your studio manager can also set a new one for you.">
          <div className="p-4">
            <ChangePasswordForm />
          </div>
        </SettingsGroup>
        <SettingsGroup title="Sessions">
          <SettingsRow label="Sign out everywhere" hint="Signs you out on every computer and phone, this one included.">
            <form action={signOutEverywhere}>
              <Button variant="secondary" size="sm">
                Sign out everywhere
              </Button>
            </form>
          </SettingsRow>
        </SettingsGroup>
      </SettingsShell>
    </WindowPage>
  );
}
