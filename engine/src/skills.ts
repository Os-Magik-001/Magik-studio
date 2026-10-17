// Editing skills: the studio's house techniques, written as Markdown so editors
// can add them without touching code. Each skill is a folder holding a SKILL.md,
// the same layout as Claude's Agent Skills:
//
//   ---
//   name: punch-ins
//   description: When and how to punch in on a shot
//   formats: social_short, ad        (or "all"; optional, defaults to all)
//   enabled: true                    (optional)
//   ---
//   The technique, in Markdown.
//
// Skills are read fresh for every job, so a new folder takes effect on the next edit.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type Skill = { name: string; description: string; formats: string[] | "all"; enabled: boolean; body: string };

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
    body: match[2].trim(),
  };
}

// Every skill that applies to a video format, in folder-name order. A broken skill
// is skipped with a warning rather than failing the edit.
export async function loadSkills(format: string, dir = skillsDir, warn: (msg: string) => void = console.warn): Promise<Skill[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const skills: Skill[] = [];
  for (const entry of entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(dir, entry.name, "SKILL.md");
    const text = await readFile(file, "utf8").catch(() => null);
    if (text === null) continue;
    try {
      const skill = parseSkill(text, entry.name);
      if (skill.enabled && (skill.formats === "all" || skill.formats.includes(format))) skills.push(skill);
    } catch (err) {
      warn(`Skipping skill ${entry.name}: ${(err as Error).message}`);
    }
  }
  return skills;
}
