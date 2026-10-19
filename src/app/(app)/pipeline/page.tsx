import Link from "next/link";
import type { Metadata } from "next";
import { LayoutGrid, List } from "lucide-react";
import { requireRole, displayName } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { videoStatusLabel, type VersionStatus } from "@/lib/workflow";
import { PHASES, nextStep, type PipelineFacts } from "@/lib/pipeline";
import { Avatar, EmptyState, LinkButton, PageHeader, cx } from "@/components/ui";
import { WhoDot } from "@/components/pipeline";
import { BoardCard, Chip, Due, Stat, type BoardCardData } from "@/components/pipeline-board";
import { AutoRefresh } from "@/components/auto-refresh";

export const metadata: Metadata = { title: "Pipeline" };

type Filters = { client?: string; who?: string; view?: string; mine?: string; done?: string };

const nowIso = () => new Date().toISOString();
const today = () => nowIso().slice(0, 10);
const daysFrom = (iso: string, days: number) => new Date(Date.parse(iso) + days * 86_400_000).toISOString().slice(0, 10);

type Card = BoardCardData;

export default async function PipelinePage({ searchParams }: { searchParams: Promise<Filters> }) {
  const viewer = await requireRole("admin", "editor");
  const filters = await searchParams;
  const supabase = await createClient();
  const now = nowIso();
  const [{ data: videos }, { data: scripts }, { data: footage }, { data: jobs }, { data: versions }, { data: shoots }, { data: references }] = await Promise.all([
    supabase
      .from("videos")
      .select("id, title, status, format, due_on, updated_at, brief, footage_complete_at, editor_id, client:clients(id, name), editor:profiles!videos_editor_id_fkey(full_name, email)")
      .order("updated_at", { ascending: false }),
    supabase.from("scripts").select("video_id, status, body, edit_prompt"),
    supabase.from("footage").select("video_id"),
    supabase.from("edit_jobs").select("video_id, status, progress, created_at").order("created_at", { ascending: false }).limit(1000),
    supabase.from("versions").select("video_id, number, status").order("number", { ascending: false }),
    supabase.from("shoots").select("video_id, starts_at").gte("starts_at", now).order("starts_at"),
    supabase.from("reference_videos").select("video_id, client_id"),
  ]);

  // What each video is waiting on, read the same way as on its own page.
  const by = <T extends { video_id: string | null }>(rows: T[] | null) => {
    const map = new Map<string, T[]>();
    for (const r of rows ?? []) if (r.video_id) map.set(r.video_id, [...(map.get(r.video_id) ?? []), r]);
    return map;
  };
  const scriptOf = new Map((scripts ?? []).map((s) => [s.video_id, s]));
  const footageOf = by(footage);
  const jobsOf = by(jobs);
  const versionsOf = by(versions);
  const shootsOf = by(shoots);
  const refsOf = by(references);
  const clientRefs = new Map<string, number>();
  for (const r of references ?? []) if (!r.video_id) clientRefs.set(r.client_id, (clientRefs.get(r.client_id) ?? 0) + 1);
  const day = today();

  const all: Card[] = (videos ?? []).map((v) => {
    const s = scriptOf.get(v.id);
    const job = jobsOf.get(v.id)?.[0];
    const version = versionsOf.get(v.id)?.[0] as { number: number; status: VersionStatus } | undefined;
    const facts: PipelineFacts = {
      status: v.status,
      hasBrief: !!v.brief?.trim(),
      script: s ? { status: s.status, hasBody: !!s.body.trim(), hasPrompt: !!s.edit_prompt?.trim() } : null,
      nextShoot: shootsOf.get(v.id)?.[0]?.starts_at ?? null,
      footage: footageOf.get(v.id)?.length ?? 0,
      footageComplete: !!v.footage_complete_at,
      job: job && (job.status === "queued" || job.status === "running" || job.status === "failed") ? { status: job.status, progress: job.progress } : null,
      version: version ? { number: version.number, status: version.status } : null,
    };
    const open = v.status !== "delivered";
    return {
      id: v.id,
      title: v.title,
      status: v.status,
      format: v.format,
      due: v.due_on,
      updated: v.updated_at,
      client: v.client,
      editor: v.editor ? displayName(v.editor) : null,
      editorId: v.editor_id,
      next: nextStep(facts),
      overdue: open && !!v.due_on && v.due_on < day,
      soon: open && !!v.due_on && v.due_on >= day && v.due_on <= daysFrom(day, 3),
      references: (refsOf.get(v.id)?.length ?? 0) + (v.client ? clientRefs.get(v.client.id) ?? 0 : 0),
      version: version?.number ?? null,
    };
  });

  // Filters live in the address, so a view can be shared and the back button works.
  const clients = [...new Map(all.flatMap((c) => (c.client ? [[c.client.id, c.client] as const] : []))).values()].sort((a, b) => a.name.localeCompare(b.name));
  const scoped = all.filter((c) => (!filters.client || c.client?.id === filters.client) && (filters.mine !== "1" || c.editorId === viewer.id));
  const open = scoped.filter((c) => c.status !== "delivered");
  const counts = {
    studio: open.filter((c) => c.next.who === "studio").length,
    client: open.filter((c) => c.next.who === "client").length,
    engine: open.filter((c) => c.next.who === "engine").length,
    crew: open.filter((c) => c.next.who === "crew").length,
    overdue: open.filter((c) => c.overdue).length,
  };
  const shown = open.filter((c) => (filters.who === "overdue" ? c.overdue : !filters.who || c.next.who === filters.who));
  const recentCut = daysFrom(day, -30);
  const delivered = scoped.filter((c) => c.status === "delivered" && (filters.done === "all" || c.updated.slice(0, 10) >= recentCut));
  const sorted = (cards: Card[]) =>
    [...cards].sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.due ?? "9999").localeCompare(b.due ?? "9999") || b.updated.localeCompare(a.updated));
  const href = (change: Partial<Filters>) => {
    const next = { ...filters, ...change };
    const q = new URLSearchParams(Object.entries(next).filter((e): e is [string, string] => !!e[1]));
    return q.size ? `/pipeline?${q}` : "/pipeline";
  };
  const list = filters.view === "list";
  const working = open.some((c) => c.next.who === "engine");

  return (
    <>
      <PageHeader
        eyebrow={viewer.role === "admin" ? "Every client" : "Your clients"}
        title="Pipeline"
        description="Where every video stands, what comes next and who it's waiting on."
        actions={
          viewer.role === "admin" ? (
            <LinkButton href="/clients" variant="primary">
              New video
            </LinkButton>
          ) : null
        }
      />
      {working && <AutoRefresh seconds={15} />}
      {all.length === 0 ? (
        <EmptyState title="No videos yet">
          {viewer.role === "admin" ? "Create a client, then add their first video." : "When the studio manager assigns you a client, their videos show up here."}
        </EmptyState>
      ) : (
        <>
          {/* Who is it waiting on: each count filters the board. */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Stat href={href({ who: undefined })} active={!filters.who} label="In progress" value={open.length} />
            <Stat href={href({ who: "studio" })} active={filters.who === "studio"} label="Needs the studio" value={counts.studio} who="studio" />
            <Stat href={href({ who: "client" })} active={filters.who === "client"} label="With the client" value={counts.client} who="client" />
            <Stat href={href({ who: "crew" })} active={filters.who === "crew"} label="With the videographer" value={counts.crew} who="crew" />
            <Stat href={href({ who: "engine" })} active={filters.who === "engine"} label="Claude is working" value={counts.engine} who="engine" />
            <Stat href={href({ who: "overdue" })} active={filters.who === "overdue"} label="Overdue" value={counts.overdue} danger={counts.overdue > 0} />
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            <nav aria-label="Client" className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              <Chip href={href({ client: undefined })} active={!filters.client}>
                All clients
              </Chip>
              {clients.map((c) => (
                <Chip key={c.id} href={href({ client: c.id })} active={filters.client === c.id}>
                  {c.name}
                </Chip>
              ))}
            </nav>
            <Chip href={href({ mine: filters.mine === "1" ? undefined : "1" })} active={filters.mine === "1"}>
              My videos
            </Chip>
            <div className="glass flex rounded-full p-0.5" role="group" aria-label="View">
              <Link href={href({ view: undefined })} aria-current={!list ? "page" : undefined} className={cx("flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px]", !list ? "bg-white/12 text-ink" : "text-muted hover:text-ink")}>
                <LayoutGrid size={14} aria-hidden /> Board
              </Link>
              <Link href={href({ view: "list" })} aria-current={list ? "page" : undefined} className={cx("flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px]", list ? "bg-white/12 text-ink" : "text-muted hover:text-ink")}>
                <List size={14} aria-hidden /> List
              </Link>
            </div>
          </div>

          {list ? (
            <div className="flex flex-col gap-6">
              {PHASES.filter((p) => p.key !== "done").map((phase) => {
                const items = sorted(shown.filter((c) => phase.statuses.includes(c.status)));
                if (!items.length) return null;
                return (
                  <section key={phase.key} aria-label={phase.label} className="frost overflow-hidden rounded-[22px]">
                    <h2 className="flex items-baseline gap-2 border-b border-white/[0.07] px-5 py-3 text-sm font-semibold text-ink">
                      {phase.label} <span className="font-normal text-muted">{items.length}</span>
                      <span className="ml-auto text-xs font-normal text-muted">{phase.hint}</span>
                    </h2>
                    <ul className="divide-y divide-line">
                      {items.map((c) => (
                        <li key={c.id}>
                          <Link href={`/videos/${c.id}`} className="grid grid-cols-1 gap-x-4 gap-y-1 px-5 py-3 hover:bg-white/[0.03] md:grid-cols-[minmax(0,1.4fr)_120px_minmax(0,1.6fr)_90px_28px] md:items-center">
                            <span className="min-w-0">
                              <span className="block truncate text-xs text-muted">{c.client?.name}</span>
                              <span className="block truncate text-sm font-medium text-ink">{c.title}</span>
                            </span>
                            <span className="text-xs text-ink-2">{videoStatusLabel(c.status)}</span>
                            <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink-2">
                              <WhoDot who={c.next.who} />
                              <span className="truncate">{c.next.label}</span>
                            </span>
                            <Due card={c} />
                            <span>{c.editor && <Avatar name={c.editor} size={24} />}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
              {shown.length === 0 && <EmptyState title="Nothing here">No video matches these filters.</EmptyState>}
            </div>
          ) : (
            <div className="pb-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {PHASES.filter((p) => p.key !== "done").map((phase) => {
                  const items = sorted(shown.filter((c) => phase.statuses.includes(c.status)));
                  return (
                    <section key={phase.key} aria-label={phase.label} className="flex min-w-0 flex-col gap-2">
                      <div className="px-1">
                        <h2 className="flex items-center justify-between text-[13px] font-semibold text-ink">
                          {phase.label}
                          <span className="rounded-full bg-white/8 px-2 py-0.5 text-[11px] font-medium text-ink-2 tabular-nums">{items.length}</span>
                        </h2>
                        <p className="text-[11px] text-muted">{phase.hint}</p>
                      </div>
                      <div className="flex min-h-28 flex-col gap-2 rounded-[20px] bg-white/[0.03] p-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
                        {items.map((c) => (
                          <BoardCard key={c.id} card={c} />
                        ))}
                        {items.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted">Nothing here</p>}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          )}

          <section aria-label="Delivered" className="mt-8">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[13px] font-semibold text-ink">
                Delivered <span className="font-normal text-muted">{filters.done === "all" ? "· all" : "· last 30 days"}</span>
              </h2>
              <Link href={href({ done: filters.done === "all" ? undefined : "all" })} className="text-xs text-accent hover:underline">
                {filters.done === "all" ? "Only the last 30 days" : "Show all"}
              </Link>
            </div>
            {delivered.length ? (
              <ul className="flex flex-wrap gap-2">
                {delivered.map((c) => (
                  <li key={c.id}>
                    <Link href={`/videos/${c.id}`} className="frost inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] hover:border-line-strong">
                      <WhoDot who="done" />
                      <span className="text-muted">{c.client?.name}</span>
                      <span className="text-ink">{c.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">Nothing delivered{filters.done === "all" ? " yet" : " in the last 30 days"}.</p>
            )}
          </section>
        </>
      )}
    </>
  );
}
