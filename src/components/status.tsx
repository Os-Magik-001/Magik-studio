import { Badge, cx } from "@/components/ui";
import {
  SCRIPT_STATUS_LABEL,
  VERSION_STATUS_LABEL,
  VIDEO_STATUSES,
  videoStatusIndex,
  videoStatusLabel,
  type ScriptStatus,
  type VersionStatus,
  type VideoStatus,
} from "@/lib/workflow";

const videoTone: Record<VideoStatus, "neutral" | "accent" | "success" | "warning"> = {
  script: "neutral",
  shoot: "neutral",
  footage_in: "neutral",
  editing: "accent",
  editor_check: "warning",
  client_review: "accent",
  approved: "success",
  delivered: "success",
};

export function VideoStatusBadge({ status }: { status: VideoStatus }) {
  return <Badge tone={videoTone[status]}>{videoStatusLabel(status)}</Badge>;
}

export function ScriptStatusBadge({ status }: { status: ScriptStatus }) {
  const tone = status === "approved" ? "success" : status === "changes_requested" ? "danger" : status === "client_review" ? "accent" : "neutral";
  return <Badge tone={tone}>{SCRIPT_STATUS_LABEL[status]}</Badge>;
}

export function VersionStatusBadge({ status }: { status: VersionStatus }) {
  const tone =
    status === "approved"
      ? "success"
      : status === "changes_requested" || status === "fixes_requested"
        ? "danger"
        : status === "client_review"
          ? "accent"
          : "warning";
  return <Badge tone={tone}>{VERSION_STATUS_LABEL[status]}</Badge>;
}

export function StatusStepper({ status }: { status: VideoStatus }) {
  const current = videoStatusIndex(status);
  return (
    <ol className="flex w-full gap-1 overflow-x-auto" aria-label="Video progress">
      {VIDEO_STATUSES.map((s, i) => (
        <li key={s.value} className="min-w-[88px] flex-1" aria-current={i === current ? "step" : undefined}>
          <div
            className={cx(
              "h-1.5 rounded-full",
              i < current ? "bg-success" : i === current ? "bg-accent" : "bg-surface-2",
            )}
          />
          <div className={cx("mt-1.5 text-xs", i === current ? "font-medium text-ink" : "text-muted")}>
            {s.label}
          </div>
        </li>
      ))}
    </ol>
  );
}
