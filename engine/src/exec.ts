import { spawn } from "node:child_process";

export function run(cmd: string, args: string[], opts: { cwd?: string } = {}) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => {
      stderr += d;
      if (stderr.length > 200_000) stderr = stderr.slice(-100_000);
    });
    child.on("error", (err) =>
      reject(new Error(`${cmd} could not start: ${err.message}. Is it installed and on PATH?`)),
    );
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited with ${code}: ${stderr.trim().split("\n").slice(-6).join(" | ")}`));
    });
  });
}

export async function exists(cmd: string) {
  try {
    await run(cmd, ["-h"]);
    return true;
  } catch (e) {
    return !(e instanceof Error && /could not start/.test(e.message));
  }
}
