import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole, displayName } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { FORMAT_LABEL } from "@/lib/workflow";
import { Avatar, Card, CardHeader, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { VideoStatusBadge } from "@/components/status";
import {
  BrandKitForm,
  ClientSettingsForm,
  EditorToggle,
  NewVideoForm,
} from "./forms";
import { ResetPasswordButton } from "@/components/password-tools";

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const viewer = await requireRole("admin", "editor");
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) notFound();

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, revision_limit")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) notFound();

  const [{ data: videos }, { data: kit }, { data: people }, { data: team }] = await Promise.all([
    supabase
      .from("videos")
      .select("id, title, status, format, due_on, editor:profiles!videos_editor_id_fkey(full_name, email)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase.from("brand_kits").select("*").eq("client_id", clientId).maybeSingle(),
    supabase.from("profiles").select("id, full_name, email, role, client_id").order("full_name"),
    supabase.from("client_team").select("user_id").eq("client_id", clientId),
  ]);

  const editors = (people ?? []).filter((p) => p.role === "editor");
  const videographers = (people ?? []).filter((p) => p.role === "videographer");
  const clientUsers = (people ?? []).filter((p) => p.role === "client" && p.client_id === clientId);
  const assigned = new Set((team ?? []).map((t) => t.user_id));
  const logoUrl = kit?.logo_path ? (await signedUrls("brand", [kit.logo_path])).get(kit.logo_path) : undefined;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/clients" className="hover:text-ink">
            Clients
          </Link>
        }
        title={client.name}
        description={`${videos?.length ?? 0} videos · ${client.revision_limit} included revision rounds per video`}
        actions={
          <>
            <LinkButton href={`/agents?client=${client.id}`}>Agents</LinkButton>
            <LinkButton href={`/clients/${client.id}/brand`}>Brand & strategy</LinkButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Videos" />
            {!videos?.length ? (
              <div className="p-5">
                <EmptyState title="No videos yet">
                  {viewer.role === "admin" ? "Add the first one below." : "The studio manager adds videos."}
                </EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {videos.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/videos/${v.id}`}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-surface-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{v.title}</span>
                      <span className="text-[13px] text-muted">{FORMAT_LABEL[v.format]}</span>
                      {v.editor && <Avatar name={displayName(v.editor)} size={22} />}
                      <VideoStatusBadge status={v.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {viewer.role === "admin" && (
            <Card>
              <CardHeader title="New video" description="The editor and videographer are told right away." />
              <div className="p-5">
                <NewVideoForm
                  clientId={client.id}
                  editors={editors.map((e) => ({ id: e.id, name: displayName(e) }))}
                  videographers={videographers.map((e) => ({ id: e.id, name: displayName(e) }))}
                />
              </div>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Brand kit"
              description="Logo, colors, fonts, music mood and style rules. Claude follows these on every script and edit."
            />
            <div className="p-5">
              <BrandKitForm
                clientId={client.id}
                logoUrl={logoUrl}
                kit={{
                  colors: kit?.colors.join(", ") ?? "",
                  fonts: kit?.fonts.join(", ") ?? "",
                  musicMood: kit?.music_mood ?? "",
                  styleRules: kit?.style_rules ?? "",
                  editStyle: kit?.edit_style ?? "dynamic",
                }}
              />
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {viewer.role === "admin" && (
            <Card>
              <CardHeader title="Settings" />
              <div className="p-5">
                <ClientSettingsForm clientId={client.id} name={client.name} revisionLimit={client.revision_limit} />
              </div>
            </Card>
          )}

          {viewer.role === "admin" && (
            <Card>
              <CardHeader title="Editors" description="Assigned editors see all of this client's videos." />
              {editors.length === 0 ? (
                <p className="p-5 text-sm text-muted">
                  No editors on the team yet. <Link href="/team" className="text-accent">Add one</Link>.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {editors.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 px-5 py-2.5">
                      <Avatar name={displayName(e)} />
                      <span className="flex-1 truncate text-sm text-ink">{displayName(e)}</span>
                      <EditorToggle clientId={client.id} userId={e.id} assigned={assigned.has(e.id)} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card>
            <CardHeader
              title="Client reviewers"
              description="People at the client who review and approve."
            />
            {clientUsers.length === 0 ? (
              <p className="p-5 text-sm text-muted">
                {viewer.role === "admin" ? (
                  <>
                    None yet. <Link href="/team" className="text-accent">Invite a reviewer</Link>.
                  </>
                ) : (
                  "None yet. The studio manager invites them."
                )}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {clientUsers.map((u) => (
                  <li key={u.id} className="flex flex-col gap-2 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={displayName(u)} />
                      <div className="min-w-0">
                        <div className="truncate text-sm text-ink">{displayName(u)}</div>
                        <div className="truncate text-xs text-muted">{u.email}</div>
                      </div>
                    </div>
                    {viewer.role === "admin" && <ResetPasswordButton userId={u.id} />}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
