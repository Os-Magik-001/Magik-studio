import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { driveServiceEmail } from "@/lib/drive";
import type { Database } from "@/lib/database.types";
import { AutoRefresh } from "@/components/auto-refresh";
import { LocalDate } from "@/components/local-date";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { removeSoundLibrary, syncSoundLibrary } from "@/app/actions/sounds";
import { AddLibraryForm } from "./forms";

export const metadata: Metadata = { title: "Sound" };

type Library = Database["public"]["Tables"]["sound_libraries"]["Row"];

const STATUS = {
  queued: { label: "Waiting for the engine", tone: "neutral" },
  running: { label: "Measuring", tone: "accent" },
  done: { label: "Ready", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
} as const;

export default async function SoundsPage() {
  const viewer = await requireRole("admin", "editor");
  const supabase = await createClient();
  const { data: libraries } = await supabase.from("sound_libraries").select("*").order("source").order("name");
  const all = libraries ?? [];
  const busy = all.some((l) => l.source === "drive" && (l.status === "queued" || l.status === "running"));

  return (
    <>
      <PageHeader
        title="Sound"
        description="The libraries the sound designer (agent 4) searches on every edit. It picks the music, lines it up with the cut, adds the sound effects, and matches the trending sounds the researcher finds."
      />
      {busy && <AutoRefresh seconds={8} />}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Libraries title="Music" items={all.filter((l) => l.kind === "music")} canRemove={viewer.role === "admin"} />
          <Libraries title="Sound effects" items={all.filter((l) => l.kind === "sfx")} canRemove={viewer.role === "admin"} />
        </div>
        <Card>
          <CardHeader title="Add a Google Drive library" description="A folder of music or sound effects the studio may use. The engine measures each file once (tempo, sections, drops), then the sound designer searches it with the rest." />
          <div className="p-5">
            <AddLibraryForm driveEmail={driveServiceEmail()} />
          </div>
        </Card>
      </div>
    </>
  );
}

function Libraries({ title, items, canRemove }: { title: string; items: Library[]; canRemove: boolean }) {
  const files = items.reduce((a, l) => a + l.file_count, 0);
  return (
    <Card>
      <CardHeader title={title} description={items.length ? `${items.length} libraries · ${files.toLocaleString("en-US")} files` : undefined} />
      {!items.length ? (
        <div className="p-5">
          <EmptyState title="Nothing listed yet">The edit engine lists its built-in libraries when it starts.</EmptyState>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((l) => (
            <li key={l.id} className="flex flex-col gap-1 px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-ink">{l.name}</span>
                <Badge tone={l.source === "builtin" ? "neutral" : "accent"}>{l.source === "builtin" ? "Built in" : "Google Drive"}</Badge>
                {l.source === "drive" && <Badge tone={STATUS[l.status].tone}>{STATUS[l.status].label}</Badge>}
                <span className="ml-auto text-[13px] text-ink-2">{l.file_count.toLocaleString("en-US")} files</span>
              </div>
              {l.license && <p className="text-[13px] text-muted">{l.license}</p>}
              {l.progress && <p className="text-[13px] text-accent">{l.progress}…</p>}
              {l.error && <p className="text-[13px] text-danger">{l.error}</p>}
              {l.source === "drive" && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                  {l.synced_at && <LocalDate value={l.synced_at} preset="short" prefix="Synced " />}
                  {(l.status === "done" || l.status === "failed") && (
                    <form action={syncSoundLibrary}>
                      <input type="hidden" name="libraryId" value={l.id} />
                      <button className="font-medium text-accent hover:underline">Sync again</button>
                    </form>
                  )}
                  {canRemove && (
                    <form action={removeSoundLibrary}>
                      <input type="hidden" name="libraryId" value={l.id} />
                      <button className="hover:text-danger">Remove</button>
                    </form>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
