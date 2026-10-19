// What the engine's agents remember about a client: their other videos, with the script,
// the edit prompt, how the last cut came out and what was asked to change along the way.
// The editor keeps a series consistent with it; the researcher proposes ideas that are new.

import { db } from "./config.ts";

export type Remembered = {
  title: string;
  format: string;
  createdAt: string;
  brief: string | null;
  concept: string | null;
  script: string;
  editPrompt: string | null;
  // The last cut's summary, from its plan.
  cut: string | null;
  asks: { who: "client" | "editor" | "studio"; text: string }[];
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

// "edit" for the editor: scripts, edit prompts, cuts and change requests, newest in full until
// the budget runs out, older ones in a line. "brief" for the researcher: a line per video.
export function formatMemory(videos: Remembered[], depth: "edit" | "brief"): string | null {
  if (!videos.length) return null;
  const budget = depth === "edit" ? 30_000 : 8_000;
  const newest = [...videos].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const heading = (v: Remembered) => `"${v.title}" (${v.format}, ${v.createdAt.slice(0, 10)})`;
  const line = (v: Remembered) => `- ${heading(v)}: ${clip(oneLine(v.concept ?? v.brief ?? v.script), 240)}`;
  const who = { client: "Client", editor: "Editor", studio: "Studio" };
  const full = (v: Remembered) =>
    [
      `### ${heading(v)}`,
      v.concept && `Concept: ${v.concept}`,
      v.script.trim() && `Script:\n${clip(v.script.trim(), 2500)}`,
      v.editPrompt?.trim() && `Edit prompt:\n${clip(v.editPrompt.trim(), 2000)}`,
      v.cut && `The last cut: ${clip(oneLine(v.cut), 600)}`,
      v.asks.length && `Changes asked along the way:\n${v.asks.slice(-6).map((a) => `- ${who[a.who]}: ${clip(oneLine(a.text), 400)}`).join("\n")}`,
    ]
      .filter(Boolean)
      .join("\n");

  const told: Remembered[] = [];
  const short: Remembered[] = [];
  let used = 0;
  for (const v of newest) {
    const size = depth === "edit" ? full(v).length : line(v).length;
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
  return [head, short.length && `Older ones, in short:\n${oldestFirst(short).map(line).join("\n")}`, ...oldestFirst(told).map(full)]
    .filter(Boolean)
    .join("\n\n");
}

export async function clientMemory(clientId: string, except: string | null, depth: "edit" | "brief"): Promise<string | null> {
  let query = db
    .from("videos")
    .select("id, title, format, brief, created_at, scripts(body, edit_prompt, shoot_plan)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (except) query = query.neq("id", except);
  const { data } = await query;
  const rows = (data ?? []).filter((v) => v.scripts?.body.trim() || v.brief?.trim());
  if (!rows.length) return null;

  const ids = rows.map((v) => v.id);
  const [{ data: asks }, { data: fixes }, { data: cuts }] = await Promise.all([
    db.from("script_revisions").select("video_id, kind, request, created_at").in("video_id", ids).in("kind", ["revised", "client"]).not("request", "is", null),
    db.from("edit_jobs").select("video_id, source, instructions, created_at").in("video_id", ids).in("source", ["editor_fix", "client_changes"]).not("instructions", "is", null),
    db.from("versions").select("video_id, notes").in("video_id", ids).order("number"),
  ]);
  const videos: Remembered[] = rows.map((v) => {
    const plan = v.scripts?.shoot_plan as { concept?: unknown } | null | undefined;
    return {
      title: v.title,
      format: v.format.replace("_", " "),
      createdAt: v.created_at,
      brief: v.brief,
      concept: typeof plan?.concept === "string" ? plan.concept : null,
      script: v.scripts?.body ?? "",
      editPrompt: v.scripts?.edit_prompt ?? null,
      cut: (cuts ?? []).filter((c) => c.video_id === v.id && c.notes).at(-1)?.notes ?? null,
      asks: [
        ...(asks ?? []).filter((a) => a.video_id === v.id).map((a) => ({ at: a.created_at, who: a.kind === "client" ? ("client" as const) : ("studio" as const), text: `On the script: ${a.request}` })),
        ...(fixes ?? []).filter((f) => f.video_id === v.id).map((f) => ({ at: f.created_at, who: f.source === "client_changes" ? ("client" as const) : ("editor" as const), text: `On the edit: ${f.instructions}` })),
      ]
        .sort((a, b) => a.at.localeCompare(b.at))
        .map(({ who, text }) => ({ who, text })),
    };
  });
  return formatMemory(videos, depth);
}

// What the client's other videos sounded like, for the sound designer: the track each used,
// the trend it was posted with, and anything asked about the sound.
export async function musicMemory(clientId: string, except: string | null): Promise<string | null> {
  let query = db.from("videos").select("id, title, created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(30);
  if (except) query = query.neq("id", except);
  const { data: videos } = await query;
  if (!videos?.length) return null;
  const ids = videos.map((v) => v.id);
  const [{ data: versions }, { data: fixes }] = await Promise.all([
    db.from("versions").select("video_id, number, sound, edit_plan").in("video_id", ids).order("number"),
    db.from("edit_jobs").select("video_id, instructions").in("video_id", ids).in("source", ["editor_fix", "client_changes"]).not("instructions", "is", null),
  ]);
  const about = /music|song|track|sound|sfx|effect|audio|volume|loud|quiet|beat|whoosh|musique|son\b|chanson/i;
  const lines = [...videos].reverse().flatMap((v) => {
    const last = (versions ?? []).filter((x) => x.video_id === v.id).at(-1);
    const sound = last?.sound as { track?: { title: string; library: string } | null; trend?: { title: string; artist: string } | null; concept?: string } | null;
    const plan = last?.edit_plan as { music?: { track?: string | null } } | null;
    const asked = (fixes ?? []).filter((f) => f.video_id === v.id).flatMap((f) => (f.instructions ?? "").split("\n").filter((l) => about.test(l)));
    const what = sound?.track ? `"${sound.track.title}" (${sound.track.library})` : plan?.music?.track ? `track ${plan.music.track}` : null;
    if (!what && !asked.length) return [];
    return [
      `- "${v.title}" (${v.created_at.slice(0, 10)}): ${what ?? "no music"}${sound?.concept ? `, ${clip(oneLine(sound.concept), 160)}` : ""}${sound?.trend ? `; posted with "${sound.trend.title}" by ${sound.trend.artist}` : ""}${asked.length ? `; asked: ${clip(oneLine(asked.join(" / ")), 300)}` : ""}`,
    ];
  });
  return lines.length ? lines.join("\n") : null;
}
