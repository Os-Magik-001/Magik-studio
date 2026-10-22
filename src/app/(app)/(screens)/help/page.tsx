import type { Metadata } from "next";
import { CircleHelp, Inbox, Keyboard, LayoutGrid, MousePointer2 } from "lucide-react";
import { displayName, getViewer, type Role } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { LocalDate } from "@/components/local-date";
import { WindowPage } from "@/components/desktop/window-page";
import { AnswerForm, AskForm } from "./help-forms";

export const metadata: Metadata = { title: "Help" };

type QA = [string, string];

// What each role asks most. Clients' answers never mention how the studio works inside.
const FAQ: Record<Role, QA[]> = {
  client: [
    ["Where do I see my videos?", "Open Your videos in the Dock. Each video shows its latest cut; click it to watch, comment on the exact moment you'd like changed, then approve it or ask for changes."],
    ["How do I follow where each video is?", "Open Pipeline: every video is in a column, from the script to the shoot, the edit, your review and posting. Anything waiting for you is marked."],
    ["How do I approve a script?", "In Pipeline or Your videos, open the video: its script is at the top. Read it, then approve it or ask for changes in a few words."],
    ["When will my videos be posted?", "Open Calendar: posting dates are in gold, shoots in orange. You can also add your own events and share them with the studio."],
    ["Where are my invoices and my contract?", "In Settings, under Documents."],
    ["How do referrals work?", "Open Referrals: share your link with a business that needs videos. When they sign with Magik, you earn credits."],
  ],
  admin: [
    ["How do I start a new client?", "Onboarding, then New client: their details, the pack, the invoice, the contract, then send them their link. They finish their setup on their own."],
    ["A client can't get in. Why?", "Clients use Magik OS once their onboarding is finished. In their client folder you can open their setup, or mark them onboarded if they started before onboarding existed."],
    ["How do I pause or remove someone?", "Team, then Manage on their row: pause stops them signing in until you resume them; delete removes their account for good (their work stays)."],
    ["How do posting dates reach clients?", "Set the posting date on a video's page, or drag it in Calendar. The client sees it in their calendar."],
    ["Where do referral credits come from?", "Referrals: when you mark a referral signed, its referrer gets the credits set in Settings, Studio."],
  ],
  editor: [
    ["Where do I start my day?", "Pipeline shows every video by phase and what it's waiting on; your videos have your initials."],
    ["How do posting dates reach clients?", "Set the posting date on a video's page, or drag it in Calendar. The client sees it in their calendar."],
    ["How do I invite someone to a meeting?", "Calendar, Create: add a title and a time, then Invite the team."],
  ],
  videographer: [
    ["Where are my shoots?", "Shoots lists them with their shot lists; Calendar shows them in orange."],
    ["How do I send the footage?", "Open the shoot, then upload the files or link the Drive folder, and mark the footage complete."],
  ],
  seller: [
    ["How do I start a new client?", "Onboarding, then New client: details, pack, invoice, contract, then send the link."],
    ["Where do referrals come in?", "Referrals: every business referred to Magik, with who referred it. Follow them up and mark them signed."],
  ],
};

const TIPS: { icon: typeof LayoutGrid; title: string; text: string }[] = [
  { icon: MousePointer2, title: "Windows", text: "Every app opens in its own window. Drag a window by its top bar, resize it from any edge, double-click the bar to fill the screen. Drag it to the left or right edge to fill half." },
  { icon: LayoutGrid, title: "Mission Control", text: "The grid button in the menu bar (or F3) shows every open window side by side; click one to bring it forward. Yellow puts a window in the Dock, red closes it." },
  { icon: Keyboard, title: "Search", text: "⌘K finds an app, a client, a video or an event. ⌘-click a link to open it in a new window." },
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
        {TIPS.map((t) => (
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
