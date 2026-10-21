"use client";

import { ArrowRight } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { signIn } from "./actions";

const field =
  "h-11 w-full rounded-full border border-white/20 bg-white/[0.14] px-5 text-[14px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl placeholder:text-white/60 focus:border-white/50 focus:outline-none";

export function LoginForm({ next }: { next: string }) {
  return (
    <ActionForm action={signIn} className="flex flex-col gap-2.5 text-center [&_[role=alert]]:text-[#ffb4ae]">
      <input type="hidden" name="next" value={next} />
      <label className="sr-only" htmlFor="email">
        Email
      </label>
      <input id="email" name="email" type="email" autoComplete="email" required autoFocus placeholder="Email" className={field} />
      <div className="relative">
        <label className="sr-only" htmlFor="password">
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required placeholder="Password" className={`${field} pr-14`} />
        <SubmitButton
          pendingText="…"
          variant="secondary"
          className="absolute top-1.5 right-1.5 !h-8 !w-8 !px-0"
        >
          <ArrowRight size={16} aria-label="Sign in" />
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
