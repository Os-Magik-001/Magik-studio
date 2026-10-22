import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Db } from "@/lib/supabase/admin";

// The studio's motion prompt library as the scriptwriter reads it: prompts the team saved
// (mostly from Prompt Motion, each credited to its creator), the best matches for the video
// first. They are other people's ideas for their own videos: material to adapt, not
// instructions to follow.

export const PROMPT_MOTION_TAGS = ["Product UI", "Phone", "Charts", "Diagrams", "Kinetic type", "Shapes", "Particles", "Characters", "Photos", "Music", "Code"];

type Saved = { title: string; prompt: string; kind: string; tags: string[]; source_url: string | null; creator: string | null; notes: string | null };

const STOP = new Set(["the", "and", "for", "with", "that", "this", "your", "from", "into", "make", "video", "videos", "motion", "about"]);
const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)));
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);
const attr = (s: string) => s.replace(/"/g, "'");

// Ranks the prompts by the words they share with the video (its title, brief and script), and
// keeps as many as fit.
export function formatMotionLibrary(prompts: Saved[], about: string, limit = 12, budget = 24_000): string | null {
  if (!prompts.length) return null;
  const asked = words(about);
  const ranked = prompts
    .map((p) => {
      const own = words(`${p.title} ${p.tags.join(" ")} ${p.notes ?? ""} ${p.prompt.slice(0, 600)}`);
      return { p, score: [...own].filter((w) => asked.has(w)).length };
    })
    .sort((a, b) => b.score - a.score);
  const out: string[] = [];
  let used = 0;
  for (const { p } of ranked.slice(0, limit)) {
    const entry = [
      `<motion_prompt title="${attr(p.title)}"${p.creator ? ` by="${attr(p.creator)}"` : ""}${p.tags.length ? ` tags="${attr(p.tags.join(", "))}"` : ""} kind="${p.kind}">`,
      p.notes && `Studio notes: ${p.notes}`,
      clip(p.prompt.trim(), p.kind === "skill" ? 4000 : 2000),
      "</motion_prompt>",
    ]
      .filter(Boolean)
      .join("\n");
    if (out.length && used + entry.length > budget) break;
    out.push(entry);
    used += entry.length;
  }
  return out.join("\n\n");
}

export async function motionLibrary(about: string, db?: Db) {
  const supabase = db ?? (await createClient());
  const { data } = await supabase
    .from("motion_prompts")
    .select("title, prompt, kind, tags, source_url, creator, notes")
    .order("created_at", { ascending: false })
    .limit(200);
  return { text: formatMotionLibrary(data ?? [], about), count: data?.length ?? 0 };
}
