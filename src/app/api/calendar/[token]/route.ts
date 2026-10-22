import type { NextRequest } from "next/server";
import { feedOwner } from "@/lib/calendar-feed";
import { feedEvents } from "@/lib/calendar-data";
import type { CalEvent } from "@/lib/calendar";

const DAY = 86_400_000;

// A person's Magik calendar as an iCalendar feed (RFC 5545), for Google or Apple Calendar to
// subscribe to. Public: the link's signed token is the key (lib/calendar-feed.ts).
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const userId = await feedOwner(token.replace(/\.ics$/i, ""));
  if (!userId) return new Response("Not found", { status: 404 });
  const now = Date.now();
  const events = await feedEvents(userId, new Date(now - 60 * DAY).toISOString(), new Date(now + 400 * DAY).toISOString());
  const origin = request.nextUrl.origin;
  const stamp = utc(new Date(now).toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Magik Studio//Magik OS//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Magik OS",
    "X-WR-CALDESC:Your events\\, shoots\\, deadlines and posting dates from Magik OS",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...events.flatMap((e) => vevent(e, stamp, origin)),
    "END:VCALENDAR",
  ];
  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="magik-os.ics"',
      "cache-control": "private, max-age=300",
    },
  });
}

function vevent(e: CalEvent, stamp: string, origin: string) {
  const out = ["BEGIN:VEVENT", `UID:${e.id.replace(":", "-")}@magik-os`, `DTSTAMP:${stamp}`];
  if (e.allDay) {
    out.push(`DTSTART;VALUE=DATE:${e.start.slice(0, 10).replaceAll("-", "")}`, `DTEND;VALUE=DATE:${e.end.slice(0, 10).replaceAll("-", "")}`);
  } else {
    out.push(`DTSTART:${utc(e.start)}`, `DTEND:${utc(e.end)}`);
  }
  out.push(`SUMMARY:${esc(e.title)}`);
  if (e.location) out.push(`LOCATION:${esc(e.location)}`);
  const about = [e.client?.name, e.description].filter(Boolean).join("\n");
  if (about) out.push(`DESCRIPTION:${esc(about)}`);
  if (e.href) out.push(`URL:${origin}${e.href}`);
  out.push("END:VEVENT");
  return out;
}

const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Lines longer than 75 octets continue on the next line, after a space.
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let cur = "";
  let len = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (len + n > (parts.length ? 74 : 75)) {
      parts.push(cur);
      cur = "";
      len = 0;
    }
    cur += ch;
    len += n;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}
