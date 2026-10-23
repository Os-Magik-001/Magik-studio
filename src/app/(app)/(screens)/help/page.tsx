import type { Metadata } from "next";
import { CircleHelp, Inbox, Keyboard, LayoutGrid, MousePointer2 } from "lucide-react";
import { displayName, getViewer } from "@/lib/auth";
import { FAQ, TIPS } from "@/lib/guide";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { LocalDate } from "@/components/local-date";
import { WindowPage } from "@/components/desktop/window-page";
import { AnswerForm, AskForm } from "./help-forms";

export const metadata: Metadata = { title: "Help" };

// The questions and tips live with Motchi's guide (@/lib/guide), so the two always agree.
const TIP_CARDS: { icon: typeof LayoutGrid; title: string; text: string }[] = [
  { icon: MousePointer2, title: "Windows", text: TIPS.windows },
  { icon: LayoutGrid, title: "Mission Control", text: TIPS.mission },
  { icon: Keyboard, title: "Search", text: TIPS.search },
];

export default async function HelpPage() {
  const viewer = await getViewer();
  const supabase = await createClient();
  const [{ data: mine }, { data: inbox }] = await Promise.all([
    supabase.from("help_requests").select("id, topic, body, status, created_at").eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(10),
    viewer.role === "admin"
      ? supabase.from("help_requests").select("id, topic, body, page, status, created_at, user:profiles!help_requests_user_id_fkey(full_name, email)").eq("status", "open").order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: null }),
  ]);
  return (
    <WindowPage>
      <PageHeader title="Help" description="How Magik OS works, the questions people ask most, and a way to reach the studio." />

      {inbox && (
        <Card className="mb-6">
          <CardHeader title={`Inbox${inbox.length ? ` · ${inbox.length}` : ""}`} description="Questions people sent from Help. Your answer reaches them as a notification." />
          {inbox.length ? (
            <ul className="divide-y divide-white/[0.07]">
              {inbox.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
                    <Inbox size={14} aria-hidden />
                    <span className="font-medium text-ink">{r.user ? displayName(r.user) : "Someone"}</span>
                    <Badge tone="accent">{r.topic}</Badge>
                    <LocalDate value={r.created_at} preset="short" />
                    {r.page && <span className="truncate">· from {r.page}</span>}
                  </div>
                  <p className="text-[13.5px] whitespace-pre-line text-ink-2">{r.body}</p>
                  <AnswerForm id={r.id} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-5 text-[13.5px] text-muted">Nothing waiting.</p>
          )}
        </Card>
      )}

      <div className="grid gap-3 @min-[48rem]:grid-cols-3">
        {TIP_CARDS.map((t) => (
          <section key={t.title} className="frost rounded-[16px] p-4">
            <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-ink">
              <t.icon size={17} aria-hidden />
            </span>
            <h2 className="text-[14px] font-semibold text-ink">{t.title}</h2>
            <p className="mt-1 text-[13px] text-muted">{t.text}</p>
          </section>
        ))}
      </div>

      <div className="mt-6 grid gap-6 @min-[64rem]:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title="Questions people ask" />
          <div className="divide-y divide-white/[0.07]">
            {FAQ[viewer.role].map(([q, a]) => (
              <details key={q} className="group px-5 py-3.5">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-[14px] font-medium text-ink">
                  <CircleHelp size={15} className="shrink-0 text-accent" aria-hidden />
                  {q}
                </summary>
                <p className="mt-2 pl-[23px] text-[13.5px] text-ink-2">{a}</p>
              </details>
            ))}
          </div>
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Ask the studio" description="We answer in your notifications, usually the same day." />
            <div className="p-5">
              <AskForm />
            </div>
          </Card>
          {mine && mine.length > 0 && (
            <Card>
              <CardHeader title="Your messages" />
              <ul className="divide-y divide-white/[0.07]">
                {mine.map((m) => (
                  <li key={m.id} className="px-5 py-3">
                    <div className="flex items-center gap-2 text-[12px] text-muted">
                      <LocalDate value={m.created_at} preset="short" />
                      <Badge tone={m.status === "open" ? "accent" : "success"}>{m.status === "open" ? "Waiting" : m.status === "answered" ? "Answered" : "Closed"}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-3 text-[13px] text-ink-2">{m.body}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </WindowPage>
  );
}
