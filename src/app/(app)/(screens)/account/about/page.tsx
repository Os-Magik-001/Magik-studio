import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { WindowPage } from "@/components/desktop/window-page";
import { SettingsGroup, SettingsRow, SettingsShell } from "@/components/settings/settings-shell";

export const metadata: Metadata = { title: "About Magik OS" };

const SHORTCUTS: [string, string][] = [
  ["⌘ K", "Search apps, clients, videos and events"],
  ["F3 or Ctrl ↑", "Mission Control: every open window"],
  ["⌥ W", "Close the window in front"],
  ["⌥ M", "Minimize the window in front"],
  ["⌘-click a link", "Open it in a new window"],
  ["Double-click a title bar", "Fill the screen, or back to its size"],
  ["Drag a window to an edge", "Fill half the screen, or all of it at the top"],
];

export default async function AboutPage() {
  const viewer = await getViewer();
  return (
    <WindowPage>
      <SettingsShell role={viewer.role} active="about" title="About Magik OS">
        <div className="frost flex items-center gap-5 rounded-[18px] p-6">
          <Image src="/brand/magik-monogram.svg" alt="" width={64} height={45} unoptimized className="h-12 w-auto" />
          <div>
            <p className="font-display text-[22px] font-bold tracking-[0.2em] text-ink">
              MAGIK <span className="text-accent">OS</span>
            </p>
            <p className="text-[13px] text-muted">The workspace of Magik Studio: plan, script, shoot, edit, review and approve.</p>
          </div>
        </div>
        <SettingsGroup title="Keyboard shortcuts">
          {SHORTCUTS.map(([keys, what]) => (
            <SettingsRow key={keys} label={what}>
              <kbd className="rounded-md bg-white/10 px-2 py-0.5 font-sans text-[12.5px] text-ink-2">{keys}</kbd>
            </SettingsRow>
          ))}
        </SettingsGroup>
        <SettingsGroup>
          <Link href="/help" className="block px-4 py-3 text-[13.5px] text-accent hover:bg-white/[0.04]">
            Open Help
          </Link>
        </SettingsGroup>
      </SettingsShell>
    </WindowPage>
  );
}
