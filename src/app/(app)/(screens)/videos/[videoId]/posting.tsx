"use client";

import { useState, useTransition } from "react";
import { CalendarClock } from "lucide-react";
import { POST_PLATFORMS } from "@/lib/calendar";
import { Button, Input, cx } from "@/components/ui";
import { localInput } from "@/components/calendar/dates";
import { useDesktop } from "@/components/desktop/context";
import { setPostDate } from "@/app/actions/calendar";

// When and where the video goes out. The client sees it in their calendar and their pipeline.
export function PostingDate({ videoId, postAt, platforms: initial }: { videoId: string; postAt: string | null; platforms: string[] }) {
  const d = useDesktop();
  const [value, setValue] = useState(postAt ? localInput(new Date(postAt)) : "");
  const [platforms, setPlatforms] = useState<string[]>(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const save = (clear = false) =>
    startTransition(async () => {
      const at = clear || !value ? null : new Date(value).toISOString();
      const r = await setPostDate(videoId, at, platforms);
      if (!r.ok) setMessage({ ok: false, text: r.error });
      else {
        if (clear) setValue("");
        setMessage({ ok: true, text: at ? "Saved. It's in the client's calendar." : "No posting date." });
      }
    });
  return (
    <section className="frost rounded-[22px]">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <CalendarClock size={16} className="text-accent" aria-hidden /> Posting date
        </h2>
        <button type="button" onClick={() => d.open(`/calendar${value ? `?date=${value.slice(0, 10)}` : ""}`)} className="text-[12.5px] font-medium text-accent hover:underline">
          Calendar
        </button>
      </div>
      <div className="flex flex-col gap-3 p-5">
        <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} aria-label="When it's posted" />
        <div className="flex flex-wrap gap-1.5">
          {POST_PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={platforms.includes(p)}
              onClick={() => setPlatforms((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]))}
              className={cx("h-7 rounded-full px-2.5 text-[12px] font-medium", platforms.includes(p) ? "bg-accent text-black" : "bg-white/[0.08] text-ink-2 hover:bg-white/[0.13]")}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => save()}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {postAt && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => save(true)}>
              Remove
            </Button>
          )}
        </div>
        {message && <p className={cx("text-[12.5px]", message.ok ? "text-success" : "text-danger")}>{message.text}</p>}
      </div>
    </section>
  );
}
