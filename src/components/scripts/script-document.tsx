import type { ReactNode } from "react";
import { Clapperboard, Eye, Mic, Type } from "lucide-react";
import type { ScriptBeat, ShootPlan } from "@/lib/agent-types";
import { speakerLines } from "@/lib/script-view";
import { ShootPlanView } from "@/components/agents/views";

// A script as everyone reads it (the studio, the editor, the videographer and the client): the
// beats, numbered, with what we see, who says what and the words on screen. A script without
// beats (written or pasted by hand) reads as it was written. Its PDF: ./pdf-link.

function Beat({ beat, n }: { beat: ScriptBeat; n: number }) {
  const lines = speakerLines(beat.voice);
  return (
    <li className="grid grid-cols-[44px_1fr] gap-x-4 border-t border-white/[0.07] py-4 first:border-t-0 first:pt-1 sm:grid-cols-[56px_1fr]">
      <div className="flex flex-col items-start gap-1 pt-0.5">
        <span className="font-mono text-[22px] leading-none font-semibold text-accent tabular-nums">{String(n).padStart(2, "0")}</span>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-[15px] font-semibold text-ink">{beat.title || `Beat ${n}`}</h3>
          {beat.time && <span className="rounded-full bg-white/8 px-2 py-0.5 font-mono text-[11.5px] text-ink-2 tabular-nums">{beat.time}</span>}
        </div>
        <dl className="mt-2.5 flex flex-col gap-2.5 text-[14px] leading-relaxed">
          {beat.visual && (
            <div className="flex gap-2.5">
              <dt className="mt-[3px] shrink-0 text-muted" title="What we see">
                <Eye size={15} aria-label="What we see" />
              </dt>
              <dd className="whitespace-pre-wrap text-ink-2">{beat.visual}</dd>
            </div>
          )}
          {lines.length > 0 && (
            <div className="flex gap-2.5">
              <dt className="mt-[3px] shrink-0 text-muted" title="What's said">
                <Mic size={15} aria-label="What's said" />
              </dt>
              <dd className="flex flex-col gap-1 text-ink">
                {lines.map((l, i) => (
                  <p key={i}>
                    {l.who && <span className="mr-1.5 text-[12px] font-semibold tracking-wide text-accent uppercase">{l.who}</span>}
                    <span className="font-medium">{l.line}</span>
                  </p>
                ))}
              </dd>
            </div>
          )}
          {beat.on_screen && (
            <div className="flex gap-2.5">
              <dt className="mt-[3px] shrink-0 text-muted" title="On screen">
                <Type size={15} aria-label="On screen" />
              </dt>
              <dd>
                <span className="inline-block rounded-md bg-white px-2 py-0.5 text-[13px] font-semibold text-black shadow-[0_2px_10px_rgba(0,0,0,0.4)]">{beat.on_screen}</span>
              </dd>
            </div>
          )}
        </dl>
      </div>
    </li>
  );
}

export function ScriptDocument({
  beats,
  body,
  plan,
  shots,
  showPlan = false,
  actions,
  footer,
}: {
  beats: ScriptBeat[];
  body: string;
  plan?: ShootPlan | null;
  shots?: string[];
  // The videographer's shoot plan (scenes, B-roll, props) under the script.
  showPlan?: boolean;
  actions?: ReactNode;
  footer?: ReactNode;
}) {
  const seconds = plan?.length_seconds ? Math.round(plan.length_seconds) : null;
  return (
    <article className="flex flex-col gap-5">
      {(plan?.concept || seconds || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 basis-72">
            {plan?.concept && <p className="font-serif text-[19px] leading-snug text-ink italic">{plan.concept}</p>}
            <p className="mt-1.5 text-[12.5px] text-muted">
              {[beats.length ? `${beats.length} beats` : null, seconds ? `about ${seconds} seconds` : null, shots?.length ? `${shots.length} shots` : null].filter(Boolean).join(" · ")}
            </p>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {beats.length ? (
        <ol className="rounded-[16px] border border-white/[0.07] bg-white/[0.025] px-4 py-2 sm:px-5">
          {beats.map((b, i) => (
            <Beat key={i} beat={b} n={i + 1} />
          ))}
        </ol>
      ) : (
        <div className="rounded-[16px] border border-white/[0.07] bg-white/[0.025] px-5 py-4 text-[14.5px] leading-relaxed whitespace-pre-wrap text-ink">{body}</div>
      )}
      {shots && shots.length > 0 && (
        <section>
          <h3 className="kicker mb-2 flex items-center gap-1.5">
            <Clapperboard size={13} aria-hidden /> What we&apos;ll film
          </h3>
          <ol className="grid list-decimal gap-x-8 gap-y-1 pl-5 text-[13.5px] text-ink-2 sm:grid-cols-2">
            {shots.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </section>
      )}
      {showPlan && plan && plan.scenes.length > 0 && (
        <details className="rounded-xl border border-line p-4">
          <summary className="cursor-pointer text-sm font-medium text-ink">Shoot plan: {plan.scenes.length} scenes, B-roll, props and wardrobe</summary>
          <div className="mt-4">
            <ShootPlanView plan={plan} />
          </div>
        </details>
      )}
      {footer}
    </article>
  );
}
