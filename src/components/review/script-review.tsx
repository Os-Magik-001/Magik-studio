"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button, Card, CardHeader, Textarea } from "@/components/ui";
import { ScriptStatusBadge } from "@/components/status";
import { decideScript } from "@/app/actions/workflow";
import type { ScriptStatus } from "@/lib/workflow";
import { LocalDate } from "@/components/local-date";

export function ScriptReview({
  videoId,
  canDecide,
  status,
  body,
  shots,
  approvedAt,
}: {
  videoId: string;
  canDecide: boolean;
  status: ScriptStatus;
  body: string;
  shots: string[];
  approvedAt: string | null;
}) {
  const [asking, setAsking] = useState(false);
  return (
    <Card>
      <CardHeader
        title="Script"
        description={
          canDecide
            ? "Approve the script before the shoot, so we film exactly what you need."
            : approvedAt
              ? <LocalDate value={approvedAt} preset="date" prefix="Approved " />
              : undefined
        }
        actions={<ScriptStatusBadge status={status} />}
      />
      <div className="grid gap-6 p-5 md:grid-cols-[1fr_280px]">
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{body}</div>
        {shots.length > 0 && (
          <div>
            <h3 className="mb-2 text-[13px] font-medium text-ink-2">What we&apos;ll film</h3>
            <ol className="list-decimal space-y-1 pl-5 text-[13px] text-ink-2">
              {shots.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
      {canDecide && (
        <div className="border-t border-line px-5 py-4">
          {asking ? (
            <ActionForm action={decideScript} className="flex flex-col gap-3">
              <input type="hidden" name="videoId" value={videoId} />
              <input type="hidden" name="decision" value="changes" />
              <Textarea name="note" rows={3} required autoFocus placeholder="What should change?" />
              <div className="flex gap-2">
                <SubmitButton variant="primary">Send changes</SubmitButton>
                <Button type="button" variant="ghost" onClick={() => setAsking(false)}>
                  Cancel
                </Button>
              </div>
            </ActionForm>
          ) : (
            <div className="flex flex-wrap gap-2">
              <ActionForm action={decideScript}>
                <input type="hidden" name="videoId" value={videoId} />
                <input type="hidden" name="decision" value="approve" />
                <SubmitButton variant="success" pendingText="Approving…">
                  Approve script
                </SubmitButton>
              </ActionForm>
              <Button variant="secondary" onClick={() => setAsking(true)}>
                Request changes
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
