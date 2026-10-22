import type { Metadata } from "next";
import { ExternalLink, Globe, Hammer, Lock, PenLine, Search, Smartphone, Sparkles } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { canEmbed, siteStatus } from "@/lib/website";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { WindowPage } from "@/components/desktop/window-page";
import { ChangeRequest, InterestButton } from "./website-forms";

export const metadata: Metadata = { title: "Website" };

// The client's website made with Magik: a live preview when there is one, or what's coming.
export default async function WebsitePage() {
  const viewer = await requireRole("client");
  const supabase = await createClient();
  const { data: client } = viewer.clientId ? await supabase.from("clients").select("name, site_url, site_admin_url, site_status").eq("id", viewer.clientId).maybeSingle() : { data: null };
  const status = siteStatus(client?.site_status);
  const url = client?.site_url ?? null;

  if (status === "live" && url) {
    const embed = await canEmbed(url);
    const host = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return (
      <WindowPage>
        <PageHeader
          title="Your website"
          description={`${client?.name}'s website, made with Magik.`}
          actions={
            <>
              {client?.site_admin_url && (
                <a href={client.site_admin_url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.08] px-4 text-[13.5px] font-medium text-ink hover:bg-white/[0.13]">
                  <PenLine size={14} aria-hidden /> Edit my website
                </a>
              )}
              <a href={url} target="_blank" rel="noreferrer" className="glass-tint inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold">
                Open <ExternalLink size={14} aria-hidden />
              </a>
            </>
          }
        />
        <div className="overflow-hidden rounded-[18px] bg-[#1b1b1e] shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_30px_60px_-30px_rgba(0,0,0,0.8)]">
          <div className="flex items-center gap-3 border-b border-white/[0.08] bg-white/[0.04] px-4 py-2.5">
            <span aria-hidden className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            </span>
            <span className="mx-auto flex h-7 min-w-0 max-w-md flex-1 items-center justify-center gap-1.5 rounded-full bg-white/[0.07] px-3 text-[12.5px] text-ink-2">
              <Lock size={12} aria-hidden /> <span className="truncate">{host}</span>
            </span>
          </div>
          {embed ? (
            <iframe src={url} title={`${client?.name} website`} className="block h-[min(70vh,760px)] w-full bg-white" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" loading="lazy" />
          ) : (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <Globe size={44} className="text-accent" aria-hidden />
              <p className="mt-4 text-[16px] font-semibold text-ink">{host}</p>
              <p className="mt-1 max-w-sm text-[13.5px] text-muted">Your website opens in its own tab.</p>
              <a href={url} target="_blank" rel="noreferrer" className="glass-tint mt-5 inline-flex h-10 items-center gap-1.5 rounded-full px-5 text-[14px] font-semibold">
                Open your website <ExternalLink size={14} aria-hidden />
              </a>
            </div>
          )}
        </div>
        <div className="mt-5">
          <ChangeRequest />
        </div>
      </WindowPage>
    );
  }

  if (status === "building") {
    return (
      <WindowPage>
        <PageHeader title="Your website" />
        <div className="flex flex-col items-center rounded-[22px] border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-accent-soft text-accent">
            <Hammer size={30} aria-hidden />
          </span>
          <h2 className="mt-5 text-[20px] font-semibold text-ink">Your website is being built.</h2>
          <p className="mt-2 max-w-md text-[13.5px] text-muted">The studio is working on it. It will open right here as soon as it&apos;s live.</p>
          <div className="mt-6">
            <ChangeRequest />
          </div>
        </div>
      </WindowPage>
    );
  }

  return (
    <WindowPage>
      <PageHeader title="Website" />
      <div className="relative overflow-hidden rounded-[24px] px-6 py-14 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]" style={{ background: "radial-gradient(90% 80% at 50% 0%, rgba(47,107,240,0.28), transparent 60%), rgba(255,255,255,0.03)" }}>
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-[18px] bg-info-soft text-[#64b5ff]">
          <Globe size={30} aria-hidden />
        </span>
        <h2 className="mt-5 font-display text-[26px] font-bold tracking-tight text-ink">You don&apos;t have a website with Magik yet.</h2>
        <p className="mx-auto mt-2 max-w-lg text-[14px] text-ink-2">A website made to match your videos: your clients find you, see your work and book you, on any phone.</p>
        <ul className="mx-auto mt-7 grid max-w-2xl gap-3 text-left @min-[40rem]:grid-cols-3">
          {[
            { icon: Sparkles, title: "Your brand", text: "Your logo, your colors, your videos front and center." },
            { icon: Smartphone, title: "Made for phones", text: "Fast and clear where your clients are." },
            { icon: Search, title: "Easy to find", text: "Set up so people searching for you find you." },
          ].map((b) => (
            <li key={b.title} className="frost rounded-[16px] p-4">
              <b.icon size={18} className="text-accent" aria-hidden />
              <p className="mt-2 text-[13.5px] font-semibold text-ink">{b.title}</p>
              <p className="mt-0.5 text-[12.5px] text-muted">{b.text}</p>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex justify-center">
          <InterestButton />
        </div>
      </div>
    </WindowPage>
  );
}
