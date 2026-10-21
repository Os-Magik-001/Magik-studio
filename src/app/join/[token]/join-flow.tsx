"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button, Input } from "@/components/ui";
import { Field } from "@/components/field";
import { Hello } from "@/components/setup/setup-frame";
import { createAccountFromInvite, markInviteOpened } from "@/app/actions/setup";

export function JoinFlow({
  token,
  language,
  clientName,
  contactName,
  email,
  pack,
  signedInAs,
}: {
  token: string;
  language: "fr" | "en";
  clientName: string;
  contactName: string;
  email: string;
  pack: string | null;
  signedInAs: string | null;
}) {
  const [step, setStep] = useState<"hello" | "account">("hello");
  const first = contactName.split(/\s+/)[0];

  useEffect(() => {
    markInviteOpened(token).catch(() => {});
  }, [token]);

  if (step === "hello") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
        <Hello word={language === "fr" ? "bonjour" : "hello"} />
        <h1 className="animate-rise-in mt-2 font-display text-[30px] leading-tight font-bold tracking-tight text-ink [animation-delay:1.8s] sm:text-[36px]">
          Welcome to Magik{first ? `, ${first}` : ""}.
        </h1>
        <p className="animate-rise-in mt-3 max-w-lg text-[15px] text-ink-2 [animation-delay:2s]">
          Let&apos;s set up {clientName}&apos;s space: your account, a few questions about your business, the videos you love, and your brand. It takes about ten minutes.
        </p>
        {pack && (
          <p className="animate-rise-in mt-5 rounded-full bg-white/[0.08] px-4 py-1.5 text-[13px] text-ink-2 [animation-delay:2.1s]">
            Your pack: <span className="font-semibold text-ink">{pack}</span>
          </p>
        )}
        <Button variant="primary" className="animate-rise-in mt-8 h-11 px-7 text-[15px] [animation-delay:2.2s]" onClick={() => setStep("account")}>
          Get started <ArrowRight size={16} aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-rise-in mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-4">
      <h1 className="font-display text-[28px] font-bold tracking-tight text-ink">Create your account</h1>
      <p className="mt-2 text-[14px] text-ink-2">You&apos;ll use it to follow your videos, comment and approve them.</p>
      {signedInAs && (
        <p className="mt-4 rounded-[12px] bg-warning-soft px-3.5 py-2.5 text-[13px] text-warning">
          You&apos;re signed in as {signedInAs} in this browser. Opening this account signs you in as the new account instead.
        </p>
      )}
      <ActionForm action={createAccountFromInvite} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <Field label="Your name">
          <Input name="fullName" required defaultValue={contactName} autoComplete="name" className="h-11" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" required defaultValue={email} autoComplete="email" className="h-11" />
        </Field>
        <Field label="Password" hint="At least 8 characters.">
          <Input name="password" type="password" required minLength={8} autoComplete="new-password" className="h-11" />
        </Field>
        <Field label="Confirm the password">
          <Input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="h-11" />
        </Field>
        <div className="mt-2 flex items-center justify-between gap-3">
          <button type="button" onClick={() => setStep("hello")} className="text-[13.5px] text-muted hover:text-ink">
            Back
          </button>
          <SubmitButton pendingText="Opening your account…" className="h-11 px-6">
            Continue <ArrowRight size={16} aria-hidden />
          </SubmitButton>
        </div>
      </ActionForm>
      <p className="mt-6 text-center text-[12.5px] text-muted">
        Already have an account? <Link href="/login?next=/setup" className="text-accent hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
