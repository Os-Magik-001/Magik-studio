import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, Building2, CalendarDays, FileText, Gift, Info, Lock, Palette, UserRound } from "lucide-react";
import type { Role } from "@/lib/auth";
import { cx } from "@/components/ui";

// Settings, like macOS System Settings: the sections in a sidebar, the chosen one on the right.

export type SettingsSection = "general" | "appearance" | "notifications" | "calendar" | "security" | "documents" | "referrals" | "studio" | "about";

const SECTIONS: { key: SettingsSection; label: string; href: string; icon: typeof Bell; tint: string; roles?: Role[] }[] = [
  { key: "general", label: "General", href: "/account", icon: UserRound, tint: "#0a84ff" },
  { key: "appearance", label: "Appearance", href: "/account/appearance", icon: Palette, tint: "#bf5af2" },
  { key: "notifications", label: "Notifications", href: "/account/notifications", icon: Bell, tint: "#ff453a" },
  { key: "calendar", label: "Calendar", href: "/account/calendar", icon: CalendarDays, tint: "#ff9f0a" },
  { key: "security", label: "Password & security", href: "/account/security", icon: Lock, tint: "#8e8e93" },
  { key: "documents", label: "Documents", href: "/account/documents", icon: FileText, tint: "#64d2ff", roles: ["client"] },
  { key: "referrals", label: "Referrals & credits", href: "/referrals", icon: Gift, tint: "#d9a60c" },
  { key: "studio", label: "Studio", href: "/account/studio", icon: Building2, tint: "#30d158", roles: ["admin"] },
  { key: "about", label: "About Magik OS", href: "/account/about", icon: Info, tint: "#636366" },
];

export function SettingsShell({
  role,
  active,
  title,
  description,
  children,
}: {
  role: Role;
  active: SettingsSection;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const sections = SECTIONS.filter((s) => !s.roles || s.roles.includes(role));
  return (
    <div className="win-bleed flex min-h-full flex-col @min-[48rem]:flex-row">
      <aside className="settings-side shrink-0 border-white/[0.07] @min-[48rem]:w-[236px] @min-[48rem]:border-r">
        <nav aria-label="Settings" className="flex gap-1 overflow-x-auto p-3 @min-[48rem]:sticky @min-[48rem]:top-0 @min-[48rem]:flex-col @min-[48rem]:overflow-visible @min-[48rem]:p-3">
          {sections.map((s) => {
            const on = s.key === active;
            return (
              <Link
                key={s.key}
                href={s.href}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "flex shrink-0 items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-[13.5px] transition-colors",
                  on ? "bg-accent text-black" : "text-ink-2 hover:bg-white/[0.07] hover:text-ink",
                )}
              >
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]" style={{ background: s.tint }}>
                  <s.icon size={13} strokeWidth={2.2} aria-hidden />
                </span>
                <span className={cx("whitespace-nowrap", on && "font-semibold")}>{s.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1 px-5 pt-6 pb-10 @min-[40rem]:px-9 @min-[40rem]:pt-7">
        <header className="mb-6">
          <h1 className="font-display text-[26px] leading-[1.15] font-bold tracking-[-0.02em] text-ink">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-[13.5px] text-muted">{description}</p>}
        </header>
        <div className="flex max-w-[760px] flex-col gap-5">{children}</div>
      </div>
    </div>
  );
}

// A group of settings, the way System Settings boxes them.
export function SettingsGroup({ title, description, children, className }: { title?: string; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      {title && <h2 className="mb-1.5 px-1 text-[13px] font-semibold text-ink-2">{title}</h2>}
      <div className="frost divide-y divide-white/[0.07] overflow-hidden rounded-[14px]">{children}</div>
      {description && <p className="mt-1.5 px-1 text-[12.5px] text-muted">{description}</p>}
    </section>
  );
}

// One row: a label (and a hint) on the left, its control on the right.
export function SettingsRow({ label, hint, children, stack }: { label: ReactNode; hint?: ReactNode; children?: ReactNode; stack?: boolean }) {
  return (
    <div className={cx("flex gap-4 px-4 py-3", stack ? "flex-col" : "flex-wrap items-center justify-between")}>
      <div className="min-w-0">
        <div className="text-[13.5px] text-ink">{label}</div>
        {hint && <div className="mt-0.5 text-[12.5px] text-muted">{hint}</div>}
      </div>
      {children}
    </div>
  );
}
