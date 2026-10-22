"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Clapperboard, Download, Play, X } from "lucide-react";
import type { ClientVideo } from "@/lib/client-videos";
import { FORMAT_LABEL } from "@/lib/workflow";
import { cx } from "@/components/ui";

// "Your videos" as a wall of frames: each video's latest cut as a vertical thumbnail, its length,
// its name, a download and its status, like files in Finder's gallery. Hover plays it silently;
// tick several to download them together.

const TONE: Record<string, string> = {
  review: "bg-accent text-black",
  script: "bg-accent text-black",
  approved: "bg-success-soft text-success",
  posted: "bg-success-soft text-success",
  edit: "bg-white/10 text-ink-2",
  shoot: "bg-white/10 text-ink-2",
};

const statusLabel = (v: ClientVideo) =>
  v.needsYou === "cut" ? "To review" : v.needsYou === "script" ? "Script to approve" : v.stage === "posted" ? "Delivered" : v.stage === "approved" ? "Approved" : v.stage === "review" ? "In review" : "In production";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function VideoGallery({ videos, client }: { videos: ClientVideo[]; client: string | null }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const downloadable = videos.filter((v) => picked.has(v.id) && v.download);

  const downloadAll = () => {
    // One after the other: browsers allow several downloads from one click, spaced out.
    downloadable.forEach((v, i) =>
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = v.download!;
        a.rel = "noreferrer";
        a.setAttribute("download", "");
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 700),
    );
  };

  return (
    <>
      {picked.size > 0 && (
        <div className="glass sticky top-2 z-10 mb-4 flex items-center gap-3 rounded-full py-1.5 pr-1.5 pl-4">
          <span className="text-[13px] font-medium text-ink">{picked.size} selected</span>
          <button type="button" onClick={() => setPicked(new Set())} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] text-muted hover:bg-white/10 hover:text-ink">
            <X size={13} aria-hidden /> Clear
          </button>
          <button
            type="button"
            onClick={downloadAll}
            disabled={!downloadable.length}
            className="glass-tint ml-auto flex h-8 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold disabled:opacity-40"
          >
            <Download size={14} aria-hidden /> Download {downloadable.length || ""}
          </button>
        </div>
      )}
      <ul className="grid grid-cols-2 gap-4 @min-[38rem]:grid-cols-3 @min-[54rem]:grid-cols-4 @min-[70rem]:grid-cols-5 @min-[86rem]:grid-cols-6">
        {videos.map((v) => (
          <VideoCard key={v.id} v={v} client={client} picked={picked.has(v.id)} onPick={() => toggle(v.id)} />
        ))}
      </ul>
    </>
  );
}

function VideoCard({ v, client, picked, onPick }: { v: ClientVideo; client: string | null; picked: boolean; onPick: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const href = `/review/${v.id}${v.needsYou === "cut" && v.version ? `?v=${v.version.id}` : ""}`;

  // Load the frame only when the card comes into view.
  useEffect(() => {
    const el = box.current;
    if (!el || !v.preview) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [v.preview]);

  const play = () => {
    const el = video.current;
    if (!el) return;
    el.muted = true;
    el.play().catch(() => {});
  };
  const stop = () => {
    const el = video.current;
    if (!el) return;
    el.pause();
    try {
      el.currentTime = 0.5;
    } catch {}
  };

  return (
    <li className={cx("group frost flex flex-col overflow-hidden rounded-[16px] transition-shadow", picked ? "shadow-[0_0_0_2px_var(--accent)]" : "hover:shadow-[0_0_0_1px_rgba(255,255,255,0.25)]")}>
      <div ref={box} className="relative p-2 pb-0" onMouseEnter={play} onMouseLeave={stop}>
        <Link href={href} aria-label={`Open ${v.title}`} className="relative block aspect-[9/16] overflow-hidden rounded-[11px] bg-black">
          {v.preview && near ? (
            <video
              ref={video}
              src={`${v.preview}#t=0.5`}
              preload="metadata"
              muted
              playsInline
              loop
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(246,212,58,0.16),transparent_60%),#0d0d0f] text-center">
              <Clapperboard size={28} className="text-accent/80" aria-hidden />
              <span className="px-3 text-[11.5px] text-muted">{v.preview ? "" : v.line}</span>
            </span>
          )}
          {v.preview && (
            <span aria-hidden className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
                <Play size={18} className="translate-x-[1px]" fill="currentColor" aria-hidden />
              </span>
            </span>
          )}
          {duration !== null && Number.isFinite(duration) && (
            <span className="absolute right-1.5 bottom-1.5 rounded-[6px] bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white tabular-nums">{clock(duration)}</span>
          )}
          {v.needsYou && <span className="absolute top-1.5 right-1.5 rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-bold text-black">For you</span>}
        </Link>
        <button
          type="button"
          role="checkbox"
          aria-checked={picked}
          aria-label={`Select ${v.title}`}
          onClick={onPick}
          className={cx(
            "absolute top-3.5 left-3.5 flex h-5 w-5 items-center justify-center rounded-[6px] border transition-opacity",
            picked ? "border-accent bg-accent text-black opacity-100" : "border-white/60 bg-black/40 text-transparent opacity-70 group-hover:opacity-100",
          )}
        >
          <Check size={13} strokeWidth={3} aria-hidden />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3 pt-2.5">
        <div className="flex items-start gap-1.5">
          <Link href={href} className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink">{v.title}</p>
            <p className="truncate text-[11.5px] text-muted">
              {client ?? FORMAT_LABEL[v.format]}
              {v.version ? ` · v${v.version.number}` : ""}
            </p>
          </Link>
          {v.download ? (
            <a href={v.download} download aria-label={`Download ${v.title}`} title="Download" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-ink">
              <Download size={15} aria-hidden />
            </a>
          ) : null}
        </div>
        <Link href={href} className={cx("mt-auto flex h-7 items-center justify-center rounded-[8px] text-[12px] font-semibold", TONE[v.needsYou ? "review" : v.stage] ?? "bg-white/10 text-ink-2")}>
          {statusLabel(v)}
        </Link>
      </div>
    </li>
  );
}
