import type { Metadata } from "next";
import { getViewer } from "@/lib/auth";
import { WindowPage } from "@/components/desktop/window-page";
import { SettingsShell } from "@/components/settings/settings-shell";
import { lookOf } from "@/lib/preferences";
import { AppearanceSettings } from "./appearance";

export const metadata: Metadata = { title: "Appearance" };

export default async function AppearancePage() {
  const viewer = await getViewer();
  return (
    <WindowPage>
      <SettingsShell role={viewer.role} active="appearance" title="Appearance" description="Your wallpaper, the Dock and the windows. Saved to your account, so they follow you to any computer.">
        <AppearanceSettings initial={lookOf(viewer.preferences)} />
      </SettingsShell>
    </WindowPage>
  );
}
