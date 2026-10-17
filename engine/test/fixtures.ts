// Generates small labelled clips so the engine can be tested without real footage.
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { createCanvas } from "@napi-rs/canvas";
import { PLAIN_SHOT, type EditPlan } from "../src/plan.ts";

export type FixtureClip = { file: string; label: string; w: number; h: number; seconds: number; tone: number | null; color: string };

export async function makeClip({ file, label, w, h, seconds, tone, color }: FixtureClip) {
  const fps = 15;
  const args = ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${w}x${h}`, "-r", String(fps), "-i", "pipe:0"];
  if (tone) args.push("-f", "lavfi", "-t", String(seconds), "-i", `sine=frequency=${tone}:sample_rate=48000`);
  args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast");
  if (tone) args.push("-c:a", "aac", "-shortest");
  args.push(file);

  const ff = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "pipe"] });
  let err = "";
  ff.stderr.on("data", (d) => (err += d));
  const done = new Promise<void>((resolve, reject) =>
    ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err)))),
  );

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  for (let f = 0; f < seconds * fps; f++) {
    const t = f / fps;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    // A moving disc gives each moment a distinct frame.
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(w * (0.2 + 0.6 * (t / seconds)), h * 0.62, Math.min(w, h) * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${Math.round(Math.min(w, h) * 0.09)}px Helvetica, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(label, w / 2, h * 0.35);
    ctx.font = `600 ${Math.round(Math.min(w, h) * 0.05)}px Helvetica, Arial, sans-serif`;
    ctx.fillText(`${t.toFixed(1)}s`, w / 2, h * 0.45);
    const frame = ctx.getImageData(0, 0, w, h).data;
    if (!ff.stdin.write(Buffer.from(frame.buffer))) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end();
  await done;
}

export async function makeLogo(file: string) {
  const c = createCanvas(600, 300);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#F2C14E";
  ctx.beginPath();
  ctx.roundRect(0, 0, 600, 300, 60);
  ctx.fill();
  ctx.fillStyle = "#1E1D1B";
  ctx.font = "800 120px Helvetica, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("QA ☕", 300, 155);
  await writeFile(file, await c.encode("png"));
}

type Shot = EditPlan["segments"][number];

// A plan shot with no moves unless `moves` adds some.
export function shot(clip: string, start: number, end: number, purpose: string, moves: Partial<Shot> = {}): Shot {
  return { clip, start, end, purpose, ...PLAIN_SHOT, ...moves };
}

export const CUT = PLAIN_SHOT.transition_in;
