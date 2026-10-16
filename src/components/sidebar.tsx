import Image from "next/image";
import Link from "next/link";
import { getViewer, displayName, type Role } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL } from "@/lib/workflow";
import { Avatar } from "@/components/ui";
import { NavLinks, type NavItem } from "@/components/nav-links";
import { Matrix } from "@/components/matrix";

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
    <aside className="sticky top-0 z-20 flex shrink-0 flex-col border-b border-line bg-black md:h-dvh md:w-64 md:border-r md:border-b-0">
      {/* Quiet gold rain behind the navigation, faded at both ends. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden opacity-45 md:block [mask-image:linear-gradient(to_bottom,transparent_0%,black_22%,black_62%,transparent_100%)]"
      >
        <Matrix variant="rain" />
      </div>
      <Link href="/" className="relative flex items-center px-4 py-3 md:block md:px-6 md:pt-7 md:pb-6" aria-label="Magik OS home">
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
        <Link href="/account" className="flex h-9 shrink-0 items-center rounded-md px-2.5 text-sm text-ink-2 hover:bg-surface-2 md:hidden">
          Account
        </Link>
        <form action="/auth/signout" method="post" className="md:hidden">
          <button className="flex h-9 shrink-0 items-center rounded-md px-2.5 text-sm text-muted hover:bg-surface-2">
            Sign out
          </button>
        </form>
      </NavLinks>
      <div className="relative mt-auto hidden border-t border-line bg-black p-4 md:block">
        <Link href="/account" className="-m-1.5 flex items-center gap-2.5 rounded-md p-1.5 hover:bg-surface-2">
          <Avatar name={name} size={32} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-ink">{name}</div>
            <div className="truncate text-xs text-muted">{ROLE_LABEL[viewer.role]}</div>
          </div>
        </Link>
        <form action="/auth/signout" method="post" className="mt-3">
          <button className="text-xs text-muted hover:text-ink">Sign out</button>
        </form>
      </div>
    </aside>
  );
}

export function SidebarSkeleton() {
  return (
    <aside className="h-14 shrink-0 border-b border-line bg-black md:h-dvh md:w-64 md:border-r md:border-b-0" />
  );
}
