"use client";

import { useState, type ReactNode } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button, Card, CardHeader, Textarea } from "@/components/ui";
import { ScriptStatusBadge } from "@/components/status";
import { decideScript } from "@/app/actions/workflow";
import type { ScriptStatus } from "@/lib/workflow";
import { LocalDate } from "@/components/local-date";
import { ScriptPdfLink } from "@/components/scripts/pdf-link";

// The script as the client reads it (`children`: the script document, from the page) and their
// decision on it.
export function ScriptReview({
  videoId,
  canDecide,
  status,
  approvedAt,
  children,
}: {
  videoId: string;
  canDecide: boolean;
  status: ScriptStatus;
  approvedAt: string | null;
  children: ReactNode;
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
        actions={
          <>
            <ScriptPdfLink videoId={videoId} />
            <ScriptStatusBadge status={status} />
          </>
        }
      />
      <div className="p-5">{children}</div>
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
