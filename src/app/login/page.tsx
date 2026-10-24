import { Suspense } from "react";
import Image from "next/image";
import type { Metadata } from "next";
import { Wallpaper } from "@/components/shell/wallpaper";
import { LockClock } from "./lock-screen";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  "no-profile": "Your account isn't set up in Magik OS yet. Ask your studio manager to add you.",
};

// The lock screen: the desktop's wallpaper, the date and time, and the sign-in fields.
export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-between overflow-hidden px-4 pt-[9vh] pb-[7vh] text-white">
      <Wallpaper />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-black/30" />

      <LockClock />

      <div className="flex w-full max-w-[340px] flex-col items-center animate-rise-in">
        <div className="glass-bar flex h-[84px] w-[84px] items-center justify-center rounded-full">
          <Image src="/brand/magik-monogram.svg" alt="" width={47} height={32} unoptimized priority className="h-8 w-auto" />
        </div>
        <h1 className="on-wallpaper mt-3.5 font-display text-[20px] font-semibold tracking-tight">Magik OS</h1>
        <p className="on-wallpaper mt-0.5 text-[13px] text-white/70">Sign in to the studio</p>
        <Suspense fallback={<div className="h-[132px]" aria-busy="true" />}>
          <LoginBody searchParams={searchParams} />
        </Suspense>
        <p className="on-wallpaper mt-5 text-center text-[12px] text-white/60">Forgot your password? Ask your studio manager to reset it.</p>
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
    <div className="mt-6 w-full">
      {error && ERRORS[error] && (
        <p role="alert" className="glass-pop mb-3 rounded-2xl px-3.5 py-2.5 text-center text-[13px] text-white">
          {ERRORS[error]}
        </p>
      )}
      <LoginForm next={next ?? "/"} />
    </div>
  );
}
