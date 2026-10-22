import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Db } from "@/lib/supabase/admin";
import { asReferenceBreakdown, asReferenceStats } from "@/lib/agent-types";
import { focusLabel, PLATFORM_LABEL, type ReferencePlatform } from "@/lib/reference-links";

// The reference videos the studio chose ("make it like this"), told to the agents in the app:
// the scriptwriter reads all of each breakdown, the motion director its look and graphics. The
// engine tells the editor, the sound designer and the motion designer (engine/src/references.ts).
// Read with the viewer's access, like the memory.

export type ReferenceRow = {
  video_id: string | null;
  url: string;
  platform: string;
  focus: string[];
  note: string | null;
  status: string;
  watched: boolean;
  title: string | null;
  owner: string | null;
  duration: number | null;
  stats: unknown;
  analysis: unknown;
  error: string | null;
};

// A video's own references first, then the client's; newest first in each.
export async function loadReferences(clientId: string, videoId: string | null, db?: Db): Promise<ReferenceRow[]> {
  const supabase = db ?? (await createClient());
  let query = supabase
    .from("reference_videos")
    .select("video_id, url, platform, focus, note, status, watched, title, owner, duration, stats, analysis, error")
    .eq("client_id", clientId);
  query = videoId ? query.or(`video_id.eq.${videoId},video_id.is.null`) : query.is("video_id", null);
  const { data } = await query.order("created_at", { ascending: false });
  return (data ?? []).sort((a, b) => Number(!!b.video_id) - Number(!!a.video_id));
}

const list = (items: string[]) => items.map((x) => `  - ${x}`).join("\n");

export function describeReferences(rows: ReferenceRow[], agent: "script" | "motion"): string | null {
  // One the engine couldn't read and the studio said nothing about tells an agent nothing.
  const told = rows.filter((r) => asReferenceBreakdown(r.analysis) || r.note).map((r, i) => {
    const b = asReferenceBreakdown(r.analysis);
    const s = asReferenceStats(r.stats);
    const wants = r.focus.length ? `The studio wants from it: ${r.focus.map(focusLabel).join(", ")}.` : "The studio didn't say what it wants from it: take what fits.";
    const missing = b
      ? null
      : r.status === "done"
        ? r.error ?? "The engine couldn't watch it."
        : r.status === "failed"
          ? `The engine couldn't open it (${r.error ?? "unknown error"}).`
          : "The engine is still watching it.";
    const numbers = s ? [s.cutsPerSecond !== null && `${s.cutsPerSecond} cuts per second`, s.medianShot !== null && `shots around ${s.medianShot} s`, s.wordsPerMinute !== null && `${s.wordsPerMinute} words per minute`, s.bpm && `music about ${s.bpm} BPM`, r.duration && `${r.duration} s long`].filter(Boolean) : [];
    const lines = [
      wants,
      r.note && `The studio's note: ${r.note}`,
      missing && `${missing} Work from the note.`,
      numbers.length && `Measured: ${numbers.join(", ")}.`,
      b && `What it is: ${b.summary}`,
      ...(agent === "script"
        ? [
            b && `Hook: ${b.hook}`,
            b?.structure.length && `Structure: ${b.structure.map((x) => `${x.at} ${x.beat}: ${x.what}`).join(" | ")}`,
            b && `Pacing: ${b.pacing}`,
            b && `Script: ${b.script}`,
            b && `Camera and look: ${b.camera}`,
            b && `Captions and text: ${b.text}`,
            b && `Graphics: ${b.graphics}`,
            b && `Sound: ${b.sound}`,
          ]
        : [b && `Captions and text: ${b.text}`, b && `Graphics: ${b.graphics}`, b && `Camera and look: ${b.camera}`, b && `Pacing: ${b.pacing}`]),
      b?.borrow.length && `Borrow:\n${list(b.borrow)}`,
      b?.avoid.length && `Avoid:\n${list(b.avoid)}`,
    ].filter(Boolean);
    const by = [PLATFORM_LABEL[r.platform as ReferencePlatform] ?? r.platform, r.owner, r.title && `“${r.title}”`].filter(Boolean).join(" · ");
    return `<reference n="${i + 1}" for="${r.video_id ? "this video" : "all the client's videos"}" link="${r.url}">\n${by}\n${lines.join("\n")}\n</reference>`;
  });
  return told.length ? told.join("\n\n") : null;
}
