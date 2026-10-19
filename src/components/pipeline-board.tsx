import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarClock, Clapperboard, Link2 } from "lucide-react";
import { FORMAT_LABEL, videoStatusLabel, type VideoFormat, type VideoStatus } from "@/lib/workflow";
import { WHO, type NextStep, type Who } from "@/lib/pipeline";
import { formatCalendarDate } from "@/lib/dates";
import { Avatar, cx } from "@/components/ui";
import { WhoDot } from "@/components/pipeline";

// The Pipeline board's pieces: a video's card, the counts that filter the board, and the chips.

export type BoardCardData = {
  id: string;
  title: string;
  status: VideoStatus;
  format: VideoFormat;
  due: string | null;
  updated: string;
  client: { id: string; name: string } | null;
  editor: string | null;
  editorId: string | null;
  next: NextStep;
  overdue: boolean;
  soon: boolean;
  references: number;
  version: number | null;
};

export function Stat({ href, active, label, value, who, danger }: { href: string; active: boolean; label: string; value: number; who?: Who; danger?: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "frost flex flex-col gap-1 rounded-2xl px-4 py-3 transition-colors hover:border-line-strong",
        active && "border-accent/50 bg-accent-soft",
      )}
    >
      <span className="flex items-center gap-1.5 text-[11px] text-muted">
        {who && <WhoDot who={who} />}
        {label}
      </span>
      <span className={cx("text-2xl font-semibold tabular-nums", danger ? "text-danger" : "text-ink")}>{value}</span>
    </Link>
  );
}

export function Chip({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cx("rounded-full px-3 py-1 text-[13px] transition-colors", active ? "bg-accent text-accent-ink" : "bg-white/8 text-ink-2 hover:text-ink")}>
      {children}
    </Link>
  );
}

export function Due({ card }: { card: BoardCardData }) {
  if (!card.due) return <span className="text-xs text-muted">No date</span>;
  return (
    <span className={cx("inline-flex items-center gap-1 text-xs", card.overdue ? "font-medium text-danger" : card.soon ? "text-warning" : "text-muted")}>
      <CalendarClock size={12} aria-hidden />
      {formatCalendarDate(card.due)}
      {card.overdue && <span className="sr-only"> (overdue)</span>}
    </span>
  );
}

export function BoardCard({ card: c }: { card: BoardCardData }) {
  return (
    <Link
      href={`/videos/${c.id}`}
      className={cx("frost flex flex-col gap-2 rounded-xl p-3 transition-colors hover:border-line-strong", c.overdue && "border-danger/40", c.next.who === "engine" && "border-warning/35")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs text-muted">{c.client?.name}</div>
          <div className="text-sm leading-snug font-medium text-ink">{c.title}</div>
        </div>
        {c.editor && (
          <span title={`Editor: ${c.editor}`} className="shrink-0">
            <Avatar name={c.editor} size={22} />
          </span>
        )}
      </div>
      <div className={cx("flex items-start gap-2 rounded-lg px-2 py-1.5 text-[12.5px] leading-snug", c.next.who === "studio" ? "bg-accent-soft text-ink" : "bg-white/[0.04] text-ink-2")}>
        <WhoDot who={c.next.who} className="mt-1" />
        <span className="min-w-0">
          <span className="line-clamp-2">{c.next.label}</span>
          <span className="block text-[11px] text-muted">{c.next.who === "done" ? "" : WHO[c.next.who].label}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        <span className="rounded-full bg-white/8 px-2 py-0.5 text-ink-2">{videoStatusLabel(c.status)}</span>
        <span className="inline-flex items-center gap-1">
          <Clapperboard size={11} aria-hidden />
          {FORMAT_LABEL[c.format]}
        </span>
        {c.version && <span>v{c.version}</span>}
        {c.references > 0 && (
          <span className="inline-flex items-center gap-1" title={`${c.references} reference${c.references > 1 ? "s" : ""} for the agents`}>
            <Link2 size={11} aria-hidden />
            {c.references}
          </span>
        )}
        <span className="ml-auto">
          <Due card={c} />
        </span>
      </div>
    </Link>
  );
}
