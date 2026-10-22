import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { runContentPlanner, runStrategist } from "@/lib/agents";
import { asFindings, type ContentPlan } from "@/lib/agent-types";
import { clientMemory } from "@/lib/memory";
import { answeredCount, readAnswers, type Answers } from "@/lib/questionnaire";
import { reviseWithScriptwriter, writeScript } from "@/lib/scripts";
import type { Database, Json } from "@/lib/database.types";
import { createAdminClient, type Db } from "@/lib/supabase/admin";

// Production: what happens once a client is onboarded. The studio's agents work in the
// background, one run at a time per worker, so a month of scripts never hits a request's time
// limit: a server action queues runs (agent_runs) and starts workers; each worker
// (/api/agents/work) claims one run, does it, and hands over to the next while runs are left.
//
//   strategist   the questionnaire becomes the brand strategy and the brand kit, then the trend
//                research starts on the edit engine with the strategy's hashtags and accounts
//   planner      the strategy and the research become the month's video ideas
//   scriptwriter one video's script, shoot plan and edit prompt (@/lib/scripts writeScript)

export type Run = Database["public"]["Tables"]["agent_runs"]["Row"];
export type RunAgent = "strategist" | "planner" | "scriptwriter";

const now = () => new Date().toISOString();

// ---------------------------------------------------------------- the queue

export async function queueRuns(rows: { agent: RunAgent; client_id: string; video_id?: string | null; input?: Json; requested_by?: string | null }[]) {
  if (!rows.length) return [];
  const { data, error } = await createAdminClient()
    .from("agent_runs")
    .insert(rows.map((r) => ({ agent: r.agent, client_id: r.client_id, video_id: r.video_id ?? null, input: r.input ?? {}, requested_by: r.requested_by ?? null })))
    .select("id");
  if (error) throw new Error("Couldn't queue the agents' work.");
  return (data ?? []).map((r) => r.id);
}

// The worker's token: proves a call to /api/agents/work comes from this app.
export const workerToken = () => createHmac("sha256", process.env.SUPABASE_SECRET_KEY ?? "").update("magik-agents-work").digest("hex");
export function validWorkerToken(token: string | null) {
  const a = Buffer.from(token ?? "");
  const b = Buffer.from(workerToken());
  return a.length === b.length && timingSafeEqual(a, b);
}

// This deployment's own address, from the request being served.
export async function selfOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

// Hands the queue to a fresh worker. Returns whether one took it.
export const callWorker = (origin: string) =>
  fetch(`${origin}/api/agents/work`, {
    method: "POST",
    headers: {
      "x-magik-worker": workerToken(),
      // Lets the call through Vercel's deployment protection when the project has a bypass.
      ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET } : {}),
    },
    cache: "no-store",
  }).then(
    (res) => res.ok,
    () => false,
  );

// Start up to `n` workers once the response has gone out. If the app can't reach its own worker,
// it does one run itself rather than leave the queue waiting.
export async function startWorkers(n = 1) {
  const origin = await selfOrigin();
  after(async () => {
    const started = await Promise.all(Array.from({ length: Math.max(1, Math.min(4, n)) }, () => callWorker(origin)));
    if (!started.some(Boolean)) await workOnce();
  });
}

// Runs a crashed worker left behind (Vercel stops a function after its time limit) go back in
// the queue once, then fail with a plain reason.
async function reapStale(db: Db) {
  const cutoff = new Date(Date.now() - 9 * 60_000).toISOString();
  const { data } = await db.from("agent_runs").select("id, attempts").eq("status", "running").lt("started_at", cutoff);
  for (const r of data ?? []) {
    await db
      .from("agent_runs")
      .update(r.attempts >= 2 ? { status: "failed", error: "The agent stopped before it finished. Try again.", finished_at: now() } : { status: "queued", progress: null })
      .eq("id", r.id)
      .eq("status", "running");
  }
}

export async function hasQueued() {
  const { count } = await createAdminClient().from("agent_runs").select("id", { count: "exact", head: true }).eq("status", "queued");
  return !!count;
}

// One worker turn: claim the oldest queued run and do it. Returns whether there was one.
export async function workOnce() {
  const db = createAdminClient();
  await reapStale(db);
  const { data } = await db.rpc("claim_agent_run", {});
  const run = (data ?? [])[0];
  if (!run) return false;
  try {
    const output = await execute(run as Run, db);
    await db.from("agent_runs").update({ status: "done", progress: null, output: (output ?? null) as Json, finished_at: now() }).eq("id", run.id);
    await afterRun(run as Run, db);
  } catch (e) {
    await db
      .from("agent_runs")
      .update({ status: "failed", progress: null, error: e instanceof Error ? e.message : "The agent couldn't finish.", finished_at: now() })
      .eq("id", run.id);
  }
  return true;
}

const progress = (db: Db, id: string, text: string) => db.from("agent_runs").update({ progress: text }).eq("id", id);

// ---------------------------------------------------------------- what each run does

async function execute(run: Run, db: Db): Promise<unknown> {
  const input = (run.input ?? {}) as Record<string, unknown>;
  switch (run.agent) {
    case "strategist":
      return strategize(run, db);
    case "planner":
      return plan(run, db, typeof input.count === "number" ? input.count : null);
    case "scriptwriter": {
      if (!run.video_id) throw new Error("No video for the scriptwriter.");
      // The client asked for changes: revise what they read, keep the rest.
      if (input.mode === "revise") {
        await progress(db, run.id, "Making the client's changes");
        return reviseWithScriptwriter(run.video_id, { by: run.requested_by, asked: "", useClientNote: true, db });
      }
      await progress(db, run.id, "Writing the script");
      return writeScript(run.video_id, { by: run.requested_by, notes: typeof input.notes === "string" ? input.notes : "", db });
    }
    default:
      throw new Error(`Unknown agent: ${run.agent}`);
  }
}

// The brand strategist: the questionnaire, and the brand the client already has (the colors and
// fonts of the logo they gave or made at onboarding), become the strategy and the brand kit every
// script and edit follows. Shared by the worker and the Brand & strategy page. Throws with a plain
// reason.
export async function writeStrategy(clientId: string, db: Db, onProgress?: (text: string) => unknown) {
  const [{ data: client }, { data: form }, { data: kit }, memory] = await Promise.all([
    db.from("clients").select("id, name").eq("id", clientId).single(),
    db.from("brand_questionnaires").select("answers").eq("client_id", clientId).maybeSingle(),
    db.from("brand_kits").select("logo_path, colors, fonts").eq("client_id", clientId).maybeSingle(),
    clientMemory(clientId, { depth: "brief" }, db),
  ]);
  if (!client) throw new Error("Client not found.");
  const answers = readAnswers(form?.answers);
  if (answeredCount(answers) < 4) throw new Error("The questionnaire needs at least 4 answers first.");
  const given: Answers = { ...answers };
  if (kit?.colors.length && !given.colors) given.colors = `${kit.colors.join(", ")} (the colors of their logo)`;
  if (kit?.fonts.length && !given.fonts) given.fonts = `${kit.fonts.join(", ")} (the fonts of their logo)`;

  await onProgress?.("Writing the brand strategy");
  const strategy = await runStrategist({ clientName: client.name, answers: given, memory: memory.text });
  const clean = (handles: string[]) => [...new Set(handles.map((h) => h.trim().replace(/^[@#]/, "").replace(/\s+/g, "")).filter(Boolean))];
  const keywords = clean(strategy.keywords).slice(0, 8);
  const accounts = clean(strategy.reference_accounts).slice(0, 6);
  const { error } = await db.from("brand_strategies").upsert({
    client_id: clientId,
    status: "done",
    niche: strategy.niche,
    keywords,
    reference_accounts: accounts,
    business: strategy.business,
    audience: strategy.audience,
    needs: strategy.needs,
    pillars: strategy.pillars,
    charte: strategy.charte,
    error: null,
  });
  if (error) throw new Error("The strategy was written but couldn't be saved.");

  // The brand kit the engine reads: primary color first (end cards), the accent next.
  const order = ["primary", "accent", "secondary", "background", "text"];
  const colors = [...strategy.charte.palette]
    .filter((c) => /^#[0-9a-f]{6}$/i.test(c.hex))
    .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))
    .map((c) => c.hex.toUpperCase());
  await db.from("brand_kits").upsert({
    client_id: clientId,
    colors,
    fonts: [strategy.charte.fonts.headline, strategy.charte.fonts.body].filter(Boolean),
    music_mood: strategy.charte.music_mood,
    style_rules: strategy.style_rules,
    logo_path: kit?.logo_path ?? null,
  });
  return { niche: strategy.niche, keywords, accounts };
}

// The brand strategist, then the trend research on the edit engine with the strategy's hashtags
// and accounts, as many as the engine searches.
async function strategize(run: Run, db: Db) {
  await progress(db, run.id, "Reading the client's answers");
  const { niche, keywords, accounts } = await writeStrategy(run.client_id, db, (text) => progress(db, run.id, text));
  const research = (run.input as Record<string, unknown> | null)?.research !== false;
  if (research && (keywords.length || accounts.length)) {
    const { count } = await db.from("trend_reports").select("id", { count: "exact", head: true }).eq("client_id", run.client_id).in("status", ["queued", "running"]);
    if (!count) await db.from("trend_reports").insert({ client_id: run.client_id, hashtags: keywords.slice(0, 4), accounts: accounts.slice(0, 4), requested_by: run.requested_by });
  }
  return { niche, research };
}

// The month's plan: as many videos as the client's pack includes.
async function plan(run: Run, db: Db, asked: number | null) {
  const clientId = run.client_id;
  await progress(db, run.id, "Reading the strategy and the research");
  const [{ data: client }, { data: strategy }, { data: report }, memory] = await Promise.all([
    db.from("clients").select("name, language, pack:packs(name, videos_per_month)").eq("id", clientId).single(),
    db.from("brand_strategies").select("niche, business, audience, needs, pillars, charte").eq("client_id", clientId).maybeSingle(),
    db.from("trend_reports").select("findings").eq("client_id", clientId).eq("status", "done").order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    clientMemory(clientId, {}, db),
  ]);
  if (!client) throw new Error("Client not found.");
  if (!strategy) throw new Error("Run the brand strategist first: the plan builds on the strategy.");
  const count = Math.max(1, Math.min(12, asked ?? client.pack?.videos_per_month ?? 4));
  await progress(db, run.id, `Planning ${count} video${count > 1 ? "s" : ""}`);
  const result = await runContentPlanner({
    clientName: client.name,
    count,
    month: planMonthLabel(),
    language: client.language === "en" ? "English" : "French (Québec), with English subtitles when useful",
    pack: client.pack ? `${client.pack.name}${client.pack.videos_per_month ? ` (${client.pack.videos_per_month} videos a month)` : ""}` : null,
    strategy,
    findings: asFindings(report?.findings),
    memory: memory.text,
  });
  return result satisfies ContentPlan;
}

// The month being planned: this one until the 20th, then the next.
export function planMonthLabel(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth() + (date.getDate() > 20 ? 1 : 0), 1);
  return d.toLocaleDateString("en-CA", { month: "long", year: "numeric" });
}

// ---------------------------------------------------------------- telling the studio

// Production news links to the client's page (notifications.client_id).
async function notifyPeople(clientId: string, ids: (string | null | undefined)[], message: { title: string; body?: string }) {
  const people = [...new Set(ids.filter((id): id is string => !!id))];
  if (!people.length) return;
  await createAdminClient()
    .from("notifications")
    .insert(people.map((user_id) => ({ user_id, client_id: clientId, kind: "production", title: message.title, body: message.body ?? null })));
}

// The studio managers, the client's editors and whoever asked (the seller heard production
// start with the onboarding news).
async function studioFor(clientId: string, requester: string | null) {
  const db = createAdminClient();
  const [{ data: admins }, { data: client }, { data: team }] = await Promise.all([
    db.from("profiles").select("id").eq("role", "admin"),
    db.from("clients").select("name").eq("id", clientId).single(),
    db.from("client_team").select("user_id").eq("client_id", clientId),
  ]);
  return { name: client?.name ?? "The client", ids: [...(admins ?? []).map((a) => a.id), ...(team ?? []).map((t) => t.user_id), requester] };
}

async function afterRun(run: Run, db: Db) {
  if (run.agent === "strategist") {
    const who = await studioFor(run.client_id, run.requested_by);
    await notifyPeople(run.client_id, who.ids, { title: `${who.name}: the brand strategy is ready`, body: "The trend research is running on the edit engine. Next: plan the month." });
  } else if (run.agent === "planner") {
    const who = await studioFor(run.client_id, run.requested_by);
    await notifyPeople(run.client_id, who.ids, { title: `${who.name}: the month is planned`, body: "Pick the ideas to turn into videos on the client's Production panel." });
  } else if (run.agent === "scriptwriter") {
    // One message when the last script of a batch is written.
    const { count } = await db.from("agent_runs").select("id", { count: "exact", head: true }).eq("client_id", run.client_id).eq("agent", "scriptwriter").in("status", ["queued", "running"]);
    if (!count) {
      const who = await studioFor(run.client_id, run.requested_by);
      await notifyPeople(run.client_id, who.ids, { title: `${who.name}: the scripts are written`, body: "Read them, then send them to the client for approval." });
    }
  }
}

// Production starts on its own when a client finishes onboarding (`firstTime`: only if it never
// started), or when the studio presses Start. Returns false when it didn't start.
export async function startProduction(clientId: string, by: string | null, { firstTime = false } = {}) {
  const db = createAdminClient();
  const [{ count: open }, { count: ever }, { data: strategy }] = await Promise.all([
    db.from("agent_runs").select("id", { count: "exact", head: true }).eq("client_id", clientId).eq("agent", "strategist").in("status", ["queued", "running"]),
    db.from("agent_runs").select("id", { count: "exact", head: true }).eq("client_id", clientId).eq("agent", "strategist"),
    db.from("brand_strategies").select("client_id").eq("client_id", clientId).maybeSingle(),
  ]);
  if (open || (firstTime && (ever || strategy))) return false;
  await queueRuns([{ agent: "strategist", client_id: clientId, input: { research: true }, requested_by: by }]);
  await startWorkers(1);
  return true;
}

// Work waiting with no worker on it (one that never started, or stopped): start one. The screens
// that show the agents' work call it, so a queue never stays stuck while someone is looking.
export async function kickQueue() {
  const db = createAdminClient();
  const [{ count: waiting }, { count: recent }] = await Promise.all([
    db.from("agent_runs").select("id", { count: "exact", head: true }).eq("status", "queued").lt("created_at", new Date(Date.now() - 45_000).toISOString()),
    db.from("agent_runs").select("id", { count: "exact", head: true }).gt("started_at", new Date(Date.now() - 120_000).toISOString()),
  ]);
  if (waiting && !recent) await startWorkers(1);
}
