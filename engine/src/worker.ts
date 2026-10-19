// Magik OS edit engine: claims queued edit jobs, has Claude plan the cut from the
// footage, renders it with ffmpeg and hands it to the editor for draft check.
//
//   node src/worker.ts          run forever, polling for jobs
//   node src/worker.ts --once   process at most one job, then exit

import { mkdir } from "node:fs/promises";
import os from "node:os";
import { config, db } from "./config.ts";
import { claim, log, processJob, recoverStale } from "./job.ts";
import { claimLibrarySync, recoverStaleLibraries, registerBuiltins, syncLibrary } from "./libraries.ts";
import { claimReference, recoverStaleReferences, runReference } from "./references.ts";
import { claimResearch, recoverStaleResearch, runResearch } from "./research.ts";
import { transcriptionAvailable } from "./transcribe.ts";

const once = process.argv.includes("--once");
const worker = `${os.hostname()}:${process.pid}`;
let stopping = false;
let current: string | null = null;
let currentResearch: string | null = null;
let currentReference: string | null = null;
let currentLibrary: string | null = null;

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
  if (currentResearch) {
    await db.from("trend_reports").update({ status: "queued", progress: null }).eq("id", currentResearch).eq("status", "running");
    log(currentResearch, "research requeued: the engine is stopping");
  }
  if (currentReference) {
    await db.from("reference_videos").update({ status: "queued", progress: null }).eq("id", currentReference).eq("status", "running");
    log(currentReference, "reference requeued: the engine is stopping");
  }
  if (currentLibrary) {
    await db.from("sound_libraries").update({ status: "queued", progress: null }).eq("id", currentLibrary).eq("status", "running");
    log(currentLibrary, "library sync requeued: the engine is stopping");
  }
  log(null, "stopped");
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

log(null, `edit engine ${worker} started (model ${config.model}, transcription ${(await transcriptionAvailable()) ? "on" : "off"})`);
await mkdir(config.workDir, { recursive: true });
await recoverStale();
await recoverStaleResearch();
await recoverStaleReferences();
await recoverStaleLibraries().catch((err) => log(null, `library recovery failed: ${err.message}`));
// The app's Sound page lists the libraries this engine ships with.
await registerBuiltins().catch((err) => log(null, `couldn't list the built-in sound libraries: ${err.message}`));
let lastRecovery = Date.now();

while (!stopping) {
  if (Date.now() - lastRecovery > 10 * 60_000) {
    await recoverStale();
    await recoverStaleResearch();
    await recoverStaleReferences();
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
  // Edits come first; then the references the studio added (a minute or two each), then research.
  const reference = await claimReference().catch(() => null);
  if (reference) {
    log(reference.id, `claimed a ${reference.platform} reference for client ${reference.client_id.slice(0, 8)}`);
    currentReference = reference.id;
    await runReference(reference);
    currentReference = null;
    if (once) break;
    continue;
  }
  const research = await claimResearch();
  if (research) {
    log(research.id, `claimed trend research for client ${research.client_id.slice(0, 8)}`);
    currentResearch = research.id;
    await runResearch(research);
    currentResearch = null;
    if (once) break;
    continue;
  }
  // Drive sound libraries sync last: measuring a big folder takes a while.
  const library = await claimLibrarySync().catch(() => null);
  if (library) {
    log(library.id, `syncing the sound library ${library.name}`);
    currentLibrary = library.id;
    await syncLibrary(library);
    currentLibrary = null;
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
