import { createHash } from "node:crypto";
import { access, mkdir, readFile, rename, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./exec.ts";

// Person mattes come from Apple's Vision framework through a small Swift tool,
// compiled on first use, so this only works on macOS.
const SOURCE = fileURLToPath(new URL("../tools/segment/main.swift", import.meta.url));

let binaryPath: Promise<string> | undefined;
let compiled: Promise<string> | undefined;
let available: Promise<boolean> | undefined;

// Named after the source's hash, so editing main.swift builds a fresh binary.
function binary() {
  binaryPath ??= readFile(SOURCE).then((src) =>
    path.join(os.tmpdir(), "magik-engine-bin", `segment-${createHash("sha256").update(src).digest("hex").slice(0, 16)}`),
  );
  return binaryPath;
}

const isFile = (file: string) => access(file).then(() => true, () => false);

function compile() {
  compiled ??= (async () => {
    const bin = await binary();
    if (await isFile(bin)) return bin;
    await mkdir(path.dirname(bin), { recursive: true });
    // Build beside the target and rename, so another process never runs a half-written binary.
    const tmp = `${bin}.${process.pid}.${Date.now()}.tmp`;
    try {
      await run("swiftc", ["-O", SOURCE, "-o", tmp]);
      await rename(tmp, bin);
    } finally {
      await rm(tmp, { force: true });
    }
    return bin;
  })();
  compiled.catch(() => (compiled = undefined));
  return compiled;
}

export function segmentationAvailable(): Promise<boolean> {
  available ??= (async () => {
    if (process.platform !== "darwin") return false;
    if (await isFile(await binary())) return true;
    // Without the Command Line Tools, /usr/bin/swiftc is a stub that fails, so actually run it.
    return run("swiftc", ["--version"]).then(() => true, () => false);
  })();
  return available;
}

// Writes a grayscale H.264 .mov of `duration` seconds at `fps`: white where a person is.
// Frame k shows the same source frame `ffmpeg -ss start -i file -vf fps=<fps>` gives at k/fps.
export async function personMatte(file: string, start: number, duration: number, fps: number, outFile: string): Promise<void> {
  if (!(start >= 0 && duration > 0 && fps > 0)) {
    throw new Error(`personMatte needs start >= 0, duration > 0 and fps > 0 (got ${start}, ${duration}, ${fps})`);
  }
  if (!(await segmentationAvailable())) throw new Error("Person segmentation needs macOS with swiftc (Xcode Command Line Tools)");
  const bin = await compile();
  await mkdir(path.dirname(path.resolve(outFile)), { recursive: true });
  await run(bin, [file, String(start), String(duration), String(fps), outFile]);
}
