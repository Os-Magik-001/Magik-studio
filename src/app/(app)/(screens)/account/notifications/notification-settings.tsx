"use client";

import { useState, useTransition } from "react";
import { NOTIFICATION_CATEGORIES } from "@/lib/preferences";
import { Switch } from "@/components/switch";
import { SettingsGroup, SettingsRow } from "@/components/settings/settings-shell";
import { savePreferences } from "@/app/actions/account";

// Which notifications the person gets: everything is on until they turn a kind off.
export function NotificationSettings({ initial, categories }: { initial: string[]; categories: string[] }) {
  const [muted, setMuted] = useState<string[]>(initial);
  const [, startTransition] = useTransition();
  const set = (key: string, on: boolean) => {
    const next = on ? muted.filter((m) => m !== key) : [...muted, key];
    setMuted(next);
    startTransition(async () => {
      await savePreferences({ muted: next });
    });
  };
  return (
    <SettingsGroup title="Notify me about" description="Notifications show in the menu bar's bell. Turned off, they aren't sent to you at all.">
      {NOTIFICATION_CATEGORIES.filter((c) => categories.includes(c.key)).map((c) => (
        <SettingsRow key={c.key} label={c.label} hint={c.hint}>
          <Switch label={c.label} checked={!muted.includes(c.key)} onChange={(on) => set(c.key, on)} />
        </SettingsRow>
      ))}
    </SettingsGroup>
  );
}
