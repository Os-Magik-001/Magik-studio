import type { Metadata } from "next";
import { requireRole, displayName } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_LABEL } from "@/lib/workflow";
import { Avatar, Badge, Card, CardHeader, PageHeader, cx } from "@/components/ui";
import { SegmentedNav } from "@/components/segmented";
import { LocalDate } from "@/components/local-date";
import { WindowPage } from "@/components/desktop/window-page";
import { AddMemberForm } from "./add-member-form";
import { MemberActions } from "./member-actions";

export const metadata: Metadata = { title: "Team" };

type Show = "all" | "studio" | "clients" | "paused";

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const viewer = await requireRole("admin");
  const { show: asked } = await searchParams;
  const show: Show = asked === "studio" || asked === "clients" || asked === "paused" ? asked : "all";
  const supabase = await createClient();
  const [{ data: people }, { data: clients }, { data: auth }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role, paused_at, client:clients!profiles_client_id_fkey(name)").order("role").order("full_name"),
    supabase.from("clients").select("id, name").order("name"),
    // When each person last signed in (the studio is small: one page is everyone).
    createAdminClient().auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const lastSeen = new Map((auth?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]));
  const all = people ?? [];
  const list = all.filter((p) => (show === "studio" ? p.role !== "client" : show === "clients" ? p.role === "client" : show === "paused" ? !!p.paused_at : true));
  const paused = all.filter((p) => p.paused_at).length;

  return (
    <WindowPage>
      <PageHeader title="Team" description="Everyone who uses Magik OS. Each role sees only what that person needs. Pause an account to stop someone signing in for a while, or delete it for good." />
      <div className="mb-5">
        <SegmentedNav
          active={show}
          items={[
            { key: "all", label: "Everyone", href: "/team", count: all.length },
            { key: "studio", label: "Studio", href: "/team?show=studio", count: all.filter((p) => p.role !== "client").length },
            { key: "clients", label: "Clients", href: "/team?show=clients", count: all.filter((p) => p.role === "client").length },
            ...(paused ? [{ key: "paused", label: "Paused", href: "/team?show=paused", count: paused }] : []),
          ]}
        />
      </div>
      <div className="grid grid-cols-1 gap-6 @min-[64rem]:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          {list.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13.5px] text-muted">Nobody here.</p>
          ) : (
            <ul className="divide-y divide-line">
              {list.map((p) => {
                const seen = lastSeen.get(p.id);
                return (
                  <li key={p.id} className={cx("flex flex-col gap-3 px-5 py-3.5 @min-[40rem]:flex-row @min-[40rem]:items-start", p.paused_at && "opacity-75")}>
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar name={displayName(p)} size={34} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-ink">{displayName(p)}</span>
                          {p.id === viewer.id && <span className="text-[12px] text-muted">(you)</span>}
                        </div>
                        <div className="truncate text-xs text-muted">
                          {p.email}
                          {seen ? <LocalDate value={seen} preset="short" prefix=" · last signed in " /> : " · never signed in"}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 @min-[40rem]:pt-1">
                      {p.paused_at && <Badge tone="warning">Paused</Badge>}
                      <Badge tone={p.role === "admin" ? "accent" : "neutral"}>
                        {ROLE_LABEL[p.role]}
                        {p.client && ` · ${p.client.name}`}
                      </Badge>
                    </div>
                    <div className="@min-[40rem]:w-auto">
                      <MemberActions userId={p.id} name={displayName(p)} email={p.email} paused={!!p.paused_at} self={p.id === viewer.id} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card className="h-fit">
          <CardHeader title="Add someone" description="They sign in with their email and the password you set here." />
          <div className="p-5">
            <AddMemberForm clients={clients ?? []} />
          </div>
        </Card>
      </div>
    </WindowPage>
  );
}
