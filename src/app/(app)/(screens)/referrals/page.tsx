import type { Metadata } from "next";
import { headers } from "next/headers";
import { Coins, Gift, Send, Sparkles } from "lucide-react";
import { displayName, getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { LocalDate } from "@/components/local-date";
import { WindowPage } from "@/components/desktop/window-page";
import { AdjustCredits, ReferSomeone, ReferralLink, ReferralStatus } from "./referral-tools";

export const metadata: Metadata = { title: "Referrals" };

const STATUS: Record<string, { label: string; tone: "neutral" | "accent" | "success" | "warning" | "danger" }> = {
  new: { label: "With the studio", tone: "accent" },
  contacted: { label: "In talks", tone: "warning" },
  signed: { label: "Signed", tone: "success" },
  declined: { label: "Not this time", tone: "neutral" },
};

// Everyone's referral link and credits; for sales, every referral to follow up.
export default async function ReferralsPage() {
  const viewer = await getViewer();
  const sales = viewer.role === "admin" || viewer.role === "seller";
  const supabase = await createClient();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const url = `${proto}://${host}/r/${viewer.referralCode}`;

  const [{ data: mine }, { data: ledger }, { data: studio }, { data: all }, { data: people }] = await Promise.all([
    supabase.from("referrals").select("id, name, company, status, credits, created_at").eq("referrer_id", viewer.id).order("created_at", { ascending: false }),
    supabase.from("credit_ledger").select("id, amount, reason, created_at").eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("studio_settings").select("referral_reward").maybeSingle(),
    sales
      ? supabase.from("referrals").select("id, name, company, email, phone, message, status, credits, created_at, referrer:profiles!referrals_referrer_id_fkey(full_name, email)").order("created_at", { ascending: false }).limit(200)
      : Promise.resolve({ data: null }),
    viewer.role === "admin" ? supabase.from("profiles").select("id, full_name, email").order("full_name") : Promise.resolve({ data: null }),
  ]);
  const balance = (ledger ?? []).reduce((s, l) => s + l.amount, 0);
  const reward = studio?.referral_reward ?? 0;
  const signed = (mine ?? []).filter((r) => r.status === "signed").length;

  return (
    <WindowPage>
      <PageHeader title="Referrals" description="Know a business that needs videos? Share your link. When they sign with Magik, you earn credits." />

      <div className="grid gap-5 @min-[56rem]:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <section className="relative overflow-hidden rounded-[22px] p-6 shadow-[inset_0_0_0_1px_rgba(246,212,58,0.35)]" style={{ background: "linear-gradient(135deg, rgba(246,212,58,0.22), rgba(217,166,12,0.06) 55%, rgba(0,0,0,0.2))" }}>
          <Coins size={120} className="pointer-events-none absolute -right-6 -bottom-8 text-accent/10" aria-hidden />
          <p className="text-[13px] font-medium text-accent">Your credits</p>
          <p className="mt-1 font-display text-[54px] leading-none font-bold tracking-tight text-ink tabular-nums">{balance.toLocaleString()}</p>
          <p className="mt-3 text-[13.5px] text-ink-2">
            {signed ? `${signed} referral${signed > 1 ? "s" : ""} signed so far. Thank you!` : reward ? `Each business you refer that signs earns you ${reward} credits.` : "Each business you refer that signs earns you credits."}
          </p>
          <p className="mt-1 text-[12.5px] text-muted">Your credits are kept by the studio; ask your Magik contact how to use them.</p>
        </section>

        <Card>
          <CardHeader title="Your link" description="Anyone who opens it can leave their details for the studio, with your name on it." />
          <div className="p-5">
            <ReferralLink url={url} name={displayName(viewer)} />
          </div>
        </Card>
      </div>

      <ol className="mt-5 grid gap-3 @min-[48rem]:grid-cols-3">
        {[
          { icon: Send, title: "Share your link", text: "By email, text or social, or refer them below." },
          { icon: Sparkles, title: "The studio talks to them", text: "We follow up quickly and keep you posted here." },
          { icon: Gift, title: reward ? `They sign: +${reward} credits` : "They sign: credits for you", text: "Credits land in your account right away." },
        ].map((s, i) => (
          <li key={s.title} className="frost flex items-start gap-3 rounded-[16px] p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <s.icon size={17} aria-hidden />
            </span>
            <span>
              <span className="block text-[13.5px] font-semibold text-ink">
                {i + 1}. {s.title}
              </span>
              <span className="mt-0.5 block text-[12.5px] text-muted">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-5 grid gap-5 @min-[64rem]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Refer someone" description="Give the studio their details yourself." />
          <div className="p-5">
            <ReferSomeone />
          </div>
        </Card>
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="Your referrals" />
            {mine?.length ? (
              <ul className="divide-y divide-white/[0.07]">
                {mine.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-ink">{r.company ?? r.name}</p>
                      <p className="truncate text-[12.5px] text-muted">
                        {r.company ? `${r.name} · ` : ""}
                        <LocalDate value={r.created_at} preset="date" />
                      </p>
                    </div>
                    {r.credits > 0 && <span className="text-[13px] font-semibold text-accent tabular-nums">+{r.credits}</span>}
                    <Badge tone={STATUS[r.status]?.tone ?? "neutral"}>{STATUS[r.status]?.label ?? r.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-5">
                <EmptyState title="No referrals yet">Share your link: the businesses you refer show up here.</EmptyState>
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title="Credit history" />
            {ledger?.length ? (
              <ul className="divide-y divide-white/[0.07]">
                {ledger.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] text-ink">{l.reason}</p>
                      <p className="text-[12px] text-muted">
                        <LocalDate value={l.created_at} preset="date" />
                      </p>
                    </div>
                    <span className={l.amount > 0 ? "text-[14px] font-semibold text-success tabular-nums" : "text-[14px] font-semibold text-danger tabular-nums"}>
                      {l.amount > 0 ? "+" : ""}
                      {l.amount}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-5 text-[13.5px] text-muted">No credits yet.</p>
            )}
          </Card>
        </div>
      </div>

      {sales && (
        <Card className="mt-6">
          <CardHeader title="Every referral" description="Follow each one up. Marking one signed gives its referrer their credits, once." />
          {all?.length ? (
            <ul className="divide-y divide-white/[0.07]">
              {all.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 px-5 py-3 @min-[48rem]:flex-row @min-[48rem]:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">
                      {r.company ? `${r.company} · ` : ""}
                      {r.name}
                    </p>
                    <p className="truncate text-[12.5px] text-muted">
                      {[r.email, r.phone].filter(Boolean).join(" · ")}
                      {r.referrer ? ` · referred by ${displayName(r.referrer)}` : ""}
                    </p>
                    {r.message && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-2">{r.message}</p>}
                  </div>
                  <span className="shrink-0 text-[12px] text-muted">
                    <LocalDate value={r.created_at} preset="date" />
                  </span>
                  <ReferralStatus id={r.id} status={r.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-5 text-[13.5px] text-muted">No referrals yet.</p>
          )}
        </Card>
      )}

      {viewer.role === "admin" && people && (
        <Card className="mt-6">
          <CardHeader title="Give or take credits" description="A thank-you, a correction, or credits someone used." />
          <div className="max-w-xl p-5">
            <AdjustCredits people={people.map((p) => ({ id: p.id, name: displayName(p) }))} />
          </div>
        </Card>
      )}
    </WindowPage>
  );
}
