import Image from "next/image";
import Link from "next/link";
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
  client: [
    { href: "/review", label: "Your videos", icon: "videos" },
    { href: "/brand", label: "Your brand", icon: "brand" },
  ],
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
    <aside className="glass sticky top-2 z-30 mx-2 mt-2 flex flex-col rounded-[24px] md:fixed md:inset-y-3 md:top-3 md:left-3 md:m-0 md:w-[16.75rem] md:rounded-[30px]">
      <Link href="/" className="flex items-center px-4 pt-3 pb-2 md:block md:px-6 md:pt-7 md:pb-6" aria-label="Magik OS home">
        <Image
          src="/brand/magik-monogram.svg"
          alt="Magik Management"
          width={41}
          height={28}
          unoptimized
          priority
          className="h-7 w-auto md:hidden"
        />
        <Image
          src="/brand/magik-horizontal.svg"
          alt="Magik Management"
          width={200}
          height={43}
          unoptimized
          priority
          className="hidden h-auto w-[200px] md:block"
        />
        <span className="kicker ml-3 md:mt-5 md:ml-0 md:block">Studio OS</span>
      </Link>
      <NavLinks items={items}>
        <Link href="/account" className="flex h-9 shrink-0 items-center rounded-2xl px-3 text-sm text-ink-2 hover:bg-white/8 md:hidden">
          Account
        </Link>
        <form action="/auth/signout" method="post" className="md:hidden">
          <button className="flex h-9 shrink-0 items-center rounded-2xl px-3 text-sm text-muted hover:bg-white/8">
            Sign out
          </button>
        </form>
      </NavLinks>
      <div className="mt-auto hidden p-3 md:block">
        <div className="rounded-[20px] bg-white/[0.04] p-3">
          <Link href="/account" className="-m-1 flex items-center gap-2.5 rounded-2xl p-1 hover:bg-white/8">
            <Avatar name={name} size={34} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-ink">{name}</div>
              <div className="truncate text-xs text-muted">{ROLE_LABEL[viewer.role]}</div>
            </div>
          </Link>
          <form action="/auth/signout" method="post" className="mt-2.5 pl-1">
            <button className="text-xs text-muted hover:text-ink">Sign out</button>
          </form>
        </div>
      </div>
    </aside>
  );
}

export function SidebarSkeleton() {
  return (
    <aside className="glass sticky top-2 z-30 mx-2 mt-2 h-24 rounded-[24px] md:fixed md:inset-y-3 md:top-3 md:left-3 md:m-0 md:h-auto md:w-[16.75rem] md:rounded-[30px]" />
  );
}
