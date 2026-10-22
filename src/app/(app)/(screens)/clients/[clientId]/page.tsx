import { clientTitle } from "@/lib/titles";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole, displayName } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { FORMAT_LABEL } from "@/lib/workflow";
import { Avatar, Card, CardHeader, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { VideoStatusBadge } from "@/components/status";
import { AutoRefresh } from "@/components/auto-refresh";
import { ReferenceList } from "@/components/references/list";
import { AddReferenceForm } from "@/components/references/add-form";
import {
  BrandKitForm,
  ClientSettingsForm,
  EditorToggle,
  NewVideoForm,
} from "./forms";
import { ResetPasswordButton } from "@/components/password-tools";
import { ProductionPanel } from "@/components/production/panel";
import { WindowPage } from "@/components/desktop/window-page";
import { AccessActions, WebsiteForm } from "./access-forms";

export async function generateMetadata({ params }: { params: Promise<{ clientId: string }> }): Promise<Metadata> {
  return clientTitle((await params).clientId, "Client");
}

export default async function ClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const viewer = await requireRole("admin", "editor");
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) notFound();

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, revision_limit, site_status, site_url, site_admin_url")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) notFound();

  const [{ data: videos }, { data: kit }, { data: people }, { data: team }, { data: references }, { data: onboarding }] = await Promise.all([
    supabase
      .from("videos")
      .select("id, title, status, format, due_on, editor:profiles!videos_editor_id_fkey(full_name, email)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase.from("brand_kits").select("*").eq("client_id", clientId).maybeSingle(),
    supabase.from("profiles").select("id, full_name, email, role, client_id").order("full_name"),
    supabase.from("client_team").select("user_id").eq("client_id", clientId),
    // References for every video of the client (each video's own are on its page).
    supabase
      .from("reference_videos")
      .select("id, video_id, url, platform, focus, note, status, progress, error, watched, title, owner, duration, stats, analysis, sheets")
      .eq("client_id", clientId)
      .is("video_id", null)
      .order("created_at", { ascending: false }),
    supabase.from("onboardings").select("completed_at").eq("client_id", clientId).maybeSingle(),
  ]);

  const editors = (people ?? []).filter((p) => p.role === "editor");
  const videographers = (people ?? []).filter((p) => p.role === "videographer");
  const clientUsers = (people ?? []).filter((p) => p.role === "client" && p.client_id === clientId);
  const assigned = new Set((team ?? []).map((t) => t.user_id));
  const logoUrl = kit?.logo_path ? (await signedUrls("brand", [kit.logo_path])).get(kit.logo_path) : undefined;
  const sheetUrls = await signedUrls("references", (references ?? []).flatMap((r) => r.sheets.slice(0, 1)));
  const watching = (references ?? []).some((r) => r.status === "queued" || r.status === "running");

  return (
    <WindowPage>
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
            {viewer.role === "admin" && <LinkButton href={`/onboarding/${client.id}`}>Onboarding</LinkButton>}
            <LinkButton href={`/agents?client=${client.id}`}>Agents</LinkButton>
            <LinkButton href={`/clients/${client.id}/brand`}>Brand & strategy</LinkButton>
          </>
        }
      />

      <div className="grid gap-6 @min-[64rem]:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <ProductionPanel clientId={client.id} viewer={viewer} />

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
              title="References for every video"
              description="Reels and videos that show the style this client wants. The engine watches each one; the scriptwriter, the motion director, the editor and the sound designer use them on all of this client's videos."
            />
            <div className="flex flex-col gap-4 p-5">
              {watching && <AutoRefresh seconds={8} />}
              <ReferenceList items={references ?? []} sheetUrls={sheetUrls} />
              <details className="rounded-xl border border-line p-4" open={!references?.length}>
                <summary className="cursor-pointer text-[13px] font-medium text-accent">Add a reference</summary>
                <div className="mt-4">
                  <AddReferenceForm clientId={client.id} clientName={client.name} />
                </div>
              </details>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Brand kit"
              description="Logo, colors, fonts, music mood and style rules. The agents and the edit engine follow these on every script and edit."
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
                  graphics: kit?.graphics ?? "templates",
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

          {viewer.role === "admin" && (
            <Card>
              <CardHeader
                title="Access to Magik OS"
                description={
                  onboarding?.completed_at
                    ? "Onboarded: their people use Magik OS."
                    : onboarding
                      ? "Setting up: their people finish the setup assistant before using Magik OS."
                      : "Not onboarded yet: their people can't use Magik OS until you open their setup or mark them onboarded."
                }
              />
              {!onboarding?.completed_at && (
                <div className="p-5">
                  <AccessActions clientId={client.id} hasSetup={!!onboarding} />
                </div>
              )}
            </Card>
          )}

          {viewer.role === "admin" && (
            <Card>
              <CardHeader title="Website" description="The website Magik made for them, shown in their Website app." />
              <div className="p-5">
                <WebsiteForm clientId={client.id} status={client.site_status} url={client.site_url ?? ""} adminUrl={client.site_admin_url ?? ""} />
              </div>
            </Card>
          )}
        </div>
      </div>
    </WindowPage>
  );
}
