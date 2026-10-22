"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Input, Textarea } from "@/components/ui";
import { Field } from "@/components/field";
import { submitReferral } from "@/app/actions/referrals";

export function ReferralForm({ code }: { code: string }) {
  const [sent, setSent] = useState(false);
  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success text-black">
          <Check size={24} strokeWidth={3} aria-hidden />
        </span>
        <p className="text-[16px] font-semibold text-ink">Thank you! The studio will be in touch very soon.</p>
      </div>
    );
  }
  return (
    <ActionForm action={submitReferral} onSuccess={() => setSent(true)} className="flex flex-col gap-3.5">
      <input type="hidden" name="code" value={code} />
      {/* People never see this field; bots fill it. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <Field label="Your name">
        <Input name="name" required maxLength={120} autoComplete="name" />
      </Field>
      <Field label="Your business">
        <Input name="company" maxLength={160} autoComplete="organization" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email">
          <Input name="email" type="email" maxLength={200} autoComplete="email" />
        </Field>
        <Field label="Phone">
          <Input name="phone" type="tel" maxLength={40} autoComplete="tel" />
        </Field>
      </div>
      <Field label="What would you like videos for?">
        <Textarea name="message" rows={3} maxLength={2000} />
      </Field>
      <SubmitButton pendingText="Sending…" className="h-11 text-[15px]">
        Send to the studio
      </SubmitButton>
    </ActionForm>
  );
}
