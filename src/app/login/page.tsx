import { Suspense } from "react";
import type { Metadata } from "next";
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
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-ink font-serif text-xl text-bg">
            M
          </div>
          <h1 className="font-serif text-3xl text-ink">Sign in to Magik OS</h1>
          <p className="mt-2 text-sm text-muted">
            Forgot your password? Ask your studio manager to reset it.
          </p>
        </div>
        <Suspense>
          <LoginBody searchParams={searchParams} />
        </Suspense>
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
        <p role="alert" className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">
          {ERRORS[error]}
        </p>
      )}
      <LoginForm next={next ?? "/"} />
    </>
  );
}
