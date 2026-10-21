import "server-only";
import type { Viewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PHASES, phaseOf } from "@/lib/pipeline";
import { currentStep, waitingOn, type OnboardingFacts } from "@/lib/onboarding";

// What the desktop's widgets show, for the viewer's role. Everything goes through RLS.

export type DesktopStat = { label: string; value: number; href: string; tone?: "accent" | "neutral" | "success" };
export type DesktopFeedItem = { id: string; title: string; body: string | null; at: string; href: string | null; unread: boolean };
export type DesktopData = {
  stats: DesktopStat[];
  statsTitle: string;
  feed: DesktopFeedItem[];
  unread: number;
};

export async function desktopData(viewer: Viewer): Promise<DesktopData> {
  const supabase = await createClient();

  const [notes, unread] = await Promise.all([
    supabase.from("notifications").select("id, title, body, kind, read_at, created_at, video_id").order("created_at", { ascending: false }).limit(4),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);

  const hrefFor = (n: { video_id: string | null; kind: string }) => {
    if (!n.video_id) return viewer.role === "seller" || viewer.role === "admin" ? (n.kind.startsWith("onboarding") ? "/onboarding" : null) : null;
    if (viewer.role === "client") return `/review/${n.video_id}`;
    if (viewer.role === "videographer") return `/shoots/${n.video_id}`;
    return ["comment", "version_ready", "version_sent", "approved", "changes_requested"].includes(n.kind) ? `/review/${n.video_id}` : `/videos/${n.video_id}`;
  };
  const feed = (notes.data ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    at: n.created_at,
    href: hrefFor(n),
    unread: !n.read_at,
  }));

  let stats: DesktopStat[] = [];
  let statsTitle = "Today";

  if (viewer.role === "admin" || viewer.role === "editor") {
    const { data: videos } = await supabase.from("videos").select("status").neq("status", "delivered");
    const counts = new Map<string, number>();
    for (const v of videos ?? []) counts.set(phaseOf(v.status).key, (counts.get(phaseOf(v.status).key) ?? 0) + 1);
    statsTitle = "In production";
    stats = PHASES.filter((p) => p.key !== "done").map((p) => ({
      label: p.label,
      value: counts.get(p.key) ?? 0,
      href: "/pipeline",
      tone: p.key === "edit" ? ("accent" as const) : ("neutral" as const),
    }));
  } else if (viewer.role === "seller") {
    stats = await onboardingStats();
    statsTitle = "Onboarding";
  } else if (viewer.role === "videographer") {
    const now = new Date().toISOString();
    const [{ count: upcoming }, { count: shooting }] = await Promise.all([
      supabase.from("shoots").select("id", { count: "exact", head: true }).gte("starts_at", now),
      supabase.from("videos").select("id", { count: "exact", head: true }).eq("status", "shoot"),
    ]);
    statsTitle = "Shoots";
    stats = [
      { label: "Upcoming shoots", value: upcoming ?? 0, href: "/shoots", tone: "accent" },
      { label: "Footage to send", value: shooting ?? 0, href: "/shoots" },
    ];
  } else {
    const { data: videos } = await supabase.from("videos").select("status");
    const list = videos ?? [];
    statsTitle = "Your videos";
    stats = [
      { label: "To review", value: list.filter((v) => v.status === "client_review").length, href: "/review", tone: "accent" },
      { label: "In production", value: list.filter((v) => !["client_review", "approved", "delivered"].includes(v.status)).length, href: "/review" },
      { label: "Delivered", value: list.filter((v) => v.status === "delivered" || v.status === "approved").length, href: "/review", tone: "success" },
    ];
  }

  if (viewer.role === "admin") {
    // The studio manager sees both: production, then onboarding.
    stats = [...stats, ...(await onboardingStats()).slice(0, 2)];
  }

  return { stats, statsTitle, feed, unread: unread.count ?? 0 };
}

async function onboardingStats(): Promise<DesktopStat[]> {
  const facts = await onboardingFacts();
  const open = facts.filter((f) => f.step !== "done");
  return [
    { label: "Onboarding", value: open.length, href: "/onboarding", tone: "accent" },
    { label: "Waiting on clients", value: open.filter((f) => f.waiting === "client").length, href: "/onboarding" },
    { label: "Ready to send", value: open.filter((f) => f.step === "link").length, href: "/onboarding", tone: "success" },
  ];
}

// Every onboarding the viewer can see, with where it stands. Used by the desktop and the app.
export async function onboardingFacts() {
  const supabase = await createClient();
  const [{ data: rows }, { data: invoices }, { data: contracts }, { data: invites }, { data: accounts }] = await Promise.all([
    supabase.from("onboardings").select("client_id, questions_done_at, references_done_at, brand_done_at, completed_at, created_at, clients(id, name, contact_name, email, pack_id, seller_id)"),
    supabase.from("invoices").select("client_id, status, created_at").order("created_at", { ascending: false }),
    supabase.from("contracts").select("client_id, status, created_at").order("created_at", { ascending: false }),
    supabase.from("client_invites").select("client_id, sent_at, opened_at, used_at, expires_at, revoked_at, created_at").order("created_at", { ascending: false }),
    supabase.from("profiles").select("client_id").eq("role", "client"),
  ]);
  const first = <T extends { client_id: string }>(list: T[] | null, id: string) => list?.find((x) => x.client_id === id) ?? null;
  return (rows ?? [])
    .filter((r) => r.clients)
    .map((r) => {
      const c = r.clients!;
      const facts: OnboardingFacts = {
        hasInfos: !!(c.contact_name && c.email),
        packId: c.pack_id,
        invoice: first(invoices, c.id),
        contract: first(contracts, c.id),
        invite: first(invites, c.id),
        hasAccount: !!accounts?.some((a) => a.client_id === c.id),
        progress: r,
      };
      return { client: c, createdAt: r.created_at, facts, step: currentStep(facts), waiting: waitingOn(facts) };
    });
}
