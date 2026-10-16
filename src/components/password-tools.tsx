"use client";

import { useId, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button, Input } from "@/components/ui";
import { resetMemberPassword } from "@/app/actions/studio";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generatePassword(length = 14) {
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

// A visible (not masked) password box for the studio manager, who has to share it.
export function NewPasswordField({ label = "Temporary password" }: { label?: string }) {
  const [value, setValue] = useState("");
  const [copied, setCopied] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          aria-describedby={`${id}-hint`}
          name="password"
          type="text"
          autoComplete="new-password"
          spellCheck={false}
          required
          minLength={8}
          maxLength={72}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setCopied(false);
          }}
          className="font-mono"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setValue(generatePassword());
            setCopied(false);
          }}
        >
          Generate
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-label="Copy password"
          disabled={!value}
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </Button>
      </div>
      <p id={`${id}-hint`} className="text-xs text-muted">
        At least 8 characters. Share it privately; they can change it on their Account page.
      </p>
    </div>
  );
}

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <KeyRound size={14} aria-hidden /> Reset password
      </Button>
    );
  }
  return (
    <ActionForm action={resetMemberPassword} className="flex flex-col gap-2">
      <input type="hidden" name="userId" value={userId} />
      <NewPasswordField label="New password" />
      <div className="flex gap-2">
        <SubmitButton size="sm" pendingText="Saving…">
          Set password
        </SubmitButton>
        <Button size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </ActionForm>
  );
}
