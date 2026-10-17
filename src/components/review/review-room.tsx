"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { Columns2, MessageSquareReply, Pause, PenLine, Play, Trash2, X } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Button, Card, Textarea, cx } from "@/components/ui";
import { VersionStatusBadge } from "@/components/status";
import { addComment, decideVersion, requestFixes, sendVersionToClient, setCommentResolved } from "@/app/actions/workflow";
import { formatTimecode, type VersionStatus } from "@/lib/workflow";

type Point = [number, number];
type Stroke = Point[];

export type ReviewVersion = {
  id: string;
  number: number;
  status: VersionStatus;
  url: string | null;
  notes: string | null;
  createdAt: string;
};

export type ReviewComment = {
  id: string;
  body: string;
  timecodeMs: number | null;
  drawing: { strokes: Stroke[] } | null;
  resolved: boolean;
  internal: boolean;
  createdAt: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorIsClient: boolean;
};

type Props = {
  videoId: string;
  versions: ReviewVersion[];
  selectedId: string;
  comments: ReviewComment[];
  viewerId: string;
  aspect: string;
  permissions: { canDecide: boolean; canDraftCheck: boolean; canResolve: boolean; isClient: boolean };
  revisions: { used: number; included: number };
};

const INK = "#ff4d4f";

export function ReviewRoom(props: Props) {
  const { videoId, versions, selectedId, comments, permissions, revisions } = props;
  const router = useRouter();
  const version = versions.find((v) => v.id === selectedId)!;
  const others = versions.filter((v) => v.id !== selectedId && v.url);

  const mainRef = useRef<HTMLVideoElement>(null);
  const compareRef = useRef<HTMLVideoElement>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const compare = versions.find((v) => v.id === compareId) ?? null;

  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);

  const [drawMode, setDrawMode] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [body, setBody] = useState("");
  const [pinToTime, setPinToTime] = useState(true);
  const [replyTo, setReplyTo] = useState<ReviewComment | null>(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const [aw, ah] = props.aspect.split(":").map(Number) as [number, number];

  const videos = () => [mainRef.current, compare ? compareRef.current : null].filter(Boolean) as HTMLVideoElement[];

  const togglePlay = useCallback(() => {
    const main = mainRef.current;
    if (!main) return;
    const all = [main, compareRef.current].filter(Boolean) as HTMLVideoElement[];
    if (main.paused) {
      setDrawMode(false);
      // Keep the comparison in lockstep with the version under review.
      if (compareRef.current) compareRef.current.currentTime = main.currentTime;
      all.forEach((v) => void v.play());
    } else {
      all.forEach((v) => v.pause());
    }
  }, [setDrawMode]);

  const seek = (seconds: number) => {
    videos().forEach((v) => {
      v.currentTime = Math.max(0, Math.min(seconds, v.duration || seconds));
      v.pause();
    });
    setTime(seconds);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]")) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  const topLevel = useMemo(
    () =>
      comments
        .filter((c) => !c.parentId)
        .sort((a, b) => (a.timecodeMs ?? -1) - (b.timecodeMs ?? -1) || a.createdAt.localeCompare(b.createdAt)),
    [comments],
  );
  const replies = (id: string) => comments.filter((c) => c.parentId === id);
  const active = comments.find((c) => c.id === activeId) ?? null;

  const shownStrokes: Stroke[] = drawMode || strokes.length
    ? strokes
    : active?.drawing && active.timecodeMs !== null && Math.abs(time * 1000 - active.timecodeMs) < 750
      ? active.drawing.strokes
      : [];

  async function post() {
    if (!body.trim()) return;
    setPosting(true);
    setPostError(null);
    const res = await addComment({
      versionId: version.id,
      body,
      timecodeMs: replyTo ? null : pinToTime ? Math.round(time * 1000) : null,
      drawing: !replyTo && strokes.length ? { strokes } : null,
      parentId: replyTo?.id ?? null,
    });
    setPosting(false);
    if (res.error) {
      setPostError(res.error);
      return;
    }
    setBody("");
    setStrokes([]);
    setDrawMode(false);
    setReplyTo(null);
    router.refresh();
  }

  const openCount = topLevel.filter((c) => !c.resolved).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-3">
        {/* Version stack */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="glass flex gap-1 rounded-full p-1" role="tablist" aria-label="Versions">
            {versions.map((v) => (
              <button
                key={v.id}
                role="tab"
                aria-selected={v.id === selectedId}
                onClick={() => router.push(`/review/${videoId}?v=${v.id}`)}
                className={cx(
                  "h-8 rounded-full px-3.5 font-mono text-[13px] transition-colors",
                  v.id === selectedId
                    ? "bg-white/15 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
                    : "text-muted hover:text-ink",
                )}
              >
                v{v.number}
              </button>
            ))}
          </div>
          <VersionStatusBadge status={version.status} />
          {others.length > 0 && (
            <label className="ml-auto flex items-center gap-2 text-[13px] text-ink-2">
              <Columns2 size={14} aria-hidden />
              <span className="sr-only sm:not-sr-only">Compare with</span>
              <select
                value={compareId ?? ""}
                onChange={(e) => {
                  setCompareId(e.target.value || null);
                  mainRef.current?.pause();
                }}
                className="glass h-9 rounded-full px-3 text-[13px]"
              >
                <option value="">Off</option>
                {others.map((o) => (
                  <option key={o.id} value={o.id}>
                    v{o.number}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {/* Stage */}
        <div className="frost rounded-[26px] p-3 sm:p-4">
          <div className={cx("grid gap-3", compare && "sm:grid-cols-2")}>
            <Stage
              label={compare ? `v${version.number}` : undefined}
              url={version.url}
              aspect={[aw, ah]}
              compact={!!compare}
              videoRef={mainRef}
              onTime={setTime}
              onDuration={setDuration}
              onPlaying={setPlaying}
              strokes={shownStrokes}
              drawMode={drawMode}
              onStroke={(s) => setStrokes((xs) => [...xs, s])}
            />
            {compare && (
              <Stage
                label={`v${compare.number}`}
                url={compare.url}
                aspect={[aw, ah]}
                compact
                videoRef={compareRef}
                muted
                strokes={[]}
                drawMode={false}
              />
            )}
          </div>

          {/* Controls */}
          <div className="glass mt-3 flex items-center gap-3 rounded-full py-1.5 pr-1.5 pl-1.5 text-stage-ink">
            <button
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            >
              {playing ? <Pause size={16} /> : <Play size={16} className="translate-x-px" />}
            </button>
            <span className="shrink-0 whitespace-nowrap font-mono text-xs tabular-nums text-stage-muted">
              {formatTimecode(time * 1000)} / {formatTimecode(duration * 1000)}
            </span>
            <Timeline
              time={time}
              duration={duration}
              markers={topLevel.filter((c) => c.timecodeMs !== null)}
              activeId={activeId}
              onSeek={seek}
              onMarker={(c) => {
                setActiveId(c.id);
                seek(c.timecodeMs! / 1000);
              }}
            />
            <button
              onClick={() => {
                mainRef.current?.pause();
                compareRef.current?.pause();
                setDrawMode((d) => !d);
              }}
              aria-pressed={drawMode}
              aria-label="Draw on the frame"
              title="Draw on the frame"
              className={cx(
                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                drawMode ? "bg-[#ff4d4f] text-white" : "bg-white/10 hover:bg-white/20",
              )}
            >
              <PenLine size={16} />
            </button>
          </div>
          {(drawMode || strokes.length > 0) && (
            <div className="mt-2 flex items-center gap-3 text-xs text-stage-muted">
              <span>
                {drawMode ? "Circle or point at what to change, then write your comment." : "Drawing attached to your comment."}
              </span>
              {strokes.length > 0 && (
                <button onClick={() => setStrokes([])} className="inline-flex items-center gap-1 text-stage-ink hover:underline">
                  <Trash2 size={12} /> Clear
                </button>
              )}
            </div>
          )}
        </div>
        {version.notes && !permissions.isClient && (
          <p className="text-[13px] text-muted">Version notes: {version.notes}</p>
        )}
      </div>

      {/* Side panel */}
      <div className="flex flex-col gap-4">
        {permissions.canDecide && <DecisionPanel versionId={version.id} revisions={revisions} openCount={openCount} />}
        {permissions.isClient && version.status === "changes_requested" && (
          <Card className="p-4">
            <h2 className="font-serif text-xl text-ink">Changes requested</h2>
            <p className="mt-1 text-[13px] text-muted">
              You asked for changes on v{version.number}. We&apos;ll let you know as soon as the next version is ready.
            </p>
          </Card>
        )}
        {permissions.isClient && version.status === "approved" && (
          <Card className="p-4">
            <h2 className="font-serif text-xl text-ink">Approved</h2>
            <p className="mt-1 text-[13px] text-muted">You approved v{version.number}. Thank you!</p>
          </Card>
        )}
        {permissions.canDraftCheck && <DraftCheckPanel versionId={version.id} openCount={openCount} />}

        <Card>
          <div className="border-b border-line p-4">
            {replyTo && (
              <div className="mb-2 flex items-center gap-2 text-xs text-muted">
                <MessageSquareReply size={12} aria-hidden />
                Replying to {replyTo.authorName}
                <button onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="ml-auto hover:text-ink">
                  <X size={12} />
                </button>
              </div>
            )}
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onFocus={() => mainRef.current?.pause()}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void post();
              }}
              rows={3}
              placeholder={replyTo ? "Write a reply…" : "Pause on the moment and say what to change…"}
              aria-label="Comment"
            />
            <div className="mt-2 flex items-center gap-2">
              {!replyTo && (
                <label className="flex items-center gap-1.5 text-xs text-ink-2">
                  <input type="checkbox" checked={pinToTime} onChange={(e) => setPinToTime(e.target.checked)} />
                  at <span className="font-mono">{formatTimecode(time * 1000)}</span>
                </label>
              )}
              {strokes.length > 0 && !replyTo && <Badge tone="danger">+ drawing</Badge>}
              <Button size="sm" variant="primary" className="ml-auto" disabled={posting || !body.trim()} onClick={() => void post()}>
                {posting ? "Posting…" : "Comment"}
              </Button>
            </div>
            {postError && <p className="mt-2 text-[13px] text-danger">{postError}</p>}
          </div>

          <div className="flex items-center justify-between px-4 pt-3 text-[13px]">
            <span className="font-medium text-ink">Comments</span>
            <span className="text-muted">{openCount} open</span>
          </div>
          {topLevel.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-muted">No comments on v{version.number} yet.</p>
          ) : (
            <ul className="flex max-h-[60vh] flex-col overflow-y-auto p-2">
              {topLevel.map((c) => (
                <li key={c.id}>
                  <CommentItem
                    comment={c}
                    active={c.id === activeId}
                    canResolve={permissions.canResolve}
                    onSelect={() => {
                      setActiveId(c.id);
                      if (c.timecodeMs !== null) seek(c.timecodeMs / 1000);
                    }}
                    onReply={() => setReplyTo(c)}
                  />
                  {replies(c.id).map((r) => (
                    <div key={r.id} className="ml-6 border-l border-line pl-3">
                      <CommentItem comment={r} active={false} canResolve={false} onSelect={() => {}} />
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stage({
  label,
  url,
  aspect,
  compact,
  videoRef,
  muted,
  onTime,
  onDuration,
  onPlaying,
  strokes,
  drawMode,
  onStroke,
}: {
  label?: string;
  url: string | null;
  aspect: [number, number];
  compact: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  muted?: boolean;
  onTime?: (t: number) => void;
  onDuration?: (d: number) => void;
  onPlaying?: (p: boolean) => void;
  strokes: Stroke[];
  drawMode: boolean;
  onStroke?: (s: Stroke) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<[number, number]>(aspect);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const drawing = useRef<Stroke | null>(null);
  const [live, setLive] = useState<Stroke | null>(null);

  // Fit the video's real frame into the stage so drawings line up with the picture.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      const cw = el.clientWidth;
      const maxH = Math.min(window.innerHeight * (compact ? 0.55 : 0.68), 720);
      const scale = Math.min(cw / natural[0], maxH / natural[1]);
      setBox({ w: Math.floor(natural[0] * scale), h: Math.floor(natural[1] * scale) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [natural, compact]);

  const point = (e: ReactPointerEvent<SVGSVGElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    ];
  };

  const all = live ? [...strokes, live] : strokes;

  return (
    <div ref={wrapRef} className="flex flex-col items-center gap-1.5">
      {label && <span className="self-start font-mono text-xs text-stage-muted">{label}</span>}
      <div className="relative bg-black" style={box ? { width: box.w, height: box.h } : { width: "100%", aspectRatio: `${aspect[0]} / ${aspect[1]}` }}>
        {url ? (
          <video
            ref={videoRef}
            // The media fragment makes Safari decode and paint the first frame
            // instead of a black box until playback starts.
            src={url.includes("#") ? url : `${url}#t=0.001`}
            playsInline
            preload="auto"
            muted={muted}
            className="h-full w-full"
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (v.videoWidth && v.videoHeight) setNatural([v.videoWidth, v.videoHeight]);
              onDuration?.(v.duration);
            }}
            onTimeUpdate={(e) => onTime?.(e.currentTarget.currentTime)}
            onSeeked={(e) => onTime?.(e.currentTarget.currentTime)}
            onPlay={() => onPlaying?.(true)}
            onPause={() => onPlaying?.(false)}
            onEnded={() => onPlaying?.(false)}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-stage-muted">
            This version&apos;s file couldn&apos;t be loaded.
          </div>
        )}
        <svg
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          className={cx("absolute inset-0 h-full w-full", drawMode ? "cursor-crosshair touch-none" : "pointer-events-none")}
          onPointerDown={(e) => {
            if (!drawMode) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = [point(e)];
            setLive(drawing.current);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            drawing.current = [...drawing.current, point(e)];
            setLive(drawing.current);
          }}
          onPointerUp={() => {
            if (drawing.current && drawing.current.length > 1) onStroke?.(drawing.current);
            drawing.current = null;
            setLive(null);
          }}
        >
          {all.map((s, i) => (
            <polyline
              key={i}
              points={s.map((p) => p.join(",")).join(" ")}
              fill="none"
              stroke={INK}
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {drawMode && <div className="pointer-events-none absolute inset-0 ring-2 ring-[#ff4d4f] ring-inset" />}
      </div>
    </div>
  );
}

function Timeline({
  time,
  duration,
  markers,
  activeId,
  onSeek,
  onMarker,
}: {
  time: number;
  duration: number;
  markers: ReviewComment[];
  activeId: string | null;
  onSeek: (s: number) => void;
  onMarker: (c: ReviewComment) => void;
}) {
  const pct = (s: number) => (duration ? Math.min(100, (s / duration) * 100) : 0);
  return (
    <div className="relative h-9 min-w-0 flex-1">
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.04}
        value={time}
        onChange={(e) => onSeek(Number(e.target.value))}
        aria-label="Seek"
        className="absolute inset-x-0 top-1/2 h-9 w-full -translate-y-1/2 cursor-pointer opacity-0"
      />
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/15">
        <div className="h-full rounded-full bg-white/70" style={{ width: `${pct(time)}%` }} />
      </div>
      {markers.map((c) => (
        <button
          key={c.id}
          onClick={() => onMarker(c)}
          title={`${formatTimecode(c.timecodeMs!)} · ${c.authorName}: ${c.body}`}
          aria-label={`Comment at ${formatTimecode(c.timecodeMs!)}`}
          className={cx(
            "absolute top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full ring-2 ring-stage",
            c.resolved ? "bg-stage-muted" : c.authorIsClient ? "bg-[#ff4d4f]" : "bg-accent",
            c.id === activeId && "scale-150",
          )}
          style={{ left: `${pct(c.timecodeMs! / 1000)}%` }}
        />
      ))}
    </div>
  );
}

function CommentItem({
  comment: c,
  active,
  canResolve,
  onSelect,
  onReply,
}: {
  comment: ReviewComment;
  active: boolean;
  canResolve: boolean;
  onSelect: () => void;
  onReply?: () => void;
}) {
  return (
    <div className={cx("rounded-xl p-2.5", active && "bg-surface-2", c.resolved && "opacity-60")}>
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium text-ink">{c.authorName}</span>
        {c.authorIsClient && <Badge tone="danger">Client</Badge>}
        {c.internal && <Badge>Internal</Badge>}
        {c.timecodeMs !== null && (
          <button onClick={onSelect} className="font-mono text-accent hover:underline">
            {formatTimecode(c.timecodeMs)}
          </button>
        )}
        {c.drawing && (
          <button onClick={onSelect} title="Has a drawing" className="text-[#ff4d4f]">
            <PenLine size={12} />
          </button>
        )}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-[13px] text-ink-2">{c.body}</p>
      <div className="mt-1.5 flex gap-3 text-xs text-muted">
        {onReply && (
          <button onClick={onReply} className="hover:text-ink">
            Reply
          </button>
        )}
        {canResolve && (
          <form action={setCommentResolved}>
            <input type="hidden" name="commentId" value={c.id} />
            <input type="hidden" name="resolved" value={c.resolved ? "0" : "1"} />
            <button className="hover:text-ink">{c.resolved ? "Reopen" : "Resolve"}</button>
          </form>
        )}
        {!canResolve && c.resolved && <span>Resolved</span>}
      </div>
    </div>
  );
}

function DecisionPanel({
  versionId,
  revisions,
  openCount,
}: {
  versionId: string;
  revisions: { used: number; included: number };
  openCount: number;
}) {
  const [asking, setAsking] = useState(false);
  const nextRound = revisions.used + 1;
  const extra = nextRound > revisions.included;
  return (
    <Card className="p-4">
      <h2 className="font-serif text-xl text-ink">Your decision</h2>
      <p className="mt-1 text-[13px] text-muted">Approve this version, or send your comments back for changes.</p>
      {asking ? (
        <ActionForm action={decideVersion} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="versionId" value={versionId} />
          <input type="hidden" name="decision" value="changes" />
          <p className="text-[13px] text-ink-2">
            {openCount > 0
              ? `Your ${openCount} open comment${openCount === 1 ? "" : "s"} will be sent with this request.`
              : "Add a comment on the moment you want changed, or describe it here."}
          </p>
          <Textarea name="note" rows={3} placeholder="Anything else? (optional)" />
          {extra && (
            <p className="rounded-xl bg-warning-soft px-3 py-2 text-[13px] text-warning">
              This would be change round {nextRound}. Your plan includes {revisions.included}, so this round may be billed as extra work.
            </p>
          )}
          <div className="flex gap-2">
            <SubmitButton pendingText="Sending…">Send changes</SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setAsking(false)}>
              Cancel
            </Button>
          </div>
        </ActionForm>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <ActionForm action={decideVersion}>
            <input type="hidden" name="versionId" value={versionId} />
            <input type="hidden" name="decision" value="approve" />
            <SubmitButton variant="success" pendingText="Approving…">
              Approve
            </SubmitButton>
          </ActionForm>
          <Button variant="secondary" onClick={() => setAsking(true)}>
            Request changes
          </Button>
        </div>
      )}
    </Card>
  );
}

function DraftCheckPanel({ versionId, openCount }: { versionId: string; openCount: number }) {
  const [fixing, setFixing] = useState(false);
  return (
    <Card className="p-4">
      <h2 className="font-serif text-xl text-ink">Draft check</h2>
      <p className="mt-1 text-[13px] text-muted">
        The client won&apos;t see this until you send it. Send it back to Claude in plain words if it isn&apos;t right.
      </p>
      {fixing ? (
        <ActionForm action={requestFixes} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="versionId" value={versionId} />
          <Textarea name="instructions" rows={3} required autoFocus placeholder="Tighten the intro, and use the brand's end card." />
          {openCount > 0 && (
            <p className="text-xs text-muted">Your {openCount} open timecoded comments are included automatically.</p>
          )}
          <div className="flex gap-2">
            <SubmitButton pendingText="Sending…">Ask Claude for fixes</SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setFixing(false)}>
              Cancel
            </Button>
          </div>
        </ActionForm>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <ActionForm action={sendVersionToClient}>
            <input type="hidden" name="versionId" value={versionId} />
            <SubmitButton pendingText="Sending…">Send to client</SubmitButton>
          </ActionForm>
          <Button variant="secondary" onClick={() => setFixing(true)}>
            Request fixes
          </Button>
        </div>
      )}
    </Card>
  );
}
