// Magik OS edit engine: claims queued edit jobs, has Claude plan the cut from the
// footage, renders it with ffmpeg and hands it to the editor for draft check.
//
//   node src/worker.ts          run forever, polling for jobs
//   node src/worker.ts --once   process at most one job, then exit

import { mkdir } from "node:fs/promises";
import os from "node:os";
import { config } from "./config.ts";
import { claim, log, processJob, recoverStale } from "./job.ts";
import { transcriptionAvailable } from "./transcribe.ts";

const once = process.argv.includes("--once");
const worker = `${os.hostname()}:${process.pid}`;
let stopping = false;

// ---------------------------------------------------------------- loop

process.on("SIGINT", () => (stopping = true));
process.on("SIGTERM", () => (stopping = true));

log(null, `edit engine ${worker} started (model ${config.model}, transcription ${(await transcriptionAvailable()) ? "on" : "off"})`);
await mkdir(config.workDir, { recursive: true });
await recoverStale();

while (!stopping) {
  const job = await claim();
  if (job) {
    log(job.id, `claimed ${job.source} job for video ${job.video_id.slice(0, 8)} (attempt ${job.attempts})`);
    await processJob(job);
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
