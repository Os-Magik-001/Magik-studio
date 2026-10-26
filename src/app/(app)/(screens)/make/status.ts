// Where a video made in Make a video stands, from its footage, edit jobs and versions.

type Job = { status: string; progress: string | null; created_at: string };
type Made = { versions: { number: number; created_at: string }[]; edit_jobs: Job[]; footage: { id: string }[] };

export function madeStatus(v: Made) {
  const jobs = [...v.edit_jobs].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const latest = [...v.versions].sort((a, b) => b.number - a.number)[0];
  const open = jobs.find((j) => j.status === "queued" || j.status === "running");
  if (open) return { label: open.status === "queued" ? "Waiting for the engine" : "Making…", tone: "accent", busy: true, progress: open.progress } as const;
  const failed = jobs[0]?.status === "failed" && (!latest || jobs[0].created_at > latest.created_at);
  if (failed) return { label: "Failed", tone: "danger", busy: false, progress: null } as const;
  if (latest) return { label: `Ready · v${latest.number}`, tone: "success", busy: false, progress: null } as const;
  if (v.footage.length) return { label: "Ready to make", tone: "neutral", busy: false, progress: null } as const;
  return { label: "Add footage", tone: "neutral", busy: false, progress: null } as const;
}
