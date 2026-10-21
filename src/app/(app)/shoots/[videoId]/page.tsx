import { videoTitle } from "@/lib/titles";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { visibleVideo } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { driveServiceEmail } from "@/lib/drive";
import { formatBytes, parseShotList, FORMAT_LABEL } from "@/lib/workflow";
import { Card, CardHeader, EmptyState, PageHeader, cx } from "@/components/ui";
import { toggleShot } from "@/app/actions/workflow";
import { LocalDate } from "@/components/local-date";
import { FootageCompleteForm, FootageDrop } from "@/app/(app)/videos/[videoId]/forms";
import { ShootPlanView } from "@/components/agents/views";
import { asShootPlan } from "@/lib/agent-types";

export async function generateMetadata({ params }: { params: Promise<{ videoId: string }> }): Promise<Metadata> {
  return videoTitle((await params).videoId, "Shoot", "Shoot · ");
}

export default async function ShootDetail({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  await requireRole("videographer", "admin");
  const video = await visibleVideo(videoId);
  if (!video) notFound();

  const supabase = await createClient();
  const [{ data: client }, { data: script }, { data: shoots }, { data: footage }] = await Promise.all([
    supabase.from("clients").select("name").eq("id", video.client_id).single(),
    supabase.from("scripts").select("body, shot_list, status, shoot_plan").eq("video_id", videoId).maybeSingle(),
    supabase.from("shoots").select("*").eq("video_id", videoId).order("starts_at"),
    supabase.from("footage").select("id, file_name, size_bytes, created_at").eq("video_id", videoId).order("created_at"),
  ]);
  const shots = parseShotList(script?.shot_list);
  const doneCount = shots.filter((s) => s.done).length;
  const plan = asShootPlan(script?.shoot_plan);
  const { data: complete } = await supabase.from("videos").select("footage_complete_at").eq("id", videoId).single();

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/shoots" className="hover:text-ink">
            Shoot calendar
          </Link>
        }
        title={video.title}
        description={`${client?.name} · ${FORMAT_LABEL[video.format]} · ${video.aspect}`}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Shot list" description={shots.length ? `${doneCount} of ${shots.length} captured` : undefined} />
            {!script ? (
              <div className="p-5">
                <EmptyState title="The script isn't approved yet">
                  You&apos;ll see the script and shot list here once the client signs off.
                </EmptyState>
              </div>
            ) : shots.length === 0 ? (
              <p className="p-5 text-sm text-muted">No shot list on this script. Follow the script below.</p>
            ) : (
              <ul className="divide-y divide-line">
                {shots.map((s, i) => (
                  <li key={i}>
                    <form action={toggleShot}>
                      <input type="hidden" name="videoId" value={video.id} />
                      <input type="hidden" name="index" value={i} />
                      <button className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-surface-2">
                        <span
                          className={cx(
                            "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-xl border",
                            s.done ? "border-success bg-success text-white" : "border-line-strong",
                          )}
                          aria-hidden
                        >
                          {s.done && <Check size={13} strokeWidth={3} />}
                        </span>
                        <span className={cx("text-sm", s.done ? "text-muted line-through" : "text-ink")}>{s.text}</span>
                        <span className="sr-only">{s.done ? "Mark as not captured" : "Mark as captured"}</span>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {plan && (
            <Card>
              <CardHeader title="Shoot plan" description="Scene by scene: framing, action, lines and what not to forget." />
              <div className="p-5">
                <ShootPlanView plan={plan} />
              </div>
            </Card>
          )}
          {script && (
            <Card>
              <CardHeader title="Script" />
              <div className="whitespace-pre-wrap p-5 text-sm leading-relaxed text-ink">{script.body}</div>
            </Card>
          )}
        </div>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="When & where" />
            <div className="flex flex-col gap-3 p-5 text-sm">
              {shoots?.length ? (
                shoots.map((s) => (
                  <div key={s.id}>
                    <div className="font-medium text-ink">
                      <LocalDate value={s.starts_at} preset="full" />
                    </div>
                    {s.location && <div className="text-ink-2">{s.location}</div>}
                    {s.needs && <div className="mt-1 text-muted">Bring: {s.needs}</div>}
                  </div>
                ))
              ) : (
                <p className="text-muted">Not scheduled yet.</p>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Footage drop" description="Goes straight into the client's project. The editor is told it arrived." />
            <div className="flex flex-col gap-3 p-5">
              {footage?.map((f) => (
                <div key={f.id} className="flex items-center gap-2 text-[13px]">
                  <span className="min-w-0 flex-1 truncate text-ink">{f.file_name}</span>
                  <span className="text-muted">{formatBytes(f.size_bytes)}</span>
                </div>
              ))}
              <FootageDrop videoId={video.id} driveEmail={driveServiceEmail()} />
              <div className="border-t border-line pt-3">
                <FootageCompleteForm videoId={video.id} completedAt={complete?.footage_complete_at ?? null} hasFootage={!!footage?.length} />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
