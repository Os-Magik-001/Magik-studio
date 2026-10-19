// Editing skills: the studio's house techniques, written as Markdown so editors
// can add them without touching code. Each skill is a folder holding a SKILL.md,
// the same layout as Claude's Agent Skills:
//
//   ---
//   name: punch-ins
//   description: When and how to punch in on a shot
//   formats: social_short, ad        (or "all"; optional, defaults to all)
//   enabled: true                    (optional)
//   style: clean                     (optional: clean or dynamic; only loaded in that editing style)
//   when: omgadrian                  (optional: only loaded when the brief or notes name one of these words)
//   agents: editor, sound            (optional: which agents read it; the editor when left out)
//   ---
//   The technique, in Markdown.
//
// Skills are read fresh for every job, so a new folder takes effect on the next edit.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type EditStyle = "clean" | "dynamic";
// The editor plans the cut; the sound designer does the music and effects after it.
export type Agent = "editor" | "sound";
export type Skill = { name: string; description: string; formats: string[] | "all"; enabled: boolean; style: EditStyle | "any"; when: string[]; agents: string[]; body: string };

export const skillsDir = process.env.ENGINE_SKILLS_DIR ?? fileURLToPath(new URL("../skills", import.meta.url));

export function parseSkill(text: string, fallbackName: string): Skill {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error("it has no front matter (the --- block at the top)");
  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (kv) meta[kv[1].toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  if (!meta.description) throw new Error("its front matter has no description");
  if (!match[2].trim()) throw new Error("it has no instructions below the front matter");
  const formats = (meta.formats ?? "all")
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((f) => f.trim().toLowerCase().replace(/\s+/g, "_"))
    .filter(Boolean);
  return {
    name: meta.name || fallbackName,
    description: meta.description,
    formats: !formats.length || formats.includes("all") ? "all" : formats,
    enabled: meta.enabled !== "false",
    style: meta.style === "clean" || meta.style === "dynamic" ? meta.style : "any",
    when: (meta.when ?? "").split(",").map((w) => w.trim().toLowerCase()).filter(Boolean),
    agents: (meta.agents ?? "editor").split(",").map((a) => a.trim().toLowerCase()).filter(Boolean),
    body: match[2].trim(),
  };
}

// Every skill one agent reads for a video format and editing style, in folder-name order.
// Skills with `when` words load only when `request` (the brief and notes) names one.
// A broken skill is skipped with a warning rather than failing the edit.
export async function loadSkills(format: string, dir = skillsDir, warn: (msg: string) => void = console.warn, style: EditStyle = "dynamic", request = "", agent: Agent = "editor"): Promise<Skill[]> {
  const asked = request.toLowerCase();
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const skills: Skill[] = [];
  for (const entry of entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(dir, entry.name, "SKILL.md");
    const text = await readFile(file, "utf8").catch(() => null);
    if (text === null) continue;
    try {
      const skill = parseSkill(text, entry.name);
      const fits = (skill.style === "any" || skill.style === style) && (!skill.when.length || skill.when.some((w) => asked.includes(w))) && skill.agents.includes(agent);
      if (skill.enabled && fits && (skill.formats === "all" || skill.formats.includes(format))) skills.push(skill);
    } catch (err) {
      warn(`Skipping skill ${entry.name}: ${(err as Error).message}`);
    }
  }
  return skills;
}
