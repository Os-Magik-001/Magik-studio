import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import { calendarEvents } from "@/lib/calendar-data";

const DAY = 86_400_000;

// The Calendar app's events between two instants, for the signed-in person (RLS).
export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  const from = Date.parse(request.nextUrl.searchParams.get("from") ?? "");
  const to = Date.parse(request.nextUrl.searchParams.get("to") ?? "");
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 120 * DAY) {
    return NextResponse.json({ error: "from and to: two instants, at most 120 days apart" }, { status: 400 });
  }
  const events = await calendarEvents(viewer, new Date(from).toISOString(), new Date(to).toISOString());
  return NextResponse.json({ events }, { headers: { "cache-control": "private, no-store" } });
}
