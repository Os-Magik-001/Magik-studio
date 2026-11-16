// The engine works for several agencies (studios). Everything it does for one job runs "for" an
// agency: which skills and built-in sound sets it may use, whose name its agents work under,
// and where what it uses is counted (usage_events). The agency travels with the job through an
// AsyncLocalStorage context, so the steps deep inside an edit read it without being handed it.
// Outside a context (the tests, a one-off script) the engine behaves as the first agency, Magik.

import { AsyncLocalStorage } from "node:async_hooks";

// The database is only needed once a job runs: skills and catalogs load this module without it.
const database = async () => (await import("./config.ts")).db;

export type Agency = {
  id: string | null;
  slug: string;
  // The studio's name, as its agents introduce themselves.
  studio: string;
  // Built-in sound sets it may use: studio, freepd, mixkit, incompetech.
  soundSets: string[];
};

export const FIRST: Agency = { id: null, slug: "magik", studio: "Magik Studio", soundSets: ["studio", "freepd", "mixkit", "incompetech"] };

type Usage = { kind: "ai_tokens" | "edits" | "scrape_runs"; quantity: number; what: string; model?: string; detail?: Record<string, unknown> };
type Context = { agency: Agency; clientId: string | null; videoId: string | null; usage: Usage[] };

const store = new AsyncLocalStorage<Context>();

export const currentAgency = (): Agency => store.getStore()?.agency ?? FIRST;

export async function loadAgency(id: string): Promise<Agency> {
  const db = await database();
  const { data } = await db.from("agencies").select("id, slug, name, brand, sound_sets").eq("id", id).maybeSingle();
  if (!data) throw new Error("This job's agency no longer exists.");
  const brand = (data.brand ?? {}) as { studio?: unknown };
  const studio = typeof brand.studio === "string" && brand.studio.trim() ? brand.studio.trim() : data.slug === FIRST.slug ? FIRST.studio : data.name;
  return { id: data.id, slug: data.slug, studio, soundSets: data.sound_sets };
}

// The agents' instructions are written for the first agency; another agency's agents work under
// its own name.
export const forStudio = (text: string) => {
  const { studio } = currentAgency();
  return studio === FIRST.studio ? text : text.replaceAll(FIRST.studio, studio);
};

// Runs one job for its agency, then saves what it used. Counting never fails a job.
export async function runFor<T>(agencyId: string, ids: { clientId?: string | null; videoId?: string | null }, work: () => Promise<T>): Promise<T> {
  // An agency that can't be read still gets its job done, with only what every agency may use.
  const agency = await loadAgency(agencyId).catch((): Agency => ({ id: agencyId, slug: "", studio: "the studio", soundSets: ["freepd"] }));
  const context: Context = { agency, clientId: ids.clientId ?? null, videoId: ids.videoId ?? null, usage: [] };
  try {
    return await store.run(context, work);
  } finally {
    if (context.usage.length) {
      const rows = context.usage.map((u) => ({
        agency_id: agencyId,
        kind: u.kind,
        quantity: u.quantity,
        source: "engine",
        what: u.what,
        model: u.model ?? null,
        detail: (u.detail ?? {}) as never,
        client_id: context.clientId,
        video_id: context.videoId,
      }));
      const db = await database();
      await db.from("usage_events").insert(rows).then(
        ({ error }) => error && console.warn(`usage not saved: ${error.message}`),
        (err) => console.warn(`usage not saved: ${err.message}`),
      );
    }
  }
}

export function count(kind: Usage["kind"], quantity: number, what: string, detail?: Record<string, unknown>, model?: string) {
  store.getStore()?.usage.push({ kind, quantity, what, model, detail });
}

type TokenUsage = { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };

// One answer from Claude: what it read and wrote, with the cached part apart (it costs less).
export function countTokens(what: string, model: string, usage: TokenUsage | null | undefined) {
  if (!usage) return;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  count("ai_tokens", usage.input_tokens + cacheRead + cacheWrite + usage.output_tokens, what, { input: usage.input_tokens, output: usage.output_tokens, cache_read: cacheRead, cache_write: cacheWrite }, model);
}

// ---------------------------------------------------------------- whose turn

export type Waiting = { id: string; agency_id: string; created_at: string };

// The order to try queued work in, so no agency waits behind another's backlog: an agency
// already at its limit of running work is left out; among the others, the one with the least
// running goes first, then the one served longest ago; inside an agency, the oldest first.
export function fairOrder<T extends Waiting>(queued: T[], running: Map<string, number>, lastStarted: Map<string, string>, limits: Map<string, number> = new Map()): T[] {
  const byAgency = new Map<string, T[]>();
  for (const q of [...queued].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    byAgency.set(q.agency_id, [...(byAgency.get(q.agency_id) ?? []), q]);
  }
  const turn = [...byAgency.keys()]
    .filter((a) => (running.get(a) ?? 0) < (limits.get(a) ?? Infinity))
    .sort((a, b) => (running.get(a) ?? 0) - (running.get(b) ?? 0) || (lastStarted.get(a) ?? "").localeCompare(lastStarted.get(b) ?? "") || byAgency.get(a)![0].created_at.localeCompare(byAgency.get(b)![0].created_at));
  // Round by round: every agency's oldest, then every agency's second oldest...
  const out: T[] = [];
  for (let round = 0; out.length < turn.reduce((n, a) => n + byAgency.get(a)!.length, 0); round++) {
    for (const a of turn) {
      const job = byAgency.get(a)![round];
      if (job) out.push(job);
    }
  }
  return out;
}

// When each agency was last served in one of the engine's queues.
export async function lastStartedIn(table: "edit_jobs" | "reference_videos" | "trend_reports"): Promise<Map<string, string>> {
  const db = await database();
  const { data } = await db.from(table).select("agency_id, started_at").not("started_at", "is", null).order("started_at", { ascending: false }).limit(300);
  const last = new Map<string, string>();
  for (const r of data ?? []) if (r.started_at && !last.has(r.agency_id)) last.set(r.agency_id, r.started_at);
  return last;
}
