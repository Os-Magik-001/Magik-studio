import { Suspense } from "react";
import Image from "next/image";
import type { Metadata } from "next";
import { Matrix } from "@/components/matrix";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  "no-profile": "Your account isn't set up in Magik OS yet. Ask your studio manager to add you.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-black px-4 py-12">
      {/* The gold matrix corridor, calmed toward the centre so the card reads. */}
      <div aria-hidden className="fixed inset-0 -z-10">
        <Matrix variant="tunnel" />
        <div className="absolute inset-0 bg-black/25 sm:bg-[radial-gradient(ellipse_42%_48%_at_50%_46%,rgba(0,0,0,0.45)_0%,rgba(0,0,0,0.35)_50%,rgba(0,0,0,0.1)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 hidden h-1/3 bg-gradient-to-t from-black via-black/60 to-transparent sm:block" />
        {/* The light at the end of the corridor, for the glass card to catch. */}
        <div className="absolute top-[46%] left-1/2 h-[70vh] w-[70vw] -translate-x-1/2 -translate-y-1/2">
          <div className="ambient h-full w-full rounded-full bg-[radial-gradient(closest-side,rgba(246,212,58,0.26),rgba(246,212,58,0.07)_55%,transparent)] blur-2xl" />
        </div>
      </div>

      <div className="glass w-full max-w-[400px] rounded-[32px] p-7 sm:p-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/brand/magik-vertical.svg"
            alt="Magik Management"
            width={180}
            height={132}
            unoptimized
            priority
            className="h-auto w-[180px]"
          />
          <div className="mt-8 h-px w-16 bg-accent/60" aria-hidden />
          <p className="kicker mt-6">Studio OS</p>
          <h1 className="mt-2 font-serif text-[2.4rem] leading-none font-medium text-ink">Sign in</h1>
        </div>
        <Suspense fallback={<div className="h-[236px]" aria-busy="true" />}>
          <LoginBody searchParams={searchParams} />
        </Suspense>
        <p className="mt-6 text-center text-xs text-muted">
          Forgot your password? Ask your studio manager to reset it.
        </p>
      </div>
    </main>
  );
}

async function LoginBody({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return (
    <>
      {error && ERRORS[error] && (
        <p role="alert" className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger">
          {ERRORS[error]}
        </p>
      )}
      <LoginForm next={next ?? "/"} />
    </>
  );
}
