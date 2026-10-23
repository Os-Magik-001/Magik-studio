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
        <div className="frost flex items-center gap-5 rounded-[18px] p-6">
          <Image src="/motchi/motchi.webp" alt="Motchi" width={80} height={90} unoptimized className="h-[90px] w-auto drop-shadow-[0_8px_14px_rgba(0,0,0,0.45)]" />
          <div>
            <p className="text-[17px] font-semibold text-ink">Meet Motchi</p>
            <p className="text-[13px] text-muted">The assistant of Magik OS. He lives in the bottom-right corner of your screen: click him and ask him anything about how Magik OS works.</p>
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
