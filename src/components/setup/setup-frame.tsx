import Image from "next/image";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cx } from "@/components/ui";
import { Wallpaper } from "@/components/desktop/wallpaper";

// The client's setup, in the manner of the macOS Setup Assistant: one large glass panel over
// the wallpaper, the steps along the top.
export function SetupFrame({
  children,
  steps,
  current,
  wide,
}: {
  children: ReactNode;
  steps?: { key: string; label: string; done: boolean }[];
  current?: string;
  wide?: boolean;
}) {
  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center px-3 py-6 sm:px-6 sm:py-10">
      <Wallpaper />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-black/40" />
      <div className={cx("glass-pop animate-rise-in flex w-full flex-col rounded-[28px] sm:rounded-[34px]", wide ? "max-w-[1180px]" : "max-w-[860px]")}>
        <header className="flex items-center justify-between gap-4 px-6 pt-5 sm:px-9 sm:pt-7">
          <Image src="/brand/magik-horizontal.svg" alt="Magik Management" width={120} height={26} unoptimized priority className="h-auto w-[112px]" />
          {steps && (
            <ol className="hidden items-center gap-1 sm:flex" aria-label="Setup steps">
              {steps.map((s, i) => (
                <li key={s.key} className="flex items-center">
                  {i > 0 && <span aria-hidden className="mx-1.5 h-px w-5 bg-white/20" />}
                  <span
                    aria-current={s.key === current ? "step" : undefined}
                    className={cx(
                      "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
                      s.key === current ? "bg-white/[0.14] text-ink" : s.done ? "text-success" : "text-muted",
                    )}
                  >
                    {s.done && s.key !== current ? <Check size={12} strokeWidth={3} aria-hidden /> : null}
                    {s.label}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </header>
        <div className="flex flex-1 flex-col px-6 pt-6 pb-6 sm:px-12 sm:pt-8 sm:pb-9">{children}</div>
      </div>
    </main>
  );
}

// The macOS "hello", drawn then filled, in the client's language.
export function Hello({ word }: { word: string }) {
  return (
    <svg viewBox="0 0 600 170" className="h-auto w-full max-w-[460px]" role="img" aria-label={word}>
      <text
        x="50%"
        y="122"
        textAnchor="middle"
        className="hello-word"
        style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontStyle: "italic", fontWeight: 600, fontSize: 150 }}
      >
        {word}
      </text>
    </svg>
  );
}
