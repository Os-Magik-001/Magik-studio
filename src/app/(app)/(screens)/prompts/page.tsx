import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PROMPT_MOTION_TAGS } from "@/lib/motion-prompts";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { LocalDate } from "@/components/local-date";
import { deleteMotionPrompt } from "@/app/actions/prompts";
import { AddPromptForm } from "./forms";

export const metadata: Metadata = { title: "Motion prompts" };

const slug = (tag: string) => tag.toLowerCase().replace(/\s+/g, "-");

export default async function PromptsPage() {
  await requireRole("admin", "editor");
  const supabase = await createClient();
  const { data: prompts } = await supabase.from("motion_prompts").select("*").order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="Motion prompts"
        description="Prompts that made great motion videos with Claude. The scriptwriter adapts the ones that fit each video into its edit prompt for the engine, on the engine's motion templates."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title="The library" description={prompts?.length ? `${prompts.length} saved` : undefined} />
          {!prompts?.length ? (
            <div className="p-5">
              <EmptyState title="Nothing saved yet">Save the Prompt Motion prompts you like: the scriptwriter starts using them on the next script.</EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {prompts.map((p) => (
                <li key={p.id} className="flex flex-col gap-2 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{p.title}</span>
                    <Badge tone={p.kind === "skill" ? "accent" : "neutral"}>{p.kind === "skill" ? "Skill" : "Prompt"}</Badge>
                    {p.tags.map((t) => (
                      <span key={t} className="text-xs text-muted">
                        #{t}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 text-[13px] text-muted">
                    {p.creator && <span>by {p.creator}</span>}
                    {p.source_url && (
                      <a href={p.source_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                        Source
                      </a>
                    )}
                    <LocalDate value={p.created_at} preset="date" prefix="Saved " />
                  </div>
                  {p.notes && <p className="text-[13px] text-ink-2">{p.notes}</p>}
                  <details>
                    <summary className="cursor-pointer text-[13px] text-ink-2">The prompt</summary>
                    <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-3 font-mono text-[12.5px] leading-relaxed text-ink-2">{p.prompt}</pre>
                  </details>
                  <form action={deleteMotionPrompt} className="self-start">
                    <input type="hidden" name="promptId" value={p.id} />
                    <button className="text-xs text-muted hover:text-danger">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Save a prompt" description="Open a video on Prompt Motion, press Copy under its prompt, and paste it here with the page's link." />
            <div className="p-5">
              <AddPromptForm tags={PROMPT_MOTION_TAGS} />
            </div>
          </Card>
          <Card>
            <CardHeader
              title="Prompt Motion"
              description="Motion videos made with Claude, with the prompts behind them. The prompts belong to their creators, and the site doesn't allow AI tools to collect them, so the team picks the ones worth keeping."
            />
            <div className="flex flex-wrap gap-2 p-5 text-[13px]">
              <a href="https://prompt-motion.com" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                All videos
              </a>
              <a href="https://prompt-motion.com/templates" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                Templates
              </a>
              {PROMPT_MOTION_TAGS.map((t) => (
                <a key={t} href={`https://prompt-motion.com/tags/${slug(t)}`} target="_blank" rel="noreferrer" className="text-ink-2 hover:text-accent">
                  #{t}
                </a>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
