import { ExternalLink, RotateCw, Trash2 } from "lucide-react";
import { asReferenceBreakdown, asReferenceStats } from "@/lib/agent-types";
import { focusLabel, PLATFORM_LABEL, type ReferencePlatform } from "@/lib/reference-links";
import { Badge, cx } from "@/components/ui";
import { removeReference, retryReference } from "@/app/actions/references";

export type ReferenceItem = {
  id: string;
  video_id: string | null;
  url: string;
  platform: string;
  focus: string[];
  note: string | null;
  status: "queued" | "running" | "done" | "failed";
  progress: string | null;
  error: string | null;
  watched: boolean;
  title: string | null;
  owner: string | null;
  duration: number | null;
  stats: unknown;
  analysis: unknown;
  sheets: string[];
};

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));

// The studio's references with what the engine made of each. `scoped` marks the ones that
// belong to the whole client (on a video's page).
export function ReferenceList({ items, sheetUrls, scoped = false }: { items: ReferenceItem[]; sheetUrls: Map<string, string>; scoped?: boolean }) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((r) => {
        const b = asReferenceBreakdown(r.analysis);
        const s = asReferenceStats(r.stats);
        const sheet = r.sheets[0] ? sheetUrls.get(r.sheets[0]) : undefined;
        const facts = [
          r.duration && `${r.duration} s`,
          s?.cutsPerSecond != null && `${s.cutsPerSecond} cuts/s`,
          s?.medianShot != null && `shots ~${s.medianShot} s`,
          s?.wordsPerMinute != null && `${s.wordsPerMinute} wpm`,
          s?.bpm && `${s.bpm} BPM`,
          s?.plays && `${compact(s.plays)} plays`,
        ].filter(Boolean);
        return (
          <li key={r.id} className="flex gap-3 rounded-2xl border border-line bg-black/20 p-3">
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="relative block h-[76px] w-[58px] shrink-0 overflow-hidden rounded-xl bg-surface-2 @min-[40rem]:h-[104px] @min-[40rem]:w-[78px]"
              aria-label={`Open the reference on ${PLATFORM_LABEL[r.platform as ReferencePlatform] ?? "its site"}`}
            >
              {sheet ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sheet} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-[11px] font-medium text-muted">{PLATFORM_LABEL[r.platform as ReferencePlatform] ?? "Link"}</span>
              )}
              {(r.status === "queued" || r.status === "running") && <span className="absolute inset-x-0 bottom-0 h-0.5 animate-pulse bg-accent" aria-hidden />}
            </a>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{PLATFORM_LABEL[r.platform as ReferencePlatform] ?? "Link"}</Badge>
                <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 text-[13px] font-medium text-ink hover:text-accent">
                  <span className="truncate">{[r.owner, r.title].filter(Boolean).join(" · ") || r.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                  <ExternalLink size={12} className="shrink-0" aria-hidden />
                </a>
                {scoped && !r.video_id && <Badge tone="accent">All videos</Badge>}
              </div>
              <Status r={r} watchedFacts={facts as string[]} />
              {(r.focus.length > 0 || r.note) && (
                <p className="text-xs text-ink-2">
                  {r.focus.length > 0 && <span className="text-muted">Take: {r.focus.map(focusLabel).join(", ")}. </span>}
                  {r.note}
                </p>
              )}
              {b && (
                <details className="group text-[13px]">
                  <summary className="cursor-pointer text-xs font-medium text-accent">What the agents take from it</summary>
                  <div className="mt-2 flex flex-col gap-2 text-ink-2">
                    <p>{b.summary}</p>
                    <p>
                      <span className="text-muted">Hook: </span>
                      {b.hook}
                    </p>
                    {b.borrow.length > 0 && (
                      <ul className="list-disc space-y-0.5 pl-5">
                        {b.borrow.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    )}
                    {b.avoid.length > 0 && <p className="text-xs text-muted">Not copied: {b.avoid.join(" · ")}</p>}
                  </div>
                </details>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <form action={removeReference}>
                <input type="hidden" name="referenceId" value={r.id} />
                <button aria-label="Remove this reference" className="p-1 text-muted hover:text-danger">
                  <Trash2 size={14} />
                </button>
              </form>
              {r.status === "failed" && (
                <form action={retryReference}>
                  <input type="hidden" name="referenceId" value={r.id} />
                  <button aria-label="Try this reference again" className="p-1 text-muted hover:text-accent">
                    <RotateCw size={14} />
                  </button>
                </form>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Status({ r, watchedFacts }: { r: ReferenceItem; watchedFacts: string[] }) {
  const line = "flex flex-wrap items-center gap-x-2 text-xs";
  if (r.status === "queued") return <p className={cx(line, "text-muted")}>Waiting for the engine to watch it</p>;
  if (r.status === "running")
    return (
      <p className={cx(line, "text-accent")}>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden />
        {r.progress ?? "Watching it"}…
      </p>
    );
  if (r.status === "failed") return <p className={cx(line, "text-danger")}>{r.error ?? "The engine couldn't open it."}</p>;
  if (!r.watched && !asReferenceBreakdown(r.analysis)) return <p className={cx(line, "text-muted")}>{r.error ?? "Link only: the agents use the title and your note."}</p>;
  return (
    <p className={cx(line, "text-success")}>
      {r.watched ? "Watched" : "Looked at"}
      {watchedFacts.map((f) => (
        <span key={f} className="text-muted">
          · {f}
        </span>
      ))}
    </p>
  );
}
