import Link from "next/link";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { answeredCount, QUESTIONS, readAnswers } from "@/lib/questionnaire";
import { asCharte, asDesignBrief, asFindings, asPillars, asPlan, asReels, asReferenceBreakdown, asShootPlan, asSoundReport, asTrendAudio } from "@/lib/agent-types";
import { ROSTER } from "@/lib/agent-roster";
import { allSkills, type AgentKey } from "@/lib/skills";
import { kickQueue } from "@/lib/production";
import { PLATFORM_LABEL, type ReferencePlatform } from "@/lib/reference-links";
import { parseShotList } from "@/lib/workflow";
import { AutoRefresh } from "@/components/auto-refresh";
import { EmptyState, LinkButton, PageHeader, cx } from "@/components/ui";
import { AgentHud, type HudEvent, type HudLink, type HudNode, type NodeId, type NodeState } from "@/components/agents/hud";
import { DesignBriefView, FindingsView, ShootPlanView, SoundView, StrategyView } from "@/components/agents/views";
import { WindowPage } from "@/components/desktop/window-page";
import { friendlyError } from "@/lib/errors";

export const metadata: Metadata = { title: "Agents" };

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
// Something that happened in the last two minutes fires a burst on its track.
const isFresh = (iso: string) => Date.now() - Date.parse(iso) < 120_000;
const busy = (status?: string | null) => status === "queued" || status === "running";

// Mission control: the agents, the references, the videographer and the edit engine for one
// client (and one of their videos), read live from the database.
export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ client?: string; video?: string }> }) {
  await requireRole("admin", "editor");
  const { client: clientParam, video: videoParam } = await searchParams;
  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("id, name").order("name");
  if (!clients?.length) {
    return (
      <WindowPage>
        <PageHeader title="Agents" />
        <EmptyState title="No clients yet">Add a client to see their agents at work.</EmptyState>
      </WindowPage>
    );
  }
  const client = clients.find((c) => c.id === clientParam) ?? clients[0];

  const [{ data: form }, { data: strategy }, { data: reports }, { data: videos }, { data: kit }, { data: allRefs }, { data: runs }, library] = await Promise.all([
    supabase.from("brand_questionnaires").select("answers, updated_at").eq("client_id", client.id).maybeSingle(),
    supabase.from("brand_strategies").select("*").eq("client_id", client.id).maybeSingle(),
    supabase
      .from("trend_reports")
      .select("id, status, hashtags, accounts, progress, error, created_at, started_at, finished_at, findings, reels, audio")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("videos").select("id, title, status, footage_complete_at, created_at").eq("client_id", client.id).order("created_at", { ascending: false }),
    supabase.from("brand_kits").select("style_rules, graphics").eq("client_id", client.id).maybeSingle(),
    supabase
      .from("reference_videos")
      .select("id, video_id, url, platform, focus, note, status, progress, error, watched, title, owner, analysis, created_at, finished_at")
      .eq("client_id", client.id)
      .order("created_at"),
    supabase.from("agent_runs").select("id, agent, status, progress, error, video_id, output, created_at, started_at, finished_at").eq("client_id", client.id).order("created_at", { ascending: false }).limit(60),
    allSkills(),
  ]);
  await kickQueue();
  const video = (videos ?? []).find((v) => v.id === videoParam) ?? videos?.[0] ?? null;
  // The references this video's agents work from: its own and the client's.
  const refs = (allRefs ?? []).filter((r) => !r.video_id || r.video_id === video?.id);
  const refsDone = refs.filter((r) => r.status === "done");
  const refsPending = refs.filter((r) => r.status === "queued" || r.status === "running");
  const [{ data: script }, { data: footage }, { data: jobs }, { data: versions }, { data: asks }] = video
    ? await Promise.all([
        supabase.from("scripts").select("body, shot_list, shoot_plan, edit_prompt, updated_at, design_brief, design_templates").eq("video_id", video.id).maybeSingle(),
        supabase.from("footage").select("file_name, created_at").eq("video_id", video.id).order("created_at"),
        supabase.from("edit_jobs").select("id, source, status, progress, error, created_at, started_at, finished_at").eq("video_id", video.id).order("created_at"),
        supabase.from("versions").select("number, status, made_by, created_at, sound").eq("video_id", video.id).order("number"),
        supabase.from("script_revisions").select("kind, request, reply, created_at").eq("video_id", video.id).in("kind", ["revised", "client"]).order("created_at"),
      ])
    : [{ data: null }, { data: null }, { data: null }, { data: null }, { data: null }];

  // ------------------------------------------------------------ state of each card
  const skills = (agent: AgentKey) => library.filter((s) => s.agents.includes(agent)).map((s) => ({ name: s.name, description: s.description }));
  const answers = readAnswers(form?.answers);
  const answered = answeredCount(answers);
  const latestReport = reports?.[0] ?? null;
  const doneReport = (reports ?? []).find((r) => r.status === "done") ?? null;
  const findings = asFindings(doneReport?.findings);
  const reels = asReels(doneReport?.reels);
  const trendAudio = asTrendAudio(doneReport?.audio);
  const scored = [...(versions ?? [])].reverse().find((v) => asSoundReport(v.sound));
  const sound = asSoundReport(scored?.sound);
  const charte = asCharte(strategy?.charte);
  const shootPlan = asShootPlan(script?.shoot_plan);
  const shots = parseShotList(script?.shot_list);
  const openJob = (jobs ?? []).find((j) => j.status === "queued" || j.status === "running");
  const scoring = !!openJob?.progress && /sound designer/i.test(openJob.progress);
  const designBrief = asDesignBrief(script?.design_brief);
  const designed = kit?.graphics === "designed" || !!script?.design_templates?.length;
  const drawing = !!openJob?.progress && /design|graphics/i.test(openJob.progress);
  const lastJob = jobs?.at(-1);
  const researching = busy(latestReport?.status);
  const plays = reels.reduce((a, r) => a + Math.max(0, r.plays ?? 0), 0);
  const runsOf = (agent: string) => (runs ?? []).filter((r) => r.agent === agent);
  const strategistRun = runsOf("strategist")[0] ?? null;
  const plannerRun = runsOf("planner")[0] ?? null;
  const planRun = runsOf("planner").find((r) => r.status === "done") ?? null;
  const monthPlan = asPlan(planRun?.output);
  const created = monthPlan?.ideas.filter((i) => i.video_id).length ?? 0;
  const writers = runsOf("scriptwriter");
  const writing = writers.filter((r) => busy(r.status));
  const writingNow = writing.find((r) => r.status === "running");
  const lastWrite = writers[0] ?? null;

  const st = (working: boolean, done: boolean, failed = false): NodeState => (working ? "busy" : failed ? "failed" : done ? "done" : "idle");
  const nodes: HudNode[] = [
    { id: "client", kind: "Input", title: "Client", role: "The brand questionnaire, answered during onboarding.", meta: `${answered} of ${QUESTIONS.length} answers`, state: st(false, answered >= 4) },
    {
      id: "refs",
      kind: "Input",
      title: "References",
      role: "Reels and videos the studio picked: the look to match.",
      meta: refs.length ? `${plural(refs.length, "reference")} · ${refsDone.filter((r) => r.watched).length} watched` : "none yet",
      state: st(refsPending.length > 0, refsDone.length > 0, refs.length > 0 && refs.every((r) => r.status === "failed")),
      progress: refsPending.find((r) => r.status === "running")?.progress ?? (refsPending.length ? "Waiting for the edit engine" : null),
    },
    {
      id: "strategist",
      kind: "Agent 01",
      title: ROSTER.strategist.name,
      role: ROSTER.strategist.does,
      meta: strategy ? (strategy.niche ?? "strategy ready") : answered >= 4 ? "ready to start" : "waiting for the answers",
      state: st(busy(strategistRun?.status), !!strategy, !strategy && strategistRun?.status === "failed"),
      progress: busy(strategistRun?.status) ? (strategistRun?.progress ?? "Starting") : null,
      skills: skills("strategist"),
    },
    {
      id: "researcher",
      kind: "Agent 02",
      title: ROSTER.researcher.name,
      role: ROSTER.researcher.does,
      meta: doneReport ? `${plural(reels.length, "reel")} · ${compact(plays)} plays` : strategy ? "ready to search" : "waiting for the strategy",
      state: st(researching, !!doneReport, latestReport?.status === "failed"),
      progress: researching ? (latestReport?.progress ?? "Waiting for the edit engine") : null,
      skills: skills("researcher"),
    },
    {
      id: "planner",
      kind: "Agent 03",
      title: ROSTER.planner.name,
      role: ROSTER.planner.does,
      meta: monthPlan ? `${plural(monthPlan.ideas.length, "idea")} · ${plural(created, "video")} made` : strategy ? "ready to plan" : "waiting for the strategy",
      state: st(busy(plannerRun?.status), !!monthPlan, !monthPlan && plannerRun?.status === "failed"),
      progress: busy(plannerRun?.status) ? (plannerRun?.progress ?? "Starting") : null,
      skills: skills("planner"),
    },
    {
      id: "scriptwriter",
      kind: "Agent 04",
      title: ROSTER.scriptwriter.name,
      role: ROSTER.scriptwriter.does,
      meta: shootPlan ? `${plural(shootPlan.scenes.length, "scene")} · ${Math.round(shootPlan.length_seconds)} s` : script?.body.trim() ? "script only" : "waiting for a brief",
      state: st(writing.length > 0, !!script?.edit_prompt, !writing.length && lastWrite?.status === "failed"),
      progress: writing.length ? `${writingNow?.progress ?? "Writing"}: ${plural(writing.length, "script")} to go` : null,
      skills: skills("scriptwriter"),
    },
    {
      id: "motion",
      kind: "Agent 05",
      title: ROSTER.motion.name,
      role: ROSTER.motion.does,
      meta: designBrief ? `${plural(designBrief.scenes.length, "scene")} designed` : designed ? "waiting for the script" : "engine templates",
      state: st(drawing, !!designBrief),
      progress: drawing ? (openJob?.progress ?? null) : null,
      skills: skills("motion"),
    },
    {
      id: "shoot",
      kind: "Human",
      title: "Videographer",
      role: "Shoots from the shoot plan and drops the footage.",
      meta: footage?.length ? plural(footage.length, "file") : `${plural(shots.length, "shot")} to get`,
      state: st(!!footage?.length && !video?.footage_complete_at, !!video?.footage_complete_at),
    },
    {
      id: "engine",
      kind: "Engine",
      title: ROSTER.engine.name,
      role: ROSTER.engine.does,
      meta: openJob ? "editing" : versions?.length ? `v${versions.at(-1)!.number} rendered` : "waiting for footage",
      state: st(!!openJob, !!versions?.length, !openJob && lastJob?.status === "failed"),
      progress: openJob ? (openJob.progress ?? "Queued") : null,
      skills: skills("editor"),
    },
    {
      id: "sound",
      kind: "Agent 06",
      title: ROSTER.sound.name,
      role: `${ROSTER.sound.does} It also reads the research's trending sounds.`,
      meta: sound ? (sound.track ? sound.track.title : "dialogue only") : trendAudio.length ? `${plural(trendAudio.length, "trending sound")} in` : "waiting for a cut",
      state: st(scoring, !!sound),
      progress: scoring ? (openJob?.progress ?? null) : null,
      skills: skills("sound"),
    },
    {
      id: "video",
      kind: "Output",
      title: "Video",
      role: video?.title ?? "No video yet",
      meta: versions?.length ? `v${versions.at(-1)!.number} · ${versions.at(-1)!.status.replace("_", " ")}` : video ? video.title : "—",
      state: st(false, !!versions?.length),
    },
  ];
  const links: HudLink[] = [
    { id: "client-strategist", label: "questionnaire", active: answered > 0 },
    { id: "strategist-researcher", label: strategy ? strategy.keywords.slice(0, 2).map((k) => `#${k}`).join(" ") || "hashtags" : "hashtags", active: !!latestReport },
    { id: "strategist-planner", label: "pillars + goals", active: !!strategy && !!monthPlan },
    { id: "researcher-planner", label: findings ? `${plural(findings.ideas.length, "idea")} that work` : "what works", hot: true, active: !!findings && !!monthPlan },
    { id: "researcher-scriptwriter", label: findings ? plural(findings.hooks.length, "hook") : "hooks + structures", hot: true, active: !!findings && !!script?.body.trim() },
    { id: "planner-scriptwriter", label: created ? plural(created, "brief") : "briefs", active: created > 0 },
    { id: "refs-scriptwriter", label: refsDone.length ? plural(refsDone.length, "breakdown") : "breakdowns", hot: true, active: refsDone.length > 0 && !!script?.body.trim() },
    { id: "refs-motion", label: "look to match", active: refsDone.length > 0 && !!designBrief },
    { id: "scriptwriter-motion", label: "script", active: !!designBrief },
    { id: "scriptwriter-shoot", label: "shoot plan", active: !!shootPlan },
    { id: "scriptwriter-engine", label: "edit prompt", hot: true, active: !!script?.edit_prompt },
    { id: "motion-engine", label: designBrief ? plural(designBrief.scenes.length, "design prompt") : "design prompts", hot: true, active: !!designBrief },
    { id: "shoot-engine", label: "footage", active: !!footage?.length },
    { id: "sound-engine", label: "music + effects", hot: true, active: !!sound },
    { id: "engine-video", label: "render", active: !!versions?.length },
  ];

  // ------------------------------------------------------------ the comm log, from timestamps
  const short = (t: string | null, n = 160) => ((t ?? "").length > n ? `${t!.slice(0, n - 1)}…` : (t ?? ""));
  const events: HudEvent[] = [];
  if (form) events.push({ at: form.updated_at, who: "CLIENT → STRATEGIST", msg: `${answered} questionnaire answers`, link: "client-strategist" });
  for (const r of [...runsOf("strategist")].reverse()) {
    if (r.status === "failed" && r.finished_at) events.push({ at: r.finished_at, who: "BRAND STRATEGIST", msg: `Failed: ${friendlyError(r.error) ?? "unknown error"}`, tone: "bad" });
  }
  if (strategy) {
    events.push({ at: strategy.updated_at, who: "STRATEGIST → RESEARCHER", msg: `Niche: ${strategy.niche}`, link: "strategist-researcher" });
    events.push({ at: strategy.updated_at, who: "STRATEGIST → PLANNER", msg: `Charte graphique + ${plural(asPillars(strategy.pillars).length, "content pillar")}`, link: "strategist-planner" });
  }
  for (const r of [...(reports ?? [])].reverse()) {
    const q = [...r.hashtags.map((h) => `#${h}`), ...r.accounts.map((a) => `@${a}`)].join(" ");
    events.push({ at: r.created_at, who: "STUDIO → RESEARCHER", msg: `Research requested: ${q}` });
    if (r.started_at) events.push({ at: r.started_at, who: "RESEARCHER", msg: `Searching Instagram: ${q}`, link: "strategist-researcher" });
    if (r.status === "done" && r.finished_at) {
      const f = asFindings(r.findings);
      events.push({ at: r.finished_at, who: "RESEARCHER", msg: `${plural(asReels(r.reels).length, "top reel")} watched` });
      if (f) events.push({ at: r.finished_at, who: "RESEARCHER → SCRIPTWRITER", msg: `${plural(f.hooks.length, "hook")}, ${plural(f.structures.length, "structure")}, ${plural(f.ideas.length, "idea")}`, link: "researcher-scriptwriter" });
    }
    if (r.status === "failed" && r.finished_at) events.push({ at: r.finished_at, who: "RESEARCHER", msg: `Failed: ${friendlyError(r.error) ?? "unknown error"}`, tone: "bad" });
  }
  for (const r of [...runsOf("planner")].reverse()) {
    const p = asPlan(r.output);
    if (r.status === "done" && r.finished_at && p) events.push({ at: r.finished_at, who: "PLANNER → STUDIO", msg: `${plural(p.ideas.length, "video idea")} for ${p.month}`, link: "researcher-planner" });
    if (r.status === "failed" && r.finished_at) events.push({ at: r.finished_at, who: "CONTENT PLANNER", msg: `Failed: ${friendlyError(r.error) ?? "unknown error"}`, tone: "bad" });
  }
  const titleOf = new Map((videos ?? []).map((v) => [v.id, v.title]));
  for (const r of [...writers].reverse()) {
    const t = titleOf.get(r.video_id ?? "") ?? "a video";
    if (r.status === "done" && r.finished_at) events.push({ at: r.finished_at, who: "SCRIPTWRITER", msg: `Script ready: ${t}`, link: "planner-scriptwriter" });
    if (r.status === "failed" && r.finished_at) events.push({ at: r.finished_at, who: "SCRIPTWRITER", msg: `Couldn't write ${t}: ${friendlyError(r.error) ?? "unknown error"}`, tone: "bad" });
  }
  for (const r of refs) {
    const name = [PLATFORM_LABEL[r.platform as ReferencePlatform] ?? r.platform, r.owner].filter(Boolean).join(" ");
    events.push({ at: r.created_at, who: "STUDIO → REFERENCES", msg: `${name}${r.note ? `: ${short(r.note, 90)}` : ""}` });
    if (r.status === "done" && r.finished_at) {
      const b = asReferenceBreakdown(r.analysis);
      events.push({ at: r.finished_at, who: "REFERENCES → SCRIPTWRITER", msg: b ? `${name} broken down: ${short(b.summary, 120)}` : `${name}: ${friendlyError(r.error) ?? "link only"}`, link: "refs-scriptwriter" });
    }
    if (r.status === "failed" && r.finished_at) events.push({ at: r.finished_at, who: "REFERENCES", msg: `Couldn't watch ${name}: ${friendlyError(r.error) ?? "unknown error"}`, tone: "bad" });
  }
  if (designBrief) events.push({ at: designBrief.written_at, who: "MOTION DIRECTOR → ENGINE", msg: `${plural(designBrief.scenes.length, "design prompt")}: ${designBrief.concept}`, link: "motion-engine" });
  if (script?.edit_prompt) {
    events.push({ at: script.updated_at, who: "SCRIPTWRITER → VIDEOGRAPHER", msg: shootPlan ? `${plural(shootPlan.scenes.length, "scene")}, ${plural(shots.length, "shot")}` : plural(shots.length, "shot"), link: "scriptwriter-shoot" });
    events.push({ at: script.updated_at, who: "SCRIPTWRITER → ENGINE", msg: `Edit prompt (${script.edit_prompt.split(/\s+/).length} words)`, link: "scriptwriter-engine" });
  }
  for (const a of asks ?? []) {
    if (a.kind === "client") events.push({ at: a.created_at, who: "CLIENT → SCRIPTWRITER", msg: `Changes asked: ${short(a.request)}` });
    else {
      events.push({ at: a.created_at, who: "STUDIO → SCRIPTWRITER", msg: `Change request: ${short(a.request)}` });
      if (a.reply) events.push({ at: a.created_at, who: "SCRIPTWRITER", msg: short(a.reply) });
    }
  }
  if (footage?.length) events.push({ at: footage[0].created_at, who: "VIDEOGRAPHER → ENGINE", msg: `Footage: ${plural(footage.length, "file")} (first: ${footage[0].file_name})`, link: "shoot-engine" });
  if (video?.footage_complete_at) events.push({ at: video.footage_complete_at, who: "VIDEOGRAPHER → ENGINE", msg: "All footage is in: start the edit", link: "shoot-engine" });
  for (const j of jobs ?? []) {
    events.push({ at: j.created_at, who: "EDIT ENGINE", msg: `${j.source === "launch" ? "Edit" : j.source === "editor_fix" ? "Editor fixes" : "Client changes"} queued` });
    if (j.started_at) events.push({ at: j.started_at, who: "EDIT ENGINE", msg: "Editing" });
    if (j.finished_at && j.status === "failed") events.push({ at: j.finished_at, who: "EDIT ENGINE", msg: `Failed: ${friendlyError(j.error) ?? ""}`, tone: "bad" });
  }
  for (const v of versions ?? []) {
    const s = asSoundReport(v.sound);
    if (s) events.push({ at: v.created_at, who: "SOUND DESIGNER → ENGINE", msg: `${s.track ? `"${s.track.title}" (${s.track.library})` : "No music"}, ${plural(s.sfx.length, "effect")}${s.trend ? `, post with "${s.trend.title}"` : ""}`, link: "sound-engine" });
    events.push({ at: v.created_at, who: "ENGINE → VIDEO", msg: `v${v.number} ready (${v.made_by === "claude" ? "edit engine" : "editor"})`, link: "engine-video" });
  }
  events.sort((a, b) => a.at.localeCompare(b.at));
  for (const e of events) e.fresh = isFresh(e.at);

  // ------------------------------------------------------------ now, or what's next
  const now = nodes.filter((n) => n.state === "busy").map((n) => ({ who: n.title, text: `${n.progress ?? "working"}…`, busy: true }));
  if (!now.length) {
    const next = !strategy
      ? answered >= 4
        ? "Start production on the client's page: the strategist, then the research."
        : "Waiting for the client's answers to the questionnaire."
      : !monthPlan && !(videos ?? []).length
        ? "Plan the month on the client's Production panel."
        : !script?.body.trim()
          ? "Write the scripts on the client's Production panel."
          : !versions?.length
            ? "Shoot, then the edit starts by itself when the footage is complete."
            : "All quiet. Every agent is waiting for its next job.";
    now.push({ who: "Next", text: next, busy: false });
  }

  // ------------------------------------------------------------ panels
  const brandLink = `/clients/${client.id}/brand`;
  const productionLink = `/clients/${client.id}#production`;
  const empty = (title: string, body: string, href?: string, action?: string) => (
    <EmptyState title={title}>
      {body}{" "}
      {href && action && (
        <Link href={href} className="text-accent">
          {action}
        </Link>
      )}
    </EmptyState>
  );
  const panels: Partial<Record<NodeId, ReactNode>> = {
    refs: refs.length ? (
      <div className="flex flex-col gap-3 text-sm">
        <ul className="flex flex-col gap-3">
          {refs.map((r) => {
            const b = asReferenceBreakdown(r.analysis);
            return (
              <li key={r.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{[PLATFORM_LABEL[r.platform as ReferencePlatform] ?? r.platform, r.owner].filter(Boolean).join(" · ")}</span>
                  <span className="text-xs text-muted">{r.video_id ? "this video" : "all videos"}</span>
                  <a href={r.url} target="_blank" rel="noreferrer" className="ml-auto text-xs text-accent hover:underline">
                    Open
                  </a>
                </div>
                {r.note && <p className="mt-1 text-xs text-ink-2">{r.note}</p>}
                <p className={cx("mt-1 text-xs", r.status === "failed" ? "text-danger" : r.status === "done" ? "text-muted" : "text-accent")}>
                  {r.status === "queued" ? "Waiting for the engine" : r.status === "running" ? `${r.progress ?? "Watching it"}…` : r.status === "failed" ? friendlyError(r.error) : b ? b.summary : (friendlyError(r.error) ?? "Link only")}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted">The scriptwriter and the motion director read each breakdown; the edit engine and the sound designer also look at its frames.</p>
        {video && (
          <LinkButton href={`/videos/${video.id}#brief`} size="sm">
            Add a reference
          </LinkButton>
        )}
      </div>
    ) : (
      empty("No references yet", "Add reels or videos the studio wants this one to feel like: on the video page, or for every video on the client page.", video ? `/videos/${video.id}#brief` : `/clients/${client.id}`, "Add one")
    ),
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
      empty("No answers yet", "The client answers during onboarding, or you can.", brandLink, "Open the questionnaire")
    ),
    strategist: strategy ? (
      <StrategyView niche={strategy.niche} keywords={strategy.keywords} accounts={strategy.reference_accounts} business={strategy.business} audience={strategy.audience} needs={strategy.needs} pillars={asPillars(strategy.pillars)} charte={charte} />
    ) : (
      empty("Not run yet", answered >= 4 ? "The questionnaire is ready." : "It needs at least 4 answers first.", productionLink, "Start production")
    ),
    researcher: findings ? (
      <div className="flex flex-col gap-4">
        {latestReport && (
          <p className="text-[13px] text-muted">
            Searched {[...latestReport.hashtags.map((h) => `#${h}`), ...latestReport.accounts.map((a) => `@${a}`)].join(" ")} on Instagram, kept the top 10 reels by reach (3 per account at most) and watched them.
          </p>
        )}
        <FindingsView findings={findings} reels={reels} audio={trendAudio} />
      </div>
    ) : researching ? (
      <p className="text-sm text-ink-2">{latestReport?.progress ?? "Waiting for the edit engine."}</p>
    ) : (
      empty(latestReport?.status === "failed" ? "The last run failed" : "No research yet", latestReport?.error ?? "It starts by itself after the strategy, or from the client's Production panel.", productionLink, "Open")
    ),
    planner: monthPlan ? (
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-ink-2">{monthPlan.summary}</p>
        <ol className="flex flex-col gap-2">
          {monthPlan.ideas.map((idea, i) => (
            <li key={i} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium text-ink">{idea.title}</span>
                <span className="text-xs text-muted">
                  {idea.pillar} · {Math.round(idea.length_seconds)} s
                </span>
                {idea.video_id && (
                  <Link href={`/videos/${idea.video_id}`} className="ml-auto text-xs text-accent hover:underline">
                    Open the video
                  </Link>
                )}
              </div>
              <p className="mt-1 text-xs text-ink-2">Hook: {idea.hook}</p>
            </li>
          ))}
        </ol>
        <LinkButton href={productionLink} size="sm">
          Turn ideas into videos
        </LinkButton>
      </div>
    ) : busy(plannerRun?.status) ? (
      <p className="text-sm text-ink-2">{plannerRun?.progress ?? "Planning"}…</p>
    ) : (
      empty(plannerRun?.status === "failed" ? "The last plan failed" : "No plan yet", plannerRun?.error ?? "It plans the month from the strategy and the research.", productionLink, "Plan the month")
    ),
    scriptwriter:
      script?.body.trim() && video ? (
        <div className="flex flex-col gap-4">
          {writing.length > 0 && <p className="text-sm text-accent">{plural(writing.length, "script")} in progress for this client.</p>}
          {shootPlan && <ShootPlanView plan={shootPlan} />}
          {script.edit_prompt && (
            <div>
              <div className="kicker mb-2">Edit prompt → engine</div>
              <pre className="rounded-xl bg-black/40 p-3 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-[#c6f0ff]">{script.edit_prompt}</pre>
            </div>
          )}
          <LinkButton href={`/videos/${video.id}#script`} size="sm">
            Read the script
          </LinkButton>
        </div>
      ) : (
        empty(
          writing.length ? `${plural(writing.length, "script")} in progress` : "No script yet",
          video ? "Write the scripts from the client's Production panel, or one at a time on the video page." : "Create the videos first: plan the month on the client's page.",
          video ? productionLink : `/clients/${client.id}`,
          "Open",
        )
      ),
    sound: sound ? (
      <div className="flex flex-col gap-3">
        <div className="kicker">v{scored?.number}</div>
        <SoundView sound={sound} />
      </div>
    ) : (
      empty("No cut scored yet", "After the editor locks each cut, the sound designer picks the music from every library, lines it up, adds the effects and the trending sound to post with.", "/sounds", "See the libraries")
    ),
    motion: designBrief ? (
      <DesignBriefView brief={designBrief} chosen={script?.design_templates ?? []} />
    ) : (
      empty(
        designed ? "No design brief yet" : "Using the engine's templates",
        designed ? "The motion director designs the scenes as soon as the scriptwriter writes the script, or press Design the motion on the video." : "Choose design templates on a video, or make designed graphics the client's default in its brand kit.",
        video ? `/videos/${video.id}` : `/clients/${client.id}`,
        "Open",
      )
    ),
    shoot: (
      <div className="flex flex-col gap-3 text-sm">
        <div className="kicker">Footage</div>
        {footage?.length ? (
          <ul className="flex flex-col gap-1 text-ink-2">
            {footage.map((f, i) => (
              <li key={i}>{f.file_name}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">Nothing uploaded yet.</p>
        )}
        <p className={cx(video?.footage_complete_at ? "text-success" : "text-muted")}>{video?.footage_complete_at ? "Marked complete: the edit started." : "Not marked complete yet."}</p>
        {shots.length > 0 && (
          <>
            <div className="kicker">Shot list</div>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-ink-2">
              {shots.map((s, i) => (
                <li key={i} className={s.done ? "text-muted line-through" : ""}>
                  {s.text}
                </li>
              ))}
            </ul>
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
                <div className="font-medium text-ink">
                  {j.source.replace("_", " ")} · {j.status}
                </div>
                {j.progress && <div className="text-muted">{j.progress}</div>}
                {j.error && <div className="text-danger">{friendlyError(j.error)}</div>}
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
        <ul className="flex flex-col gap-1 text-ink-2">
          {(versions ?? []).map((v) => (
            <li key={v.number}>
              v{v.number} · {v.status.replace("_", " ")} · {v.made_by === "claude" ? "edit engine" : "editor"}
            </li>
          ))}
        </ul>
        <LinkButton href={`/videos/${video.id}`} size="sm">
          Open the video
        </LinkButton>
      </div>
    ) : (
      empty("No video yet", "Plan the month on the client's page.", productionLink, "Open the client")
    ),
  };

  const meters = [
    { label: "Questionnaire", value: `${answered}/${QUESTIONS.length}`, fill: answered / QUESTIONS.length },
    { label: "Reels studied", value: String(reels.length), fill: reels.length / 10 },
    { label: "Ideas planned", value: String(monthPlan?.ideas.length ?? 0), fill: (monthPlan?.ideas.length ?? 0) / 8 },
    { label: "Hooks found", value: String(findings?.hooks.length ?? 0), fill: (findings?.hooks.length ?? 0) / 8 },
    { label: "Scenes planned", value: String(shootPlan?.scenes.length ?? 0), fill: (shootPlan?.scenes.length ?? 0) / 8 },
    { label: "Versions", value: String(versions?.length ?? 0), fill: Math.min(1, (versions?.length ?? 0) / 3) },
  ];
  const live = nodes.some((n) => n.state === "busy");

  return (
    <WindowPage>
      <PageHeader
        eyebrow="Mission control"
        title="Agents"
        description="Who does what for one client, from the brief to the video, read left to right. Click a card to see what it gets, what it hands over, its skills and what it made."
        actions={
          <>
            <LinkButton href={productionLink}>Production</LinkButton>
            <LinkButton href={brandLink}>Brand & strategy</LinkButton>
          </>
        }
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
      <AgentHud nodes={nodes} links={links} events={events} panels={panels} meters={meters} now={now} swatches={(charte?.palette ?? []).map((c) => c.hex)} />
    </WindowPage>
  );
}
