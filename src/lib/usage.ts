import "server-only";
import { agencyDb } from "@/lib/supabase/agency";

// What an agency uses, counted for its plan and its bill (usage_events; the edit engine writes
// its own part). Counting never fails the work it counts.

type TokenUsage = { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };

// One answer from Claude to one of the app's agents, for the agency of the request.
export async function recordTokens(what: string, model: string, usage: TokenUsage | null | undefined, ids: { clientId?: string | null; videoId?: string | null } = {}) {
  if (!usage) return;
  try {
    const cacheRead = usage.cache_read_input_tokens ?? 0;
    const cacheWrite = usage.cache_creation_input_tokens ?? 0;
    await (await agencyDb()).from("usage_events").insert({
      kind: "ai_tokens",
      quantity: usage.input_tokens + cacheRead + cacheWrite + usage.output_tokens,
      source: "app",
      what,
      model,
      detail: { input: usage.input_tokens, output: usage.output_tokens, cache_read: cacheRead, cache_write: cacheWrite },
      client_id: ids.clientId ?? null,
      video_id: ids.videoId ?? null,
    });
  } catch {}
}

export type UsageSummary = { tokens: number; edits: number; scrapes: number };

// Totals since a date, from rows already read.
export function summarize(rows: { kind: string; quantity: number }[]): UsageSummary {
  const sum = (kind: string) => rows.filter((r) => r.kind === kind).reduce((n, r) => n + Number(r.quantity), 0);
  return { tokens: sum("ai_tokens"), edits: sum("edits"), scrapes: sum("scrape_runs") };
}

export const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};

export const tokensText = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
