import { after } from "next/server";
import { callWorker, hasQueued, validWorkerToken, workOnce } from "@/lib/production";

// The agents' worker (@/lib/production): answers at once, then does one queued run and hands
// over to a fresh worker while runs are left, so no run shares a function's time limit.
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!validWorkerToken(request.headers.get("x-magik-worker"))) return new Response("Forbidden", { status: 403 });
  const origin = new URL(request.url).origin;
  after(async () => {
    const worked = await workOnce();
    if (worked && (await hasQueued())) await callWorker(origin);
  });
  return new Response(null, { status: 202 });
}
