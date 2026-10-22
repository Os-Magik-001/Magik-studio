"use client";

import { useState, useTransition } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import type { CalendarView } from "@/lib/preferences";
import { Button, Input } from "@/components/ui";
import { Choice } from "@/components/switch";
import { SettingsGroup, SettingsRow } from "@/components/settings/settings-shell";
import { calendarLink, savePreferences } from "@/app/actions/account";

// Settings > Calendar: how the calendar looks, and the private link that puts it in Google or
// Apple Calendar.
export function CalendarSettings({ weekStart, view }: { weekStart: 0 | 1; view: CalendarView }) {
  const [start, setStart] = useState<0 | 1>(weekStart);
  const [shown, setShown] = useState<CalendarView>(view);
  const [link, setLink] = useState<{ https: string; webcal: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const getLink = (fresh: boolean) =>
    startTransition(async () => {
      setLink(await calendarLink(fresh));
      setCopied(false);
      setConfirming(false);
    });

  return (
    <>
      <SettingsGroup title="Calendar">
        <SettingsRow label="Weeks start on">
          <Choice<"0" | "1">
            label="Weeks start on"
            value={String(start) as "0" | "1"}
            onChange={(v) => {
              const n = Number(v) as 0 | 1;
              setStart(n);
              savePreferences({ weekStart: n }).catch(() => {});
            }}
            options={[
              { value: "0", label: "Sunday" },
              { value: "1", label: "Monday" },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Opens on">
          <Choice<CalendarView>
            label="The calendar opens on"
            value={shown}
            onChange={(v) => {
              setShown(v);
              savePreferences({ calendarView: v }).catch(() => {});
            }}
            options={[
              { value: "month", label: "Month" },
              { value: "week", label: "Week" },
              { value: "day", label: "Day" },
              { value: "agenda", label: "List" },
            ]}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup
        title="Sync with Google or Apple Calendar"
        description="Your Magik calendar (your events, shoots, deadlines and posting dates) appears in your phone's or computer's calendar and stays up to date. Keep the link private: anyone with it can see your calendar."
      >
        <div className="flex flex-col gap-3 p-4">
          {!link ? (
            <Button variant="primary" className="self-start" onClick={() => getLink(false)} disabled={pending}>
              {pending ? "Getting your link…" : "Get my calendar link"}
            </Button>
          ) : (
            <>
              <div className="flex gap-2">
                <Input readOnly value={link.https} onFocus={(e) => e.currentTarget.select()} aria-label="Your calendar link" className="font-mono text-[12.5px]" />
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(link.https);
                    setCopied(true);
                  }}
                >
                  {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(link.webcal)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center rounded-full bg-white/[0.08] px-3.5 text-[13px] font-medium text-ink hover:bg-white/[0.13]"
                >
                  Add to Google Calendar
                </a>
                <a href={link.webcal} className="inline-flex h-8 items-center rounded-full bg-white/[0.08] px-3.5 text-[13px] font-medium text-ink hover:bg-white/[0.13]" data-native>
                  Add to Apple Calendar
                </a>
              </div>
              <ol className="list-decimal space-y-1 pl-5 text-[12.5px] text-muted">
                <li>Google Calendar on a computer: Other calendars, +, From URL, then paste the link.</li>
                <li>iPhone or Mac: tap Add to Apple Calendar, or Settings, Calendar, Accounts, Add Subscribed Calendar.</li>
                <li>Google refreshes subscribed calendars every few hours; Apple Calendar can refresh every 5 minutes.</li>
              </ol>
            </>
          )}
        </div>
        <SettingsRow label="Make a new link" hint="The old link stops working, everywhere it was added.">
          {confirming ? (
            <span className="flex gap-2">
              <Button variant="danger" size="sm" onClick={() => getLink(true)} disabled={pending}>
                <RefreshCw size={13} aria-hidden /> Replace it
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </span>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
              New link
            </Button>
          )}
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}
