import "server-only";
import type { Viewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { PHASES, phaseOf } from "@/lib/pipeline";
import { currentStep, stepByKey, stepsDone, waitingOn, STEPS, type OnboardingFacts } from "@/lib/onboarding";
import { videoStatusIndex, videoStatusLabel, VIDEO_STATUSES, type VideoStatus } from "@/lib/workflow";

// What Home (the command center) shows, for the viewer's role. Everything the viewer reads
// goes through RLS, except where noted.

export type TodayItem = { at: string; allDay: boolean; title: string; detail: string; href: string; tone: "accent" | "info" | "danger" | "neutral" };
export type Kpi = { label: string; value: string; href: string; tone?: "accent" | "success" };
export type Overview = { title: string; label: string; value: string; delta: number | null; chart: { label: string; value: number }[]; kpis: Kpi[]; money: boolean };
export type VideoRow = { id: string; title: string; client: string; status: VideoStatus; statusLabel: string; progress: number; due: string | null; href: string };
export type OnboardingRow = { id: string; name: string; contact: string; label: string; waiting: "seller" | "client" | "done"; done: number; href: string };
export type ActivityRow = { id: string; title: string; body: string | null; at: string; href: string | null; unread: boolean };
export type InvoiceRow = { id: string; number: string; client: string; total: number; currency: string; status: string; due: string | null };

export type HomeData = {
  today: TodayItem[];
  overview: Overview | null;
  production: { rows: VideoRow[]; deadlines: VideoRow[] } | null;
  onboarding: { rows: OnboardingRow[]; open: number; waiting: number } | null;
  invoices: { rows: InvoiceRow[]; outstanding: number; currency: string } | null;
  activity: ActivityRow[];
  client: {
    videos: VideoRow[];
    toReview: number;
    logo: string | null;
    colors: string[];
    fonts: string[];
    invoice: InvoiceRow | null;
    contract: { name: string; signed: boolean } | null;
  } | null;
};

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString();
// Calendar dates (due dates) are compared in the studio's time zone.
const localDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(d);

function progressOf(status: VideoStatus) {
  return Math.round(((videoStatusIndex(status) + 1) / VIDEO_STATUSES.length) * 100);
}

function weeks(count: number) {
  // Monday-started weeks, oldest first.
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: count }, (_, i) => {
    const start = new Date(monday.getTime() - (count - 1 - i) * 7 * DAY);
    return { start, end: new Date(start.getTime() + 7 * DAY) };
  });
}

const fmtMoney = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);

export async function homeData(viewer: Viewer): Promise<HomeData> {
  const supabase = await createClient();
  const role = viewer.role;
  const staff = role === "admin" || role === "editor";
  const sales = role === "admin" || role === "seller";
  const today = localDay(new Date());
  const weekAhead = localDay(new Date(Date.now() + 7 * DAY));

  const [notes, videos, shoots, invoices] = await Promise.all([
    supabase.from("notifications").select("id, title, body, kind, read_at, created_at, video_id").order("created_at", { ascending: false }).limit(5),
    role === "seller"
      ? Promise.resolve({ data: [] as { id: string; title: string; status: VideoStatus; due_on: string | null; updated_at: string; clients: { name: string } | null }[] })
      : supabase.from("videos").select("id, title, status, due_on, updated_at, clients(name)").order("updated_at", { ascending: false }).limit(200),
    role === "seller"
      ? Promise.resolve({ data: [] as { id: string; video_id: string; starts_at: string; location: string | null; videos: { title: string } | null }[] })
      : supabase.from("shoots").select("id, video_id, starts_at, location, videos(title)").gte("starts_at", iso(new Date(Date.now() - 3 * 3600_000))).order("starts_at").limit(8),
    sales || role === "client"
      ? supabase.from("invoices").select("id, number, status, total_cents, currency, issued_on, due_on, clients(name)").neq("status", "void").order("created_at", { ascending: false }).limit(200)
      : Promise.resolve({ data: [] as { id: string; number: string; status: string; total_cents: number; currency: string; issued_on: string; due_on: string | null; clients: { name: string } | null }[] }),
  ]);

  const videoHref = (id: string) => (role === "client" ? `/review/${id}` : role === "videographer" ? `/shoots/${id}` : `/videos/${id}`);
  const rowOf = (v: { id: string; title: string; status: VideoStatus; due_on: string | null; clients: { name: string } | null }): VideoRow => ({
    id: v.id,
    title: v.title,
    client: v.clients?.name ?? "",
    status: v.status,
    statusLabel: videoStatusLabel(v.status),
    progress: progressOf(v.status),
    due: v.due_on,
    href: videoHref(v.id),
  });
  const allVideos = videos.data ?? [];
  const open = allVideos.filter((v) => v.status !== "delivered");

  // ------------------------------------------------------------ activity
  const activityHref = (n: { video_id: string | null; kind: string }) => {
    if (!n.video_id) return sales && n.kind.startsWith("onboarding") ? "/onboarding" : "/notifications";
    if (role === "client") return `/review/${n.video_id}`;
    if (role === "videographer") return `/shoots/${n.video_id}`;
    return ["comment", "version_ready", "version_sent", "approved", "changes_requested"].includes(n.kind) ? `/review/${n.video_id}` : `/videos/${n.video_id}`;
  };
  const activity = (notes.data ?? []).map((n) => ({ id: n.id, title: n.title, body: n.body, at: n.created_at, href: activityHref(n), unread: !n.read_at }));

  // ------------------------------------------------------------ today
  const items: TodayItem[] = [];
  for (const s of shoots.data ?? []) {
    items.push({
      at: s.starts_at,
      allDay: false,
      title: `Shoot · ${s.videos?.title ?? "Video"}`,
      detail: s.location ?? "Location to confirm",
      href: role === "client" ? `/review/${s.video_id}` : `/shoots/${s.video_id}`,
      tone: "accent",
    });
  }
  for (const v of open) {
    if (v.due_on && v.due_on >= today && v.due_on <= weekAhead) {
      items.push({ at: `${v.due_on}T23:59:00`, allDay: true, title: `Due · ${v.title}`, detail: v.clients?.name ?? videoStatusLabel(v.status), href: videoHref(v.id), tone: "info" });
    }
  }
  for (const inv of invoices.data ?? []) {
    if (sales && inv.due_on && (inv.status === "issued" || inv.status === "sent") && inv.due_on <= weekAhead) {
      items.push({
        at: `${inv.due_on}T23:58:00`,
        allDay: true,
        title: `Invoice ${inv.number} due`,
        detail: `${inv.clients?.name ?? ""} · ${fmtMoney(inv.total_cents, inv.currency)}`,
        href: "/onboarding/invoices",
        tone: inv.due_on < today ? "danger" : "neutral",
      });
    }
  }
  items.sort((a, b) => a.at.localeCompare(b.at));

  // ------------------------------------------------------------ money (sales)
  const allInvoices = invoices.data ?? [];
  const currency = allInvoices[0]?.currency ?? "CAD";
  const monthStart = today.slice(0, 8) + "01";
  const lastMonthStart = localDay(new Date(new Date(monthStart + "T12:00:00").getTime() - 20 * DAY)).slice(0, 8) + "01";
  const sum = (rows: typeof allInvoices) => rows.reduce((s, i) => s + i.total_cents, 0);
  const thisMonth = sum(allInvoices.filter((i) => i.issued_on >= monthStart));
  const lastMonth = sum(allInvoices.filter((i) => i.issued_on >= lastMonthStart && i.issued_on < monthStart));
  const weekly = weeks(8).map((w) => ({
    label: w.start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: sum(allInvoices.filter((i) => i.issued_on >= localDay(w.start) && i.issued_on < localDay(w.end))) / 100,
  }));

  // ------------------------------------------------------------ per role
  let overview: Overview | null = null;
  let production: HomeData["production"] = null;
  let onboarding: HomeData["onboarding"] = null;
  let invoicePanel: HomeData["invoices"] = null;
  let client: HomeData["client"] = null;

  if (staff || role === "videographer") {
    const byDue = [...open].sort((a, b) => (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999"));
    production = {
      rows: open.slice(0, 5).map(rowOf),
      deadlines: byDue.filter((v) => v.due_on).slice(0, 4).map(rowOf),
    };
  }

  if (sales) {
    const facts = await onboardingFacts();
    const inProgress = facts.filter((f) => f.step !== "done").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    onboarding = {
      rows: inProgress.slice(0, 4).map((f) => ({
        id: f.client.id,
        name: f.client.name,
        contact: f.client.contact_name ?? f.client.email ?? "",
        label: f.step === "done" ? "Finished" : stepByKey(f.step).label,
        waiting: f.waiting,
        done: STEPS.filter((s) => stepsDone(f.facts)[s.key]).length,
        href: `/onboarding/${f.client.id}`,
      })),
      open: inProgress.length,
      waiting: inProgress.filter((f) => f.waiting === "client").length,
    };
    const outstanding = allInvoices.filter((i) => i.status === "issued" || i.status === "sent");
    invoicePanel = {
      rows: outstanding.slice(0, 5).map((i) => ({ id: i.id, number: i.number, client: i.clients?.name ?? "", total: i.total_cents, currency: i.currency, status: i.status, due: i.due_on })),
      outstanding: sum(outstanding),
      currency,
    };
  }

  if (role === "admin" || role === "seller") {
    const delta = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;
    const [{ count: clients }, { count: team }] = await Promise.all([
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).neq("role", "client"),
    ]);
    const delivered30 = allVideos.filter((v) => v.status === "delivered" && Date.now() - new Date(v.updated_at).getTime() < 30 * DAY).length;
    overview = {
      title: "Studio overview",
      label: "Invoiced this month",
      value: fmtMoney(thisMonth, currency),
      delta,
      chart: weekly,
      money: true,
      kpis:
        role === "admin"
          ? [
              { label: "Clients", value: String(clients ?? 0), href: "/clients" },
              { label: "In production", value: String(open.length), href: "/pipeline", tone: "accent" },
              { label: "Delivered · 30 days", value: String(delivered30), href: "/pipeline", tone: "success" },
              { label: "Team", value: String(team ?? 0), href: "/team" },
            ]
          : [
              { label: "Onboarding", value: String(onboarding?.open ?? 0), href: "/onboarding", tone: "accent" },
              { label: "Waiting on clients", value: String(onboarding?.waiting ?? 0), href: "/onboarding" },
              { label: "Outstanding", value: fmtMoney(invoicePanel?.outstanding ?? 0, currency), href: "/onboarding/invoices" },
              { label: "Clients", value: String(clients ?? 0), href: "/onboarding?show=done" },
            ],
    };
  } else if (role === "editor") {
    const deliveries = weeks(8).map((w) => ({
      label: w.start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: allVideos.filter((v) => v.status === "delivered" && v.updated_at >= iso(w.start) && v.updated_at < iso(w.end)).length,
    }));
    const counts = new Map<string, number>();
    for (const v of open) counts.set(phaseOf(v.status).key, (counts.get(phaseOf(v.status).key) ?? 0) + 1);
    overview = {
      title: "Studio overview",
      label: "Videos in production",
      value: String(open.length),
      delta: null,
      chart: deliveries,
      money: false,
      kpis: PHASES.filter((p) => p.key !== "done").map((p) => ({ label: p.label, value: String(counts.get(p.key) ?? 0), href: "/pipeline", tone: p.key === "edit" ? ("accent" as const) : undefined })),
    };
  }

  if (role === "client" && viewer.clientId) {
    const [{ data: kit }, { data: contracts }] = await Promise.all([
      supabase.from("brand_kits").select("logo_path, colors, fonts").eq("client_id", viewer.clientId).maybeSingle(),
      supabase.from("contracts").select("file_name, status").order("created_at", { ascending: false }).limit(1),
    ]);
    const logo = kit?.logo_path ? ((await signedUrls("brand", [kit.logo_path])).get(kit.logo_path) ?? null) : null;
    const inv = allInvoices[0];
    const mine = [...allVideos].sort((a, b) => Number(b.status === "client_review") - Number(a.status === "client_review"));
    client = {
      videos: mine.slice(0, 5).map(rowOf),
      toReview: allVideos.filter((v) => v.status === "client_review").length,
      logo,
      colors: kit?.colors ?? [],
      fonts: kit?.fonts ?? [],
      invoice: inv ? { id: inv.id, number: inv.number, client: "", total: inv.total_cents, currency: inv.currency, status: inv.status, due: inv.due_on } : null,
      contract: contracts?.[0] ? { name: contracts[0].file_name, signed: contracts[0].status === "signed" } : null,
    };
  }

  return { today: items.slice(0, 6), overview, production, onboarding, invoices: invoicePanel, activity, client };
}

// Every onboarding the viewer can see, with where it stands. Used by Home and the Onboarding app.
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
        invoice: first(invoices?.filter((i) => i.status !== "void") ?? null, c.id),
        contract: first(contracts, c.id),
        invite: first(invites, c.id),
        hasAccount: !!accounts?.some((a) => a.client_id === c.id),
        progress: r,
      };
      return { client: c, createdAt: r.created_at, facts, step: currentStep(facts), waiting: waitingOn(facts) };
    });
}
