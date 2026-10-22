"use client";

import { useState } from "react";
import { Check, Copy, Mail, MessageCircle, Share2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { Field } from "@/components/field";
import { addReferral, adjustCredits, setReferralStatus } from "@/app/actions/referrals";

// The person's link, to copy or share.
export function ReferralLink({ url, name }: { url: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const text = `${name} invites you to Magik Studio: the videos that bring businesses their clients.`;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Your referral link" className="font-mono text-[13px]" />
        <Button
          variant="primary"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={`mailto:?subject=${encodeURIComponent("Magik Studio")}&body=${encodeURIComponent(`${text}\n\n${url}`)}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.08] px-3.5 text-[13px] font-medium text-ink hover:bg-white/[0.13]"
        >
          <Mail size={14} aria-hidden /> Email
        </a>
        <a
          href={`sms:?&body=${encodeURIComponent(`${text} ${url}`)}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.08] px-3.5 text-[13px] font-medium text-ink hover:bg-white/[0.13]"
        >
          <MessageCircle size={14} aria-hidden /> Text message
        </a>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.08] px-3.5 text-[13px] font-medium text-ink hover:bg-white/[0.13]"
        >
          WhatsApp
        </a>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (navigator.share) navigator.share({ title: "Magik Studio", text, url }).catch(() => {});
            else navigator.clipboard.writeText(url).then(() => setCopied(true));
          }}
        >
          <Share2 size={14} aria-hidden /> Share
        </Button>
      </div>
    </div>
  );
}

// Refer a business from here, without the link.
export function ReferSomeone() {
  return (
    <ActionForm action={addReferral} resetOnSuccess className="flex flex-col gap-3">
      <div className="grid gap-3 @min-[32rem]:grid-cols-2">
        <Field label="Their name">
          <Input name="name" required maxLength={120} />
        </Field>
        <Field label="Their business">
          <Input name="company" maxLength={160} />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" maxLength={200} />
        </Field>
        <Field label="Phone">
          <Input name="phone" type="tel" maxLength={40} />
        </Field>
      </div>
      <Field label="A word for the studio">
        <Textarea name="message" rows={2} maxLength={2000} placeholder="What they do, what they'd need" />
      </Field>
      <SubmitButton pendingText="Sending…" className="self-start">
        Refer them
      </SubmitButton>
    </ActionForm>
  );
}

const STATUSES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "signed", label: "Signed" },
  { value: "declined", label: "Declined" },
];

// For sales: where a referral stands. Signed gives the referrer their credits.
export function ReferralStatus({ id, status }: { id: string; status: string }) {
  const [value, setValue] = useState(status);
  return (
    <ActionForm action={setReferralStatus} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <Select name="status" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Status" className="h-8 w-[130px] text-[13px]">
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </Select>
      {value !== status && (
        <SubmitButton size="sm" variant="secondary" pendingText="…">
          Save
        </SubmitButton>
      )}
    </ActionForm>
  );
}

// For the studio manager: give or take credits.
export function AdjustCredits({ people }: { people: { id: string; name: string }[] }) {
  return (
    <ActionForm action={adjustCredits} resetOnSuccess className="flex flex-col gap-3">
      <Field label="Person">
        <Select name="userId" required defaultValue="">
          <option value="" disabled>
            Pick someone
          </option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-[120px_1fr] gap-3">
        <Field label="Credits">
          <Input name="amount" type="number" required step={1} placeholder="50 or -20" />
        </Field>
        <Field label="Why">
          <Input name="reason" required maxLength={200} placeholder="A thank-you, a correction…" />
        </Field>
      </div>
      <SubmitButton variant="secondary" pendingText="Saving…" className="self-start">
        Save credits
      </SubmitButton>
    </ActionForm>
  );
}
