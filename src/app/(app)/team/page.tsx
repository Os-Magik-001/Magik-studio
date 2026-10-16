import type { Metadata } from "next";
import { requireRole, displayName } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL } from "@/lib/workflow";
import { Avatar, Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { SignInLinkButton } from "@/app/(app)/clients/[clientId]/forms";
import { AddMemberForm } from "./add-member-form";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const [{ data: people }, { data: clients }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role, client:clients(name)").order("role").order("full_name"),
    supabase.from("clients").select("id, name").order("name"),
  ]);

  return (
    <>
      <PageHeader
        title="Team"
        description="Everyone who uses Magik OS. Each role sees only what that person needs."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <ul className="divide-y divide-line">
            {(people ?? []).map((p) => (
              <li key={p.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={displayName(p)} size={32} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{displayName(p)}</div>
                    <div className="truncate text-xs text-muted">{p.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={p.role === "admin" ? "accent" : "neutral"}>
                    {ROLE_LABEL[p.role]}
                    {p.client && ` · ${p.client.name}`}
                  </Badge>
                </div>
                <div className="sm:w-56">
                  <SignInLinkButton userId={p.id} next="/" />
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="h-fit">
          <CardHeader
            title="Add someone"
            description="They sign in with their email; no password. You can also hand them a one-click link."
          />
          <div className="p-5">
            <AddMemberForm clients={clients ?? []} />
          </div>
        </Card>
      </div>
    </>
  );
}
