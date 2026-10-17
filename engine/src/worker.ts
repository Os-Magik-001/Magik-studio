// Magik OS edit engine: claims queued edit jobs, has Claude plan the cut from the
// footage, renders it with ffmpeg and hands it to the editor for draft check.
//
//   node src/worker.ts          run forever, polling for jobs
//   node src/worker.ts --once   process at most one job, then exit

import { mkdir } from "node:fs/promises";
import os from "node:os";
import { config, db } from "./config.ts";
import { claim, log, processJob, recoverStale } from "./job.ts";
import { transcriptionAvailable } from "./transcribe.ts";

const once = process.argv.includes("--once");
const worker = `${os.hostname()}:${process.pid}`;
let stopping = false;
let current: string | null = null;

// ---------------------------------------------------------------- loop

// A restart (an update, a reboot) shouldn't strand the job in progress: put it
// back in the queue so the next worker picks it up, then exit.
async function shutdown() {
  if (stopping) return;
  stopping = true;
  if (current) {
    await db.from("edit_jobs").update({ status: "queued", progress: null }).eq("id", current).eq("status", "running");
    log(current, "requeued: the engine is stopping");
  }
  log(null, "stopped");
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

log(null, `edit engine ${worker} started (model ${config.model}, transcription ${(await transcriptionAvailable()) ? "on" : "off"})`);
await mkdir(config.workDir, { recursive: true });
await recoverStale();
let lastRecovery = Date.now();

while (!stopping) {
  if (Date.now() - lastRecovery > 10 * 60_000) {
    await recoverStale();
    lastRecovery = Date.now();
  }
  const job = await claim();
  if (job) {
    log(job.id, `claimed ${job.source} job for video ${job.video_id.slice(0, 8)} (attempt ${job.attempts})`);
    current = job.id;
    await processJob(job);
    current = null;
    if (once) break;
    continue;
  }
  if (once) {
    log(null, "no queued jobs");
    break;
  }
  await new Promise((r) => setTimeout(r, config.pollMs));
}
log(null, "stopped");
