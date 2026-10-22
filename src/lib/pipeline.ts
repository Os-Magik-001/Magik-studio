// The pipeline at a glance: the phases the board groups videos in, the steps of one video's page,
// and for each video the next thing to do and who it's waiting on. Shared by the Pipeline board
// and the video page, so both always say the same thing.

import { videoStatusIndex, type ScriptStatus, type VersionStatus, type VideoStatus } from "@/lib/workflow";

// Who a video is waiting on.
export type Who = "studio" | "client" | "crew" | "engine" | "done";

export const WHO: Record<Who, { label: string; tone: "accent" | "neutral" | "success" | "warning" | "danger" }> = {
  studio: { label: "The studio", tone: "accent" },
  client: { label: "The client", tone: "neutral" },
  crew: { label: "The videographer", tone: "neutral" },
  engine: { label: "The edit engine", tone: "warning" },
  done: { label: "Done", tone: "success" },
};

export const PHASES: { key: string; label: string; hint: string; statuses: VideoStatus[] }[] = [
  { key: "plan", label: "Plan", hint: "Brief, references, script", statuses: ["script"] },
  { key: "shoot", label: "Shoot", hint: "Shoot and footage", statuses: ["shoot", "footage_in"] },
  { key: "edit", label: "Edit", hint: "The edit engine edits, the editor checks", statuses: ["editing", "editor_check"] },
  { key: "review", label: "Review", hint: "The client reviews", statuses: ["client_review", "approved"] },
  { key: "done", label: "Delivered", hint: "Finished videos", statuses: ["delivered"] },
];

export const phaseOf = (status: VideoStatus) => PHASES.find((p) => p.statuses.includes(status))!;

// What the board and the video page know about a video.
export type PipelineFacts = {
  status: VideoStatus;
  hasBrief: boolean;
  script: { status: ScriptStatus; hasBody: boolean; hasPrompt: boolean } | null;
  // The next shoot on the calendar (ISO), if any.
  nextShoot: string | null;
  footage: number;
  footageComplete: boolean;
  // The edit job in progress, or the last one when it failed.
  job: { status: "queued" | "running" | "failed"; progress: string | null } | null;
  // The newest version.
  version: { number: number; status: VersionStatus } | null;
};

export type NextStep = { label: string; who: Who; step: StepKey };

export function nextStep(f: PipelineFacts): NextStep {
  const v = f.version;
  switch (f.status) {
    case "script":
      if (!f.hasBrief && !f.script?.hasBody) return { label: "Write the brief", who: "studio", step: "brief" };
      if (!f.script?.hasBody) return { label: "Write the script with the scriptwriter", who: "studio", step: "script" };
      if (f.script.status === "client_review") return { label: "Waiting for the client to approve the script", who: "client", step: "script" };
      if (f.script.status === "changes_requested") return { label: "The client asked for script changes", who: "studio", step: "script" };
      if (f.script.status === "approved") return { label: "Script approved: plan the shoot", who: "studio", step: "shoot" };
      return { label: "Send the script to the client", who: "studio", step: "script" };
    case "shoot":
      if (f.footage) return { label: `${f.footage} footage file${f.footage > 1 ? "s" : ""} in: mark the footage complete`, who: "crew", step: "shoot" };
      return { label: f.nextShoot ? "Shoot on the planned day" : "Plan the shoot", who: f.nextShoot ? "crew" : "studio", step: "shoot" };
    case "footage_in":
      return f.footageComplete ? { label: "Launch the edit", who: "studio", step: "edit" } : { label: "Footage is in: start the edit", who: "studio", step: "edit" };
    case "editing":
      if (f.job?.status === "failed") return { label: "The edit failed: retry it", who: "studio", step: "edit" };
      if (f.job?.status === "running") return { label: f.job.progress ?? "The edit engine is editing", who: "engine", step: "edit" };
      if (f.job?.status === "queued") return { label: "Waiting for the edit engine", who: "engine", step: "edit" };
      return { label: "Launch the edit", who: "studio", step: "edit" };
    case "editor_check":
      return { label: v ? `Check v${v.number} and send it to the client` : "Check the draft", who: "studio", step: "review" };
    case "client_review":
      return { label: v ? `The client is reviewing v${v.number}` : "The client is reviewing", who: "client", step: "review" };
    case "approved":
      return { label: "Approved: deliver it", who: "studio", step: "review" };
    case "delivered":
      return { label: "Delivered", who: "done", step: "review" };
  }
}

// ---------------------------------------------------------------- one video's page

export const STEPS = [
  { key: "brief", label: "Brief & references" },
  { key: "script", label: "Script" },
  { key: "design", label: "Motion design" },
  { key: "shoot", label: "Shoot & footage" },
  { key: "edit", label: "Edit" },
  { key: "sound", label: "Sound" },
  { key: "review", label: "Review & delivery" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];
// optional: a step this video skips (the engine's own graphics instead of a design).
export type StepState = "done" | "current" | "todo" | "optional";

export function stepStates(f: PipelineFacts & { designed: boolean; hasDesign: boolean; hasSound: boolean; references: number }): Record<StepKey, StepState> {
  const at = videoStatusIndex(f.status);
  const now = nextStep(f).step;
  const state = (key: StepKey, done: boolean): StepState => (done ? "done" : now === key ? "current" : "todo");
  return {
    brief: state("brief", f.hasBrief || f.references > 0 || !!f.script?.hasBody),
    script: state("script", f.script?.status === "approved" || at >= videoStatusIndex("shoot")),
    design: f.designed ? (f.hasDesign ? "done" : f.script?.hasBody && at < videoStatusIndex("editor_check") ? "current" : "todo") : "optional",
    shoot: state("shoot", f.footageComplete || at >= videoStatusIndex("editing")),
    edit: state("edit", !!f.version && at >= videoStatusIndex("editor_check")),
    sound: f.hasSound ? "done" : "todo",
    review: state("review", f.status === "delivered"),
  };
}
