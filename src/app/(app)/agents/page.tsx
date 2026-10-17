import Link from "next/link";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { answeredCount, QUESTIONS, readAnswers } from "@/lib/questionnaire";
import { asCharte, asFindings, asPillars, asReels, asShootPlan } from "@/lib/agent-types";
import { parseShotList } from "@/lib/workflow";
import { AutoRefresh } from "@/components/auto-refresh";
import { EmptyState, LinkButton, PageHeader, cx } from "@/components/ui";
import { AgentHud, type HudEvent, type HudLink, type HudNode, type NodeId, type NodeState } from "@/components/agents/hud";
import { FindingsView, ShootPlanView, StrategyView } from "@/components/agents/views";

export const metadata: Metadata = { title: "Agents" };

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));

// Mission control: the three agents, the videographer and the edit engine for one
// client (and one of their videos), read live from the database.
export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ client?: string; video?: string }> }) {
  await requireRole("admin", "editor");
  const { client: clientParam, video: videoParam } = await searchParams;
  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("id, name").order("name");
  if (!clients?.length) {
    return (
      <>
        <PageHeader title="Agents" />
        <EmptyState title="No clients yet">Add a client to see their agents at work.</EmptyState>
      </>
    );
  }
  const client = clients.find((c) => c.id === clientParam) ?? clients[0];

  const [{ data: form }, { data: strategy }, { data: reports }, { data: videos }, { data: kit }] = await Promise.all([
    supabase.from("brand_questionnaires").select("answers, updated_at").eq("client_id", client.id).maybeSingle(),
    supabase.from("brand_strategies").select("*").eq("client_id", client.id).maybeSingle(),
    supabase
      .from("trend_reports")
      .select("id, status, hashtags, accounts, progress, error, created_at, started_at, finished_at, findings, reels")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("videos").select("id, title, status, footage_complete_at, created_at").eq("client_id", client.id).order("created_at", { ascending: false }),
    supabase.from("brand_kits").select("style_rules").eq("client_id", client.id).maybeSingle(),
  ]);
  const video = (videos ?? []).find((v) => v.id === videoParam) ?? videos?.[0] ?? null;
  const [{ data: script }, { data: footage }, { data: jobs }, { data: versions }] = video
    ? await Promise.all([
        supabase.from("scripts").select("body, shot_list, shoot_plan, edit_prompt, updated_at").eq("video_id", video.id).maybeSingle(),
        supabase.from("footage").select("file_name, created_at").eq("video_id", video.id).order("created_at"),
        supabase.from("edit_jobs").select("id, source, status, progress, error, created_at, started_at, finished_at").eq("video_id", video.id).order("created_at"),
        supabase.from("versions").select("number, status, made_by, created_at").eq("video_id", video.id).order("number"),
      ])
    : [{ data: null }, { data: null }, { data: null }, { data: null }];

  // ------------------------------------------------------------ state of each node
  const answers = readAnswers(form?.answers);
  const answered = answeredCount(answers);
  const latestReport = reports?.[0] ?? null;
  const doneReport = (reports ?? []).find((r) => r.status === "done") ?? null;
  const findings = asFindings(doneReport?.findings);
  const reels = asReels(doneReport?.reels);
  const charte = asCharte(strategy?.charte);
  const plan = asShootPlan(script?.shoot_plan);
  const shots = parseShotList(script?.shot_list);
  const openJob = (jobs ?? []).find((j) => j.status === "queued" || j.status === "running");
  const lastJob = jobs?.at(-1);
  const researching = latestReport && (latestReport.status === "queued" || latestReport.status === "running");
  const plays = reels.reduce((a, r) => a + Math.max(0, r.plays ?? 0), 0);

  const st = (busy: boolean, done: boolean, failed = false): NodeState => (busy ? "busy" : failed ? "failed" : done ? "done" : "idle");
  const nodes: HudNode[] = [
    { id: "client", kind: "INPUT", title: "CLIENT", role: "Brand questionnaire", meta: `${answered}/${QUESTIONS.length} answers`, state: st(false, answered >= 4) },
    { id: "a1", kind: "AGENT 01", title: "STRATEGIST", role: "Niche, charte graphique, business & needs", meta: strategy ? `${strategy.keywords.length} hashtags · ${charte?.palette.length ?? 0} colors` : "waiting", state: st(false, !!strategy) },
    { id: "apify", kind: "SOURCE", title: "APIFY", role: "Instagram search", meta: latestReport ? [...latestReport.hashtags.map((h) => `#${h}`)].slice(0, 2).join(" ") || "accounts" : "idle", state: st(!!researching && latestReport?.progress?.startsWith("Searching") === true, !!doneReport) },
    { id: "a2", kind: "AGENT 02", title: "RESEARCHER", role: "Watches the top reels, writes what works", meta: doneReport ? `${reels.length} reels · ${compact(plays)} plays` : "waiting", state: st(!!researching, !!doneReport, latestReport?.status === "failed"), progress: researching ? latestReport?.progress ?? "Queued on the engine" : null },
    { id: "a3", kind: "AGENT 03", title: "SCRIPTWRITER", role: "Script, shoot plan, edit prompt", meta: plan ? `${plan.scenes.length} scenes · ${Math.round(plan.length_seconds)}s` : script ? "script only" : "waiting", state: st(false, !!script?.edit_prompt) },
    { id: "shoot", kind: "HUMAN", title: "VIDEOGRAPHER", role: "Shoots from the plan", meta: footage?.length ? `${footage.length} file${footage.length > 1 ? "s" : ""}` : `${shots.length} shots to get`, state: st(!!footage?.length && !video?.footage_complete_at, !!video?.footage_complete_at) },
    { id: "engine", kind: "ENGINE", title: "EDIT ENGINE", role: "Cuts, captions, 3D motion, music", meta: openJob ? "editing" : versions?.length ? `v${versions.at(-1)!.number} rendered` : "waiting for footage", state: st(!!openJob, !!versions?.length, !openJob && lastJob?.status === "failed"), progress: openJob ? openJob.progress ?? "Queued" : null },
    { id: "video", kind: "OUTPUT", title: "VIDEO", role: video?.title ?? "No video yet", meta: versions?.length ? `v${versions.at(-1)!.number} · ${versions.at(-1)!.status.replace("_", " ")}` : "—", state: st(false, !!versions?.length) },
  ];
  const links: HudLink[] = [
    { a: "client", b: "a1", label: "questionnaire", active: answered > 0 },
    { a: "a1", b: "apify", label: strategy ? strategy.keywords.slice(0, 3).map((k) => `#${k}`).join(" ") : "hashtags", active: !!latestReport },
    { a: "apify", b: "a2", label: doneReport ? `${reels.length} top reels` : "reels", active: !!doneReport || !!researching },
    { a: "a1", b: "a2", label: "niche + audience", active: !!strategy && !!latestReport },
    { a: "a1", b: "a3", label: "charte + pillars", active: !!strategy && !!script },
    { a: "a2", b: "a3", label: findings ? `${findings.hooks.length} hooks · ${findings.structures.length} structures` : "key points", hot: true, active: !!findings && !!script },
    { a: "a3", b: "shoot", label: "shoot plan", active: !!plan },
    { a: "a3", b: "engine", label: "edit prompt", hot: true, active: !!script?.edit_prompt },
    { a: "shoot", b: "engine", label: "footage", active: !!footage?.length },
    { a: "engine", b: "video", label: "render", active: !!versions?.length },
  ];

  // ------------------------------------------------------------ the comm log, from timestamps
  const events: HudEvent[] = [];
  if (form) events.push({ at: form.updated_at, who: "CLIENT → STRATEGIST", msg: `${answered} questionnaire answers`, link: 0 });
  if (strategy) {
    events.push({ at: strategy.updated_at, who: "STRATEGIST → RESEARCHER", msg: `Niche: ${strategy.niche}`, link: 3 });
    events.push({ at: strategy.updated_at, who: "STRATEGIST → SCRIPTWRITER", msg: `Charte graphique + ${asPillars(strategy.pillars).length} content pillars`, link: 4 });
  }
  for (const r of [...(reports ?? [])].reverse()) {
    const q = [...r.hashtags.map((h) => `#${h}`), ...r.accounts.map((a) => `@${a}`)].join(" ");
    events.push({ at: r.created_at, who: "STUDIO → RESEARCHER", msg: `Research requested: ${q}` });
    if (r.started_at) events.push({ at: r.started_at, who: "RESEARCHER → APIFY", msg: `Search ${q}`, link: 1 });
    if (r.status === "done" && r.finished_at) {
      const f = asFindings(r.findings);
      events.push({ at: r.finished_at, who: "APIFY → RESEARCHER", msg: `${asReels(r.reels).length} top reels watched`, link: 2 });
      if (f) events.push({ at: r.finished_at, who: "RESEARCHER → SCRIPTWRITER", msg: `${f.hooks.length} hooks, ${f.structures.length} structures, ${f.ideas.length} ideas`, link: 5 });
    }
    if (r.status === "failed" && r.finished_at) events.push({ at: r.finished_at, who: "RESEARCHER", msg: `Failed: ${r.error ?? "unknown error"}`, tone: "bad" });
  }
  if (script?.edit_prompt) {
    events.push({ at: script.updated_at, who: "SCRIPTWRITER → VIDEOGRAPHER", msg: plan ? `${plan.scenes.length} scenes, ${shots.length} shots` : `${shots.length} shots`, link: 6 });
    events.push({ at: script.updated_at, who: "SCRIPTWRITER → ENGINE", msg: `Edit prompt (${script.edit_prompt.split(/\s+/).length} words)`, link: 7 });
  }
  if (footage?.length) events.push({ at: footage[0].created_at, who: "VIDEOGRAPHER → ENGINE", msg: `Footage: ${footage.length} file${footage.length > 1 ? "s" : ""} (first: ${footage[0].file_name})`, link: 8 });
  if (video?.footage_complete_at) events.push({ at: video.footage_complete_at, who: "VIDEOGRAPHER → ENGINE", msg: "All footage is in: start the edit", link: 8 });
  for (const j of jobs ?? []) {
    events.push({ at: j.created_at, who: "ENGINE", msg: `${j.source === "launch" ? "Edit" : j.source === "editor_fix" ? "Editor fixes" : "Client changes"} queued` });
    if (j.started_at) events.push({ at: j.started_at, who: "ENGINE", msg: "Claude is editing" });
    if (j.finished_at && j.status === "failed") events.push({ at: j.finished_at, who: "ENGINE", msg: `Failed: ${j.error ?? ""}`, tone: "bad" });
  }
  for (const v of versions ?? []) events.push({ at: v.created_at, who: "ENGINE → VIDEO", msg: `v${v.number} ready (${v.made_by === "claude" ? "Claude" : "editor"})`, link: 9 });
  events.sort((a, b) => a.at.localeCompare(b.at));

  // ------------------------------------------------------------ panels
  const brandLink = `/clients/${client.id}/brand`;
  const empty = (title: string, body: string, href?: string, action?: string) => (
    <EmptyState title={title}>
      {body} {href && action && <Link href={href} className="text-accent">{action}</Link>}
    </EmptyState>
  );
  const panels: Partial<Record<NodeId, ReactNode>> = {
    client: answered ? (
      <dl className="flex flex-col gap-2 text-sm">
        {QUESTIONS.filter((q) => answers[q.key]).map((q) => (
          <div key={q.key}>
            <dt className="text-xs text-muted">{q.label}</dt>
            <dd className="text-ink-2">{answers[q.key]}</dd>
          </div>
        ))}
      </dl>
    ) : (
      empty("No answers yet", "The client fills it in under Your brand, or you can.", brandLink, "Open the questionnaire")
    ),
    a1: strategy ? (
      <StrategyView niche={strategy.niche} keywords={strategy.keywords} accounts={strategy.reference_accounts} business={strategy.business} audience={strategy.audience} needs={strategy.needs} pillars={asPillars(strategy.pillars)} charte={charte} />
    ) : (
      empty("Not run yet", answered >= 4 ? "The questionnaire is ready." : "Fill in at least 4 answers first.", brandLink, "Run the strategist")
    ),
    apify: latestReport ? (
      <div className="flex flex-col gap-2 text-sm text-ink-2">
        <p>Last search: {[...latestReport.hashtags.map((h) => `#${h}`), ...latestReport.accounts.map((a) => `@${a}`)].join(" ")}</p>
        <p className="text-muted">Apify returns the reels with their video file, plays, likes, comments and caption. The researcher keeps the top 10 by reach, at most 3 per account.</p>
      </div>
    ) : (
      empty("No search yet", "Agent 2 sends the strategy's hashtags here.", brandLink, "Start a research run")
    ),
    a2: findings ? (
      <FindingsView findings={findings} reels={reels} />
    ) : researching ? (
      <p className="text-sm text-ink-2">{latestReport?.progress ?? "Queued on the edit engine."}</p>
    ) : (
      empty(latestReport?.status === "failed" ? "The last run failed" : "No research yet", latestReport?.error ?? "Run it from the Brand & strategy page.", brandLink, "Open")
    ),
    a3:
      script?.edit_prompt && video ? (
        <div className="flex flex-col gap-4">
          {plan && <ShootPlanView plan={plan} />}
          <div>
            <div className="kicker mb-2">Edit prompt → engine</div>
            <pre className="whitespace-pre-wrap rounded-xl bg-black/40 p-3 font-mono text-[12.5px] leading-relaxed text-[#c6f0ff]">{script.edit_prompt}</pre>
          </div>
        </div>
      ) : (
        empty("No script from the scriptwriter yet", video ? "Open the video and press Write with the scriptwriter." : "Create a video for this client first.", video ? `/videos/${video.id}` : `/clients/${client.id}`, "Open")
      ),
    shoot: (
      <div className="flex flex-col gap-3 text-sm">
        <div className="kicker">Footage</div>
        {footage?.length ? (
          <ul className="flex flex-col gap-1 text-ink-2">{footage.map((f, i) => <li key={i}>{f.file_name}</li>)}</ul>
        ) : (
          <p className="text-muted">Nothing uploaded yet.</p>
        )}
        <p className={cx(video?.footage_complete_at ? "text-success" : "text-muted")}>{video?.footage_complete_at ? "Marked complete: the edit started." : "Not marked complete yet."}</p>
        {shots.length > 0 && (
          <>
            <div className="kicker">Shot list</div>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-ink-2">{shots.map((s, i) => <li key={i} className={s.done ? "text-muted line-through" : ""}>{s.text}</li>)}</ul>
          </>
        )}
      </div>
    ),
    engine: (
      <div className="flex flex-col gap-3 text-sm">
        {(jobs ?? []).length ? (
          <ul className="flex flex-col gap-2">
            {[...(jobs ?? [])].reverse().map((j) => (
              <li key={j.id} className="rounded-xl border border-line p-2.5">
                <div className="font-medium text-ink">{j.source.replace("_", " ")} · {j.status}</div>
                {j.progress && <div className="text-muted">{j.progress}</div>}
                {j.error && <div className="text-danger">{j.error}</div>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">No edit yet. It starts when the videographer marks the footage complete.</p>
        )}
        {kit?.style_rules && (
          <>
            <div className="kicker">Brand rules it follows</div>
            <p className="text-ink-2">{kit.style_rules}</p>
          </>
        )}
      </div>
    ),
    video: video ? (
      <div className="flex flex-col gap-3 text-sm">
        <ul className="flex flex-col gap-1 text-ink-2">{(versions ?? []).map((v) => <li key={v.number}>v{v.number} · {v.status.replace("_", " ")} · {v.made_by}</li>)}</ul>
        <LinkButton href={`/videos/${video.id}`} size="sm">Open the video</LinkButton>
      </div>
    ) : (
      empty("No video yet", "Create one on the client page.", `/clients/${client.id}`, "Open the client")
    ),
  };

  const meters = [
    { label: "Questionnaire", value: `${answered}/${QUESTIONS.length}`, fill: answered / QUESTIONS.length },
    { label: "Reels studied", value: String(reels.length), fill: reels.length / 10 },
    { label: "Plays studied", value: compact(plays), fill: plays ? 1 : 0 },
    { label: "Hooks found", value: String(findings?.hooks.length ?? 0), fill: (findings?.hooks.length ?? 0) / 8 },
    { label: "Scenes planned", value: String(plan?.scenes.length ?? 0), fill: (plan?.scenes.length ?? 0) / 8 },
    { label: "Versions", value: String(versions?.length ?? 0), fill: Math.min(1, (versions?.length ?? 0) / 3) },
  ];
  const live = !!researching || !!openJob;

  return (
    <>
      <PageHeader
        eyebrow="Mission control"
        title="Agents"
        description="How the three agents, the videographer and the edit engine pass work to each other for one client. Click a node to read what it produced."
        actions={<LinkButton href={brandLink}>Brand & strategy</LinkButton>}
      />
      {live && <AutoRefresh seconds={5} />}
      <nav aria-label="Client" className="mb-3 flex flex-wrap gap-2">
        {clients.map((c) => (
          <Link key={c.id} href={`/agents?client=${c.id}`} className={cx("rounded-full px-3 py-1 text-[13px]", c.id === client.id ? "bg-accent text-accent-ink" : "bg-white/8 text-ink-2 hover:text-ink")}>
            {c.name}
          </Link>
        ))}
      </nav>
      {(videos ?? []).length > 1 && (
        <nav aria-label="Video" className="mb-4 flex flex-wrap gap-2">
          {(videos ?? []).map((v) => (
            <Link key={v.id} href={`/agents?client=${client.id}&video=${v.id}`} className={cx("rounded-full border px-3 py-1 text-xs", v.id === video?.id ? "border-accent text-accent" : "border-line text-muted hover:text-ink")}>
              {v.title}
            </Link>
          ))}
        </nav>
      )}
      <AgentHud
        nodes={nodes}
        links={links}
        events={events}
        panels={panels}
        satellites={reels.map((r) => ({ label: `@${r.owner} · ${compact(Math.max(0, r.plays ?? 0))} plays`, weight: Math.max(1, r.plays ?? 1) }))}
        swatches={(charte?.palette ?? []).map((c) => c.hex)}
        meters={meters}
      />
    </>
  );
}
