"use client";

import { Search, Sparkles } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field } from "@/components/field";
import { Input, Textarea } from "@/components/ui";
import { QUESTIONS, type Answers } from "@/lib/questionnaire";
import { requestTrendResearch, runBrandStrategist, saveQuestionnaire } from "@/app/actions/agents";

export function QuestionnaireForm({ clientId, answers, submitLabel = "Save answers" }: { clientId?: string; answers: Answers; submitLabel?: string }) {
  return (
    <ActionForm action={saveQuestionnaire} className="grid gap-4 @min-[40rem]:grid-cols-2">
      {clientId && <input type="hidden" name="clientId" value={clientId} />}
      {QUESTIONS.map((q) => (
        <Field key={q.key} label={q.label} hint={q.hint} className={q.rows > 1 ? "@min-[40rem]:col-span-2" : undefined}>
          {q.rows > 1 ? <Textarea name={q.key} rows={q.rows} defaultValue={answers[q.key] ?? ""} /> : <Input name={q.key} defaultValue={answers[q.key] ?? ""} />}
        </Field>
      ))}
      <div className="@min-[40rem]:col-span-2">
        <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function StrategistButton({ clientId, again }: { clientId: string; again: boolean }) {
  return (
    <ActionForm action={runBrandStrategist}>
      <input type="hidden" name="clientId" value={clientId} />
      <SubmitButton pendingText="The strategist is working (about a minute)…">
        <Sparkles size={14} aria-hidden /> {again ? "Rerun the brand strategist" : "Run the brand strategist"}
      </SubmitButton>
    </ActionForm>
  );
}

export function ResearchForm({ clientId, hashtags, accounts, disabled }: { clientId: string; hashtags: string; accounts: string; disabled?: string }) {
  return (
    <ActionForm action={requestTrendResearch} className="flex flex-col gap-3">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="grid gap-3 @min-[40rem]:grid-cols-2">
        <Field label="Hashtags" hint="Up to 4, separated by spaces.">
          <Input name="hashtags" defaultValue={hashtags} placeholder="barbershop fade barberlife" />
        </Field>
        <Field label="Accounts" hint="Up to 4 usernames to study.">
          <Input name="accounts" defaultValue={accounts} placeholder="creator1 creator2" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Queuing…">
          <Search size={14} aria-hidden /> Find the viral reels
        </SubmitButton>
        {disabled && <span className="text-xs text-muted">{disabled}</span>}
      </div>
    </ActionForm>
  );
}
