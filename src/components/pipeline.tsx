import type { ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { STEPS, WHO, type NextStep, type StepKey, type StepState, type Who } from "@/lib/pipeline";
import { cx } from "@/components/ui";

// The pipeline's building blocks: who a video waits on, its next step, and the numbered steps of
// a video's page with a bar to jump between them.

const WHO_DOT: Record<Who, string> = {
  studio: "bg-accent",
  client: "bg-[#8fb8ff]",
  crew: "bg-[#c39bff]",
  engine: "bg-warning animate-pulse",
  done: "bg-success",
};

export function WhoDot({ who, className }: { who: Who; className?: string }) {
  return <span aria-hidden className={cx("inline-block h-2 w-2 shrink-0 rounded-full", WHO_DOT[who], className)} />;
}

// "Next: send the script to the client · waiting on the studio", with a link to the step.
export function NextStepBanner({ next, href, extra }: { next: NextStep; href: string; extra?: ReactNode }) {
  const done = next.who === "done";
  return (
    <div className={cx("flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[20px] border px-4 py-3", done ? "border-success/30 bg-success-soft" : "border-accent/25 bg-accent-soft")}>
      <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
        <WhoDot who={next.who} className="h-2.5 w-2.5" />
        <div className="min-w-0">
          <div className="text-[11px] font-semibold tracking-[0.18em] text-muted uppercase">{done ? "Finished" : "Next step"}</div>
          <div className="text-sm font-medium text-ink">{next.label}</div>
        </div>
      </div>
      {!done && (
        <div className="flex items-center gap-4 pl-5.5 sm:pl-0">
          <span className="text-xs text-muted">Waiting on {WHO[next.who].label.toLowerCase()}</span>
          {extra}
          <a href={href} className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
            Go there <ArrowRight size={13} aria-hidden />
          </a>
        </div>
      )}
    </div>
  );
}

function StepMark({ n, state }: { n: number; state: StepState }) {
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums",
        state === "done" && "bg-success text-success-ink",
        state === "current" && "bg-accent text-accent-ink shadow-[0_0_0_4px_rgba(246,212,58,0.18)]",
        state === "todo" && "bg-white/8 text-muted",
        state === "optional" && "border border-dashed border-white/25 text-muted",
      )}
    >
      {state === "done" ? <Check size={14} strokeWidth={2.5} /> : n}
    </span>
  );
}

const STATE_LABEL: Record<StepState, string> = { done: "done", current: "current step", todo: "to do", optional: "optional" };

// The bar under the header: every step, its state, a jump link.
export function StepNav({ states }: { states: Record<StepKey, StepState> }) {
  return (
    <nav aria-label="Steps" className="glass z-20 -mx-1 mb-6 overflow-x-auto rounded-full p-1 md:sticky md:top-3">
      <ol className="flex min-w-max items-center gap-0.5">
        {STEPS.map((s, i) => (
          <li key={s.key}>
            <a
              href={`#${s.key}`}
              aria-current={states[s.key] === "current" ? "step" : undefined}
              className={cx(
                "flex h-9 items-center gap-2 rounded-full px-3 text-[13px] transition-colors",
                states[s.key] === "current" ? "bg-accent/15 font-semibold text-accent" : "text-ink-2 hover:bg-white/8 hover:text-ink",
              )}
            >
              <span
                className={cx(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                  states[s.key] === "done" ? "bg-success text-success-ink" : states[s.key] === "current" ? "bg-accent text-accent-ink" : states[s.key] === "optional" ? "border border-dashed border-white/25 text-muted" : "bg-white/8 text-muted",
                )}
              >
                {states[s.key] === "done" ? <Check size={11} strokeWidth={3} aria-hidden /> : i + 1}
              </span>
              {s.label}
              <span className="sr-only">({STATE_LABEL[states[s.key]]})</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// One numbered step of a video's page.
export function StepCard({
  step,
  state,
  title,
  description,
  actions,
  children,
  bodyClassName,
}: {
  step: StepKey;
  state: StepState;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  bodyClassName?: string;
}) {
  const n = STEPS.findIndex((s) => s.key === step) + 1;
  return (
    <section id={step} aria-labelledby={`${step}-title`} className={cx("frost scroll-mt-20 rounded-[22px]", state === "current" && "ring-1 ring-accent/35")}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <StepMark n={n} state={state} />
          <div className="min-w-0">
            <h2 id={`${step}-title`} className="text-[15px] font-semibold text-ink">
              {title}
              {state === "optional" && <span className="ml-2 text-xs font-normal text-muted">optional</span>}
            </h2>
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className={bodyClassName ?? "p-5"}>{children}</div>}
    </section>
  );
}
