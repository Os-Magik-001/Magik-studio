import { clientTitle } from "@/lib/titles";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { answeredCount, QUESTIONS, readAnswers } from "@/lib/questionnaire";
import { asCharte, asFindings, asPillars, asReels, asTrendAudio } from "@/lib/agent-types";
import { Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { LocalDate } from "@/components/local-date";
import { AutoRefresh } from "@/components/auto-refresh";
import { QuestionnaireForm, ResearchForm, StrategistButton } from "@/components/agents/forms";
import { FindingsView, StrategyView } from "@/components/agents/views";

export async function generateMetadata({ params }: { params: Promise<{ clientId: string }> }): Promise<Metadata> {
  return clientTitle((await params).clientId, "Brand & strategy", " · Brand & strategy");
}

const STATUS = {
  queued: { label: "Queued", tone: "neutral" },
  running: { label: "Running", tone: "accent" },
  done: { label: "Done", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
} as const;

export default async function BrandPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  await requireRole("admin", "editor");
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) notFound();

  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id, name").eq("id", clientId).maybeSingle();
  if (!client) notFound();

  const [{ data: form }, { data: strategy }, { data: reports }] = await Promise.all([
    supabase.from("brand_questionnaires").select("answers, updated_at").eq("client_id", clientId).maybeSingle(),
    supabase.from("brand_strategies").select("*").eq("client_id", clientId).maybeSingle(),
    supabase
      .from("trend_reports")
      .select("id, status, hashtags, accounts, progress, error, created_at, finished_at, findings, reels, audio")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  const answers = readAnswers(form?.answers);
  const answered = answeredCount(answers);
  const open = (reports ?? []).find((r) => r.status === "queued" || r.status === "running");
  const latest = (reports ?? []).find((r) => r.status === "done");
  const findings = asFindings(latest?.findings);

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Link href="/clients">Clients</Link> / <Link href={`/clients/${client.id}`}>{client.name}</Link>
          </>
        }
        title="Brand & strategy"
        description="The questionnaire feeds the brand strategist (agent 1); its niche feeds the trend researcher (agent 2); both feed the scriptwriter (agent 3) on every video, and the trending sounds feed the sound designer (agent 4)."
        actions={<LinkButton href={`/agents?client=${client.id}`}>Open mission control</LinkButton>}
      />
      {open && <AutoRefresh seconds={8} />}

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader
            title="1 · Questionnaire"
            description={
              form ? (
                <>
                  {answered} of {QUESTIONS.length} answered · updated <LocalDate value={form.updated_at} preset="short" />
                </>
              ) : (
                "The client can fill this in from their account (Your brand), or you can fill it in here."
              )
            }
          />
          <div className="p-5">
            <QuestionnaireForm clientId={client.id} answers={answers} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="2 · Brand strategy"
            description="Agent 1: niche, charte graphique, business and needs. Running it also updates the brand kit the editor uses."
            actions={strategy && <Badge tone="success">Updated <LocalDate value={strategy.updated_at} preset="short" /></Badge>}
          />
          <div className="flex flex-col gap-5 p-5">
            {answered >= 4 ? (
              <StrategistButton clientId={client.id} again={!!strategy} />
            ) : (
              <p className="text-sm text-muted">Fill in at least 4 answers of the questionnaire to run the strategist.</p>
            )}
            {strategy ? (
              <StrategyView
                niche={strategy.niche}
                keywords={strategy.keywords}
                accounts={strategy.reference_accounts}
                business={strategy.business}
                audience={strategy.audience}
                needs={strategy.needs}
                pillars={asPillars(strategy.pillars)}
                charte={asCharte(strategy.charte)}
              />
            ) : (
              <EmptyState title="No strategy yet">Run the strategist once the questionnaire is filled in.</EmptyState>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="3 · Viral research"
            description="Agent 2 finds the top reels in the niche on Instagram, watches them on the edit engine and writes what makes them work."
          />
          <div className="flex flex-col gap-5 p-5">
            <ResearchForm
              clientId={client.id}
              hashtags={(strategy?.keywords ?? []).slice(0, 4).join(" ")}
              accounts={(strategy?.reference_accounts ?? []).slice(0, 4).join(" ")}
              disabled={open ? "A research run is in progress." : undefined}
            />
            {(reports ?? []).length > 0 && (
              <ul className="flex flex-col gap-2">
                {(reports ?? []).map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2 text-[13px]">
                    <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                    <span className="text-ink-2">
                      {[...r.hashtags.map((h) => `#${h}`), ...r.accounts.map((a) => `@${a}`)].join(" ")}
                    </span>
                    {r.progress && <span className="text-muted">· {r.progress}</span>}
                    {r.error && <span className="text-danger">· {r.error}</span>}
                    <span className="ml-auto text-xs text-muted">
                      <LocalDate value={r.created_at} preset="short" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {findings && latest && <FindingsView findings={findings} reels={asReels(latest.reels)} audio={asTrendAudio(latest.audio)} />}
          </div>
        </Card>
      </div>
    </>
  );
}
