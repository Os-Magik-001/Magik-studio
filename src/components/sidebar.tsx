import { getViewer, displayName, type Role } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL } from "@/lib/workflow";
import { Avatar } from "@/components/ui";
import { NavLinks, type NavItem } from "@/components/nav-links";

const NAV: Record<Role, NavItem[]> = {
  admin: [
    { href: "/pipeline", label: "Pipeline", icon: "pipeline" },
    { href: "/clients", label: "Clients", icon: "clients" },
    { href: "/shoots", label: "Shoots", icon: "shoots" },
    { href: "/team", label: "Team", icon: "team" },
  ],
  editor: [
    { href: "/pipeline", label: "Pipeline", icon: "pipeline" },
    { href: "/clients", label: "Clients", icon: "clients" },
  ],
  videographer: [{ href: "/shoots", label: "Shoots", icon: "shoots" }],
  client: [{ href: "/review", label: "Your videos", icon: "videos" }],
};

export async function Sidebar() {
  const viewer = await getViewer();
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  const items: NavItem[] = [
    ...NAV[viewer.role],
    { href: "/notifications", label: "Notifications", icon: "bell", badge: count ?? 0 },
  ];
  const name = displayName(viewer);

  return (
    <aside className="sticky top-0 z-20 flex shrink-0 flex-col border-b border-line bg-surface md:h-dvh md:w-60 md:border-r md:border-b-0">
      <div className="flex items-center gap-2.5 px-4 py-3 md:px-5 md:py-5">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-ink font-serif text-lg text-bg">
          M
        </span>
        <span className="font-serif text-lg text-ink">Magik OS</span>
      </div>
      <NavLinks items={items}>
        <form action="/auth/signout" method="post" className="md:hidden">
          <button className="flex h-9 shrink-0 items-center rounded-lg px-2.5 text-sm text-muted hover:bg-surface-2">
            Sign out
          </button>
        </form>
      </NavLinks>
      <div className="mt-auto hidden border-t border-line p-4 md:block">
        <div className="flex items-center gap-2.5">
          <Avatar name={name} size={32} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-ink">{name}</div>
            <div className="truncate text-xs text-muted">{ROLE_LABEL[viewer.role]}</div>
          </div>
        </div>
        <form action="/auth/signout" method="post" className="mt-3">
          <button className="text-xs text-muted hover:text-ink">Sign out</button>
        </form>
      </div>
    </aside>
  );
}

export function SidebarSkeleton() {
  return (
    <aside className="h-14 shrink-0 border-b border-line bg-surface md:h-dvh md:w-60 md:border-r md:border-b-0" />
  );
}
