import "server-only";
import { createClient } from "@/lib/supabase/server";
import { asShootPlan } from "@/lib/agent-types";
import { FORMAT_LABEL, videoStatusLabel } from "@/lib/workflow";

// What the agents remember about a client: their other videos, each with its script, its
// edit prompt and what was asked to change along the way. It is read with the viewer's
// access, so an agent only remembers what the person running it can see.

export type Remembered = {
  title: string;
  format: string;
  status: string;
  createdAt: string;
  brief: string | null;
  concept: string | null;
  script: string;
  editPrompt: string | null;
  asks: { who: "client" | "studio"; text: string }[];
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

// "full" for the scriptwriter (scripts, edit prompts, what was asked), "brief" for the
// strategist (a line per video). The newest videos are told in full until the budget runs
// out; older ones shrink to a line, so a long history still fits.
export function formatMemory(videos: Remembered[], depth: "full" | "brief"): string | null {
  if (!videos.length) return null;
  const budget = depth === "full" ? 80_000 : 12_000;
  const newest = [...videos].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const heading = (v: Remembered) => `"${v.title}" (${v.format}, ${v.createdAt.slice(0, 10)}, ${v.status})`;
  const line = (v: Remembered) => `- ${heading(v)}: ${clip(oneLine(v.concept ?? v.brief ?? v.script), 240)}`;
  const full = (v: Remembered) =>
    [
      `### ${heading(v)}`,
      v.concept && `Concept: ${v.concept}`,
      !v.concept && v.brief && `Brief: ${clip(v.brief.trim(), 1500)}`,
      v.script.trim() && `Script:\n${clip(v.script.trim(), 8000)}`,
      v.editPrompt?.trim() && `Edit prompt:\n${clip(v.editPrompt.trim(), 3000)}`,
      v.asks.length &&
        `Changes asked along the way:\n${v.asks
          .slice(-6)
          .map((a) => `- ${a.who === "client" ? "Client" : "Studio"}: ${clip(oneLine(a.text), 400)}`)
          .join("\n")}`,
    ]
      .filter(Boolean)
      .join("\n");

  const told: Remembered[] = [];
  const short: Remembered[] = [];
  let used = 0;
  for (const v of newest) {
    const size = depth === "full" ? full(v).length : line(v).length;
    if (short.length || (told.length && used + size > budget)) short.push(v);
    else {
      told.push(v);
      used += size;
    }
  }
  const oldestFirst = (list: Remembered[]) => [...list].reverse();
  const head = `${videos.length} other video${videos.length > 1 ? "s" : ""} for this client, oldest first.`;
  if (depth === "brief") {
    return [head, ...oldestFirst(told).map(line), short.length ? `- …and ${short.length} older.` : null].filter(Boolean).join("\n");
  }
  return [
    head,
    short.length && `Older ones, in short:\n${oldestFirst(short).map(line).join("\n")}`,
    ...oldestFirst(told).map(full),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function clientMemory(clientId: string, opts: { except?: string; depth?: "full" | "brief" } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("videos")
    .select("id, title, format, status, brief, created_at, scripts(body, edit_prompt, shoot_plan)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (opts.except) query = query.neq("id", opts.except);
  const { data } = await query;
  const rows = (data ?? []).filter((v) => v.scripts?.body.trim() || v.brief?.trim());
  if (!rows.length) return { text: null, count: 0 };

  const { data: asks } = await supabase
    .from("script_revisions")
    .select("video_id, kind, request")
    .in("video_id", rows.map((v) => v.id))
    .in("kind", ["revised", "client"])
    .not("request", "is", null)
    .order("created_at");
  const videos: Remembered[] = rows.map((v) => ({
    title: v.title,
    format: FORMAT_LABEL[v.format],
    status: videoStatusLabel(v.status),
    createdAt: v.created_at,
    brief: v.brief,
    concept: asShootPlan(v.scripts?.shoot_plan)?.concept ?? null,
    script: v.scripts?.body ?? "",
    editPrompt: v.scripts?.edit_prompt ?? null,
    asks: (asks ?? [])
      .filter((a) => a.video_id === v.id)
      .map((a) => ({ who: a.kind === "client" ? ("client" as const) : ("studio" as const), text: a.request ?? "" })),
  }));
  return { text: formatMemory(videos, opts.depth ?? "full"), count: videos.length };
}
