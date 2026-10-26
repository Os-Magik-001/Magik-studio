import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleAlert } from "lucide-react";
import { displayName, type Viewer } from "@/lib/auth";
import { claudeConfigured } from "@/lib/claude";
import { answeredCount, readAnswers } from "@/lib/questionnaire";
import { asFindings, asPlan, asReels } from "@/lib/agent-types";
import { ROSTER, type RosterKey } from "@/lib/agent-roster";
import { kickQueue, planMonthLabel } from "@/lib/production";
import { SCRIPT_STATUS_LABEL, type ScriptStatus } from "@/lib/workflow";
import { createClient } from "@/lib/supabase/server";
import { AutoRefresh } from "@/components/auto-refresh";
import { LocalDate } from "@/components/local-date";
import { ScriptPdfLink } from "@/components/scripts/pdf-link";
import { cx } from "@/components/ui";
import { CreateVideosForm, PlanForm, ResearchForm, ScriptActions, ShootDayForm, StartProductionButton } from "./forms";
import { friendlyError } from "@/lib/errors";

// A client's production, from the onboarding to the shoot, on their page: the five steps, what
// the agents are doing now, and one button for each next move. It starts by itself when the
// client finishes onboarding (@/lib/production).

// current: the next thing to do; ready: can be done now too (videos move at their own pace).
type State = "done" | "busy" | "current" | "ready" | "todo" | "failed";
const busy = (status?: string | null) => status === "queued" || status === "running";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const crew = (keys: RosterKey[]) => keys.map((k) => ROSTER[k].name).join(" · ");

function Dot({ n, state }: { n: number; state: State }) {
  return (
    <span
      aria-hidden
      className={cx(
        "relative z-[1] inline-flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums",
        state === "done" && "bg-success text-success-ink",
        state === "busy" && "bg-accent text-accent-ink shadow-[0_0_0_4px_rgba(246,212,58,0.18),0_0_22px_rgba(246,212,58,0.45)]",
        state === "current" && "bg-accent text-accent-ink shadow-[0_0_0_4px_rgba(246,212,58,0.18)]",
        state === "ready" && "bg-accent-soft text-accent shadow-[inset_0_0_0_1.5px_rgba(246,212,58,0.6)]",
        state === "failed" && "bg-danger text-white",
        state === "todo" && "bg-white/8 text-muted",
      )}
    >
      {state === "done" ? <Check size={15} strokeWidth={2.75} /> : state === "failed" ? "!" : n}
      {state === "busy" && <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" />}
    </span>
  );
}

const STATE_LABEL: Record<State, string> = { done: "Done", busy: "Working", current: "Next", ready: "Ready", todo: "Later", failed: "Needs you" };

// `who`: the agents (and people) who do the step.
function Step({ n, title, who, state, summary, last, children }: { n: number; title: string; who: string; state: State; summary: ReactNode; last?: boolean; children?: ReactNode }) {
  const open = state !== "done" && state !== "todo";
  return (
    <li className="relative grid grid-cols-[32px_1fr] gap-x-4 px-5 py-5">
      {!last && <span aria-hidden className={cx("absolute top-[52px] bottom-0 left-[35px] w-px", state === "done" ? "bg-success/50" : "bg-white/10")} />}
      <Dot n={n} state={state} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          <span
            className={cx(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
              state === "done" && "bg-success-soft text-success",
              (state === "busy" || state === "current" || state === "ready") && "bg-accent-soft text-accent",
              state === "failed" && "bg-danger-soft text-danger",
              state === "todo" && "bg-white/8 text-muted",
            )}
          >
            {STATE_LABEL[state]}
          </span>
          <span className="text-xs text-muted">{who}</span>
        </div>
        <div className="mt-1 text-[13.5px] text-ink-2">{summary}</div>
        {children &&
          (open ? (
            <div className="mt-4 flex flex-col gap-4">{children}</div>
          ) : (
            <details className="mt-2">
              <summary className="cursor-pointer text-[12.5px] font-medium text-accent">{state === "done" ? "Details and redo" : "Open"}</summary>
              <div className="mt-3 flex flex-col gap-4">{children}</div>
            </details>
          ))}
      </div>
    </li>
  );
}

function Working({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[13px] font-medium text-accent" role="status">
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" aria-hidden />
      {children}
    </p>
  );
}

function Problem({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger">
      <CircleAlert size={15} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

const SCRIPT_TONE: Record<ScriptStatus | "none" | "writing" | "failed", string> = {
  none: "text-muted",
  writing: "text-accent",
  failed: "text-danger",
  draft: "text-ink-2",
  client_review: "text-[#8fb8ff]",
  changes_requested: "text-warning",
  approved: "text-success",
};

export async function ProductionPanel({ clientId, viewer }: { clientId: string; viewer: Viewer }) {
  const supabase = await createClient();
  const [{ data: client }, { data: form }, { data: strategy }, { data: reports }, { data: runs }, { data: videos }, { data: people }, { data: team }] = await Promise.all([
    supabase.from("clients").select("id, name, pack:packs(name, videos_per_month)").eq("id", clientId).single(),
    supabase.from("brand_questionnaires").select("answers").eq("client_id", clientId).maybeSingle(),
    supabase.from("brand_strategies").select("niche, keywords, reference_accounts, pillars, updated_at").eq("client_id", clientId).maybeSingle(),
    supabase.from("trend_reports").select("id, status, progress, error, hashtags, accounts, reels, findings, created_at, finished_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(4),
    supabase.from("agent_runs").select("id, agent, status, progress, error, video_id, output, created_at, finished_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(80),
    supabase.from("videos").select("id, title, status, brief, videographer_id, created_at, scripts(status, body), shoots(starts_at)").eq("client_id", clientId).order("created_at"),
    supabase.from("profiles").select("id, full_name, email, role").in("role", ["editor", "videographer"]).order("full_name"),
    supabase.from("client_team").select("user_id").eq("client_id", clientId),
  ]);
  if (!client) return null;
  await kickQueue();

  const connected = claudeConfigured();
  const isAdmin = viewer.role === "admin";
  const answered = answeredCount(readAnswers(form?.answers));
  const runsOf = (agent: string) => (runs ?? []).filter((r) => r.agent === agent);
  const strategist = runsOf("strategist")[0] ?? null;
  const planner = runsOf("planner")[0] ?? null;
  const planRun = runsOf("planner").find((r) => r.status === "done") ?? null;
  const plan = asPlan(planRun?.output);
  const writers = runsOf("scriptwriter");
  const writing = new Map(writers.filter((r) => busy(r.status)).map((r) => [r.video_id, r]));
  const lastWriter = new Map<string, (typeof writers)[number]>();
  for (const r of writers) if (r.video_id && !lastWriter.has(r.video_id)) lastWriter.set(r.video_id, r);
  const report = reports?.[0] ?? null;
  const doneReport = (reports ?? []).find((r) => r.status === "done") ?? null;
  const findings = asFindings(doneReport?.findings);
  const reels = asReels(doneReport?.reels);
  const editors = (people ?? []).filter((p) => p.role === "editor").map((p) => ({ id: p.id, name: displayName(p) }));
  const videographers = (people ?? []).filter((p) => p.role === "videographer").map((p) => ({ id: p.id, name: displayName(p) }));
  const nameOf = new Map([...editors, ...videographers].map((p) => [p.id, p.name]));
  const teamIds = new Set((team ?? []).map((t) => t.user_id));

  const all = videos ?? [];
  const preShoot = all.filter((v) => v.status === "script" || v.status === "shoot");
  const scriptState = (v: (typeof all)[number]): keyof typeof SCRIPT_TONE => {
    if (writing.has(v.id)) return "writing";
    if (!v.scripts?.body.trim()) return lastWriter.get(v.id)?.status === "failed" ? "failed" : "none";
    return v.scripts.status;
  };
  const toWrite = preShoot.filter((v) => !writing.has(v.id) && !!v.brief?.trim() && !v.scripts?.body.trim() && v.scripts?.status !== "approved").length;
  const toRevise = preShoot.filter((v) => !writing.has(v.id) && v.scripts?.status === "changes_requested").length;
  const toSend = preShoot.filter((v) => !writing.has(v.id) && v.scripts?.status === "draft" && !!v.scripts.body.trim()).length;
  const approved = preShoot.filter((v) => v.scripts?.status === "approved");
  const soon = (v: (typeof all)[number]) => v.shoots.some((s) => Date.parse(s.starts_at) > Date.now() - 12 * 3600_000);
  const shot = (v: (typeof all)[number]) => v.shoots.length > 0;
  const toShoot = preShoot.filter((v) => !shot(v) && ["approved", "client_review", "changes_requested"].includes(v.scripts?.status ?? ""));
  const upcoming = all
    .flatMap((v) => v.shoots.filter((s) => Date.parse(s.starts_at) > Date.now() - 12 * 3600_000).map((s) => ({ at: s.starts_at, title: v.title, id: v.id, who: v.videographer_id })))
    .sort((a, b) => a.at.localeCompare(b.at));
  const later = all.filter((v) => !["script", "shoot"].includes(v.status));
  const count = (status: string) => all.filter((v) => v.status === status).length;

  // ------------------------------------------------------------ each step's state
  const s1: State =
    !strategy && strategist?.status === "failed" ? "failed" : busy(strategist?.status) || busy(report?.status) ? "busy" : strategy && doneReport ? "done" : strategy && report?.status === "failed" ? "failed" : "current";
  const s2: State = busy(planner?.status) ? "busy" : planner?.status === "failed" && !plan ? "failed" : (plan && plan.ideas.some((i) => i.video_id)) || (!plan && all.length > 0) ? "done" : strategy ? "current" : "todo";
  const s3: State = writing.size ? "busy" : preShoot.length && preShoot.every((v) => v.scripts?.status === "approved") ? "done" : preShoot.length ? "current" : later.length ? "done" : "todo";
  const s4: State = approved.length && approved.every(shot) && !toShoot.length ? "done" : toShoot.length ? "current" : later.length && !preShoot.length ? "done" : "todo";
  const s5: State = later.length ? (all.every((v) => v.status === "delivered") ? "done" : "current") : "todo";
  const order = [s1, s2, s3, s4, s5];
  // The first step not done is "next"; later ones with something to do now are "ready".
  const firstOpen = order.findIndex((s) => s !== "done");
  const states = order.map((s, i) => (s === "current" && i !== firstOpen ? "ready" : s)) as State[];
  const live = order.includes("busy");

  // ------------------------------------------------------------ what's happening now
  const now: string[] = [];
  if (busy(strategist?.status)) now.push(`${ROSTER.strategist.name}: ${strategist!.progress ?? (strategist!.status === "queued" ? "starting" : "at work")}`);
  if (busy(report?.status)) now.push(`${ROSTER.researcher.name}: ${report!.progress ?? "waiting for the edit engine"}`);
  if (busy(planner?.status)) now.push(`${ROSTER.planner.name}: ${planner!.progress ?? "starting"}`);
  if (writing.size) {
    const running = [...writing.values()].filter((r) => r.status === "running").length;
    now.push(`${ROSTER.scriptwriter.name}: ${plural(writing.size, "script")} to go${running ? `, ${running} being written` : ""}`);
  }
  const month = planMonthLabel();
  const packCount = client.pack?.videos_per_month ?? 4;
  const defaultEditor = editors.find((e) => teamIds.has(e.id))?.id ?? editors[0]?.id ?? "";
  const defaultVideographer = videographers.find((e) => teamIds.has(e.id))?.id ?? videographers[0]?.id ?? "";
  const dueDefault = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 21);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <section id="production" aria-labelledby="production-title" className="frost scroll-mt-20 overflow-hidden rounded-[22px]">
      {live && <AutoRefresh seconds={5} />}
      <div className="relative border-b border-white/[0.07] px-5 py-4">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_140%_at_0%_0%,rgba(246,212,58,0.12),transparent_55%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="kicker">Production · {month}</div>
            <h2 id="production-title" className="mt-0.5 font-display text-[20px] font-bold tracking-[-0.01em] text-ink">
              From the onboarding to the shoot
            </h2>
            <p className="mt-0.5 max-w-xl text-[13px] text-muted">The agents do the work in the background; each step is one click. It starts by itself when the client finishes onboarding.</p>
          </div>
          <Link href={`/agents?client=${client.id}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
            Watch the agents <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
        <div className="relative mt-3 flex flex-col gap-1">
          {!connected ? (
            <p className="text-[13px] text-warning">The agents aren&apos;t connected yet: ANTHROPIC_API_KEY is missing.</p>
          ) : now.length ? (
            now.map((line) => <Working key={line}>{line}…</Working>)
          ) : null}
        </div>
      </div>

      <ol>
        {/* 1. The brand and the research */}
        <Step
          n={1}
          title="Brand strategy & trend research"
          who={crew(["strategist", "researcher"])}
          state={states[0]}
          summary={
            strategy ? (
              <>
                {strategy.niche}
                {doneReport && (
                  <span className="text-muted">
                    {" "}
                    · {plural(reels.length, "top reel")} studied
                    {findings ? `, ${plural(findings.hooks.length, "hook")} and ${plural(findings.ideas.length, "idea")} found` : ""}
                  </span>
                )}
              </>
            ) : answered < 4 ? (
              `Waiting for the client's answers (${answered} of 4 at least). They answer during onboarding, or you can on Brand & strategy.`
            ) : (
              "The questionnaire is ready: the strategist turns it into the niche, the charte graphique and the content pillars, then the researcher studies the niche's top reels."
            )
          }
        >
          {busy(strategist?.status) && <Working>{strategist!.progress ?? "The brand strategist is starting"}…</Working>}
          {!strategy && strategist?.status === "failed" && <Problem>{friendlyError(strategist.error) ?? "The brand strategist couldn't finish."}</Problem>}
          {busy(report?.status) && <Working>{report!.status === "queued" ? "The research waits for the edit engine (it runs on the studio's Mac)" : (report!.progress ?? "Researching")}…</Working>}
          {report?.status === "failed" && <Problem>The research failed: {(friendlyError(report.error) ?? "unknown error").replace(/\.$/, "")}. Try again below, or plan from the strategy alone.</Problem>}
          {!busy(strategist?.status) && (answered >= 4 || strategy) && (
            <div className="flex flex-wrap items-center gap-3">
              <StartProductionButton clientId={client.id} again={!!strategy} />
              <Link href={`/clients/${client.id}/brand`} className="text-[13px] font-medium text-accent hover:underline">
                {strategy ? "Read the strategy" : "Open the questionnaire"}
              </Link>
            </div>
          )}
          {answered < 4 && !strategy && (
            <Link href={`/clients/${client.id}/brand`} className="text-[13px] font-medium text-accent hover:underline">
              Open the questionnaire
            </Link>
          )}
          {strategy && !busy(report?.status) && (
            <ResearchForm clientId={client.id} hashtags={strategy.keywords} accounts={strategy.reference_accounts} label={doneReport ? "Research again" : "Start the research"} />
          )}
        </Step>

        {/* 2. The month's plan */}
        <Step
          n={2}
          title="Plan the month"
          who={crew(["planner"])}
          state={states[1]}
          summary={
            plan ? (
              <>
                {plan.summary} <span className="text-muted">({plural(plan.ideas.length, "idea")}, {plural(plan.ideas.filter((i) => i.video_id).length, "video")} created)</span>
              </>
            ) : all.length && !plan ? (
              `${plural(all.length, "video")} added by hand. Plan the month for more ideas.`
            ) : strategy ? (
              `The content planner turns the strategy${doneReport ? " and the research" : ""} into ${plural(packCount, "video")} for ${month}, each with its hook and brief.`
            ) : (
              "Waiting for the brand strategy."
            )
          }
        >
          {busy(planner?.status) && <Working>{planner!.progress ?? "The content planner is starting"}…</Working>}
          {planner?.status === "failed" && !busy(planner.status) && <Problem>{friendlyError(planner.error) ?? "The content planner couldn't finish."}</Problem>}
          {strategy && busy(report?.status) && !plan && <p className="text-[13px] text-muted">The research is still running: plan now from the strategy, or wait a few minutes for sharper ideas.</p>}
          {plan && planRun && (
            <CreateVideosForm
              key={planRun.id}
              runId={planRun.id}
              ideas={plan.ideas.map((idea, index) => ({ ...idea, index }))}
              editors={editors}
              videographers={videographers}
              defaultEditor={defaultEditor}
              defaultVideographer={defaultVideographer}
              dueOn={dueDefault}
              canCreate={isAdmin}
            />
          )}
          {strategy && connected && !busy(planner?.status) && <PlanForm clientId={client.id} count={packCount} again={!!plan} />}
        </Step>

        {/* 3. Scripts and the client's approval */}
        <Step
          n={3}
          title="Scripts & the client's approval"
          who={`${crew(["scriptwriter", "motion"])} · the client approves`}
          state={states[2]}
          summary={
            preShoot.length
              ? `${plural(preShoot.filter((v) => v.scripts?.body.trim()).length, "script")} written of ${preShoot.length} · ${approved.length} approved${toSend ? ` · ${toSend} ready to send` : ""}${toRevise ? ` · ${toRevise} with changes asked` : ""}`
              : later.length
                ? "Every script is approved."
                : "The scripts come once the videos exist."
          }
        >
          {preShoot.length > 0 && (
            <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.07]">
              {preShoot.map((v) => {
                const st = scriptState(v);
                const run = writing.get(v.id) ?? lastWriter.get(v.id);
                return (
                  <li key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                    <Link href={`/videos/${v.id}#script`} className="min-w-0 flex-1 basis-56 truncate text-[13.5px] font-medium text-ink hover:text-accent">
                      {v.title}
                    </Link>
                    <span className={cx("text-[12.5px]", SCRIPT_TONE[st])}>
                      {st === "writing"
                        ? `${run?.status === "queued" ? "In line" : (run?.progress ?? "Writing")}…`
                        : st === "failed"
                          ? (run?.error ?? "Couldn't write it")
                          : st === "none"
                            ? v.brief?.trim()
                              ? "No script yet"
                              : "Needs a brief"
                            : SCRIPT_STATUS_LABEL[st]}
                    </span>
                    {v.scripts?.body.trim() && st !== "writing" && <ScriptPdfLink videoId={v.id} label="PDF" className="h-7 px-2.5 text-[12px]" />}
                  </li>
                );
              })}
            </ul>
          )}
          {connected ? <ScriptActions clientId={client.id} toWrite={toWrite} toRevise={toRevise} toSend={toSend} /> : null}
          {toSend > 0 && <p className="text-xs text-muted">Read them first: each opens on its video page. The client gets one message for all of them and approves each script on their side.</p>}
        </Step>

        {/* 4. The shoot */}
        <Step
          n={4}
          title="Send the shoots to the videographer"
          who="The videographer"
          state={states[3]}
          summary={
            upcoming.length ? (
              <>
                Next shoot: <LocalDate value={upcoming[0].at} preset="full" /> · {plural(upcoming.filter((u) => u.at === upcoming[0].at).length, "video")}
              </>
            ) : toShoot.length ? (
              `${plural(toShoot.length, "video")} to schedule. The videographer gets the script, the shot list and the shoot plan of each.`
            ) : (
              "Once a script is approved, schedule its shoot here."
            )
          }
        >
          {upcoming.length > 0 && (
            <ul className="flex flex-col gap-1.5 text-[13px]">
              {upcoming.map((u, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-ink">
                    <LocalDate value={u.at} preset="short" />
                  </span>
                  <Link href={`/videos/${u.id}#shoot`} className="text-ink-2 hover:text-accent">
                    {u.title}
                  </Link>
                  {u.who && <span className="text-muted">· {nameOf.get(u.who) ?? "videographer"}</span>}
                </li>
              ))}
            </ul>
          )}
          {toShoot.length > 0 && (
            <ShootDayForm
              clientId={client.id}
              videos={toShoot.map((v) => ({ id: v.id, title: v.title, approved: v.scripts?.status === "approved", videographer: v.videographer_id ? (nameOf.get(v.videographer_id) ?? null) : null }))}
              videographers={videographers}
              isAdmin={isAdmin}
              defaultVideographer={toShoot.every((v) => v.videographer_id) ? "" : defaultVideographer}
            />
          )}
          {!toShoot.length && approved.some((v) => !soon(v)) && <p className="text-[13px] text-muted">Every approved video has had its shoot. Add another shoot on a video&apos;s page.</p>}
        </Step>

        {/* 5. The edit and the delivery */}
        <Step
          n={5}
          title="Edit & delivery"
          who={`${crew(["engine", "sound"])} · the editor checks`}
          state={states[4]}
          last
          summary={
            later.length
              ? [
                  count("footage_in") && `${count("footage_in")} with footage in`,
                  count("editing") && `${count("editing")} editing`,
                  count("editor_check") && `${count("editor_check")} at the editor's check`,
                  count("client_review") && `${count("client_review")} with the client`,
                  count("approved") && `${count("approved")} approved`,
                  count("delivered") && `${count("delivered")} delivered`,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "When the videographer marks the footage complete, the edit starts by itself; the editor checks each cut before the client sees it."
          }
        >
          {later.length > 0 && (
            <Link href="/pipeline" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
              Open the pipeline <ArrowRight size={13} aria-hidden />
            </Link>
          )}
        </Step>
      </ol>
    </section>
  );
}
