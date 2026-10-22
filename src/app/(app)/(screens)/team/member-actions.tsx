"use client";

import { useState } from "react";
import { KeyRound, PauseCircle, PlayCircle, Settings2, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button, Input, cx } from "@/components/ui";
import { NewPasswordField } from "@/components/password-tools";
import { deleteMember, resetMemberPassword, setMemberPaused } from "@/app/actions/studio";

type Panel = "password" | "pause" | "delete" | null;

// A person's account, managed from the Team list: a new password, pause or resume, delete.
export function MemberActions({ userId, name, email, paused, self }: { userId: string; name: string; email: string; paused: boolean; self: boolean }) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const close = () => {
    setPanel(null);
    setOpen(false);
  };

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label={`Manage ${name}'s account`}>
        <Settings2 size={14} aria-hidden /> Manage
      </Button>
    );
  }

  const tab = (key: Exclude<Panel, null>, label: string, icon: React.ReactNode, danger?: boolean) => (
    <button
      type="button"
      onClick={() => setPanel(panel === key ? null : key)}
      aria-pressed={panel === key}
      className={cx(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors",
        panel === key ? (danger ? "bg-danger text-white" : "bg-white/[0.16] text-ink") : danger ? "text-danger hover:bg-danger-soft" : "text-ink-2 hover:bg-white/10",
      )}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="flex w-full flex-col gap-3 rounded-[14px] bg-white/[0.04] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] @min-[40rem]:w-[360px]">
      <div className="flex flex-wrap items-center gap-1">
        {tab("password", "Password", <KeyRound size={14} aria-hidden />)}
        {!self && tab("pause", paused ? "Resume" : "Pause", paused ? <PlayCircle size={14} aria-hidden /> : <PauseCircle size={14} aria-hidden />)}
        {!self && tab("delete", "Delete", <Trash2 size={14} aria-hidden />, true)}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={close}>
          Done
        </Button>
      </div>

      {panel === "password" && (
        <ActionForm action={resetMemberPassword} className="flex flex-col gap-2">
          <input type="hidden" name="userId" value={userId} />
          <NewPasswordField label="New password" />
          <SubmitButton size="sm" pendingText="Saving…">
            Set password
          </SubmitButton>
        </ActionForm>
      )}

      {panel === "pause" && (
        <ActionForm action={setMemberPaused} onSuccess={() => setPanel(null)} className="flex flex-col gap-2">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="pause" value={paused ? "0" : "1"} />
          <p className="text-[13px] text-ink-2">
            {paused
              ? `${name} will be able to sign in again, with everything as they left it.`
              : `${name} won't be able to sign in or use Magik OS until you resume them. Nothing they made is removed.`}
          </p>
          <SubmitButton size="sm" variant={paused ? "primary" : "secondary"} pendingText={paused ? "Resuming…" : "Pausing…"}>
            {paused ? "Resume the account" : "Pause the account"}
          </SubmitButton>
        </ActionForm>
      )}

      {panel === "delete" && (
        <ActionForm action={deleteMember} className="flex flex-col gap-2">
          <input type="hidden" name="userId" value={userId} />
          <p className="text-[13px] text-ink-2">
            This deletes {name}&apos;s account for good. Their videos and files stay; their comments stay without their name. To confirm, type <span className="font-semibold text-ink">{email}</span>.
          </p>
          <Input name="confirm" autoComplete="off" spellCheck={false} placeholder={email} aria-label="Their email, to confirm" />
          <SubmitButton size="sm" variant="danger" pendingText="Deleting…">
            Delete the account
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
