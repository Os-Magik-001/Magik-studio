import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// Every agent's skills live in one library, engine/skills: a folder per skill holding a SKILL.md
// with front matter (see engine/skills/README.md). `agents:` says who reads it. The edit engine
// reads the editor's, the sound designer's and the researcher's; the app reads the rest here. The
// files ship with the app (next.config.ts, outputFileTracingIncludes).

export type AgentKey = "strategist" | "planner" | "researcher" | "scriptwriter" | "motion" | "sound" | "editor";
export type Skill = { folder: string; name: string; description: string; agents: AgentKey[]; body: string };

const DIR = path.join(process.cwd(), "engine", "skills");
const KEYS = new Set<AgentKey>(["strategist", "planner", "researcher", "scriptwriter", "motion", "sound", "editor"]);

function parse(text: string, folder: string): Skill | null {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (kv) meta[kv[1].toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  if (!meta.description || !match[2].trim() || meta.enabled === "false") return null;
  const agents = (meta.agents ?? "editor")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter((a): a is AgentKey => KEYS.has(a as AgentKey));
  // Opt-in skills (`when:`) load on the engine only when a brief names them; the app's agents
  // read the always-on ones.
  if (meta.when) return null;
  return { folder, name: meta.name || folder, description: meta.description, agents, body: match[2].trim() };
}

let cache: { at: number; skills: Skill[] } | null = null;

// The whole library, read at most once a minute (skills only change with a deploy).
export async function allSkills(): Promise<Skill[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.skills;
  const entries = await readdir(DIR, { withFileTypes: true }).catch(() => []);
  const skills: Skill[] = [];
  for (const entry of entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const text = await readFile(path.join(DIR, entry.name, "SKILL.md"), "utf8").catch(() => null);
    const skill = text && parse(text, entry.name);
    if (skill) skills.push(skill);
  }
  cache = { at: Date.now(), skills };
  return skills;
}

export const skillsFor = async (agent: AgentKey) => (await allSkills()).filter((s) => s.agents.includes(agent));

// An agent's skills as a block for its system prompt.
export async function skillsBlock(agent: AgentKey) {
  const skills = await skillsFor(agent);
  if (!skills.length) return "";
  return `\n\nYour skills: the studio's own playbook for this job. Follow them unless the client's brand, the brief or the studio's notes say otherwise.\n\n${skills
    .map((s) => `<skill name="${s.name}">\n${s.body}\n</skill>`)
    .join("\n\n")}`;
}
