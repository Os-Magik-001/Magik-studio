import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedUrls } from "@/lib/storage";
import { readAnswers } from "@/lib/questionnaire";
import { PLATFORM_LABEL, type ReferencePlatform } from "@/lib/reference-links";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { QuestionnaireForm } from "@/components/agents/forms";

export const metadata: Metadata = { title: "Your brand" };

// The client's brand: their logo and colors, the videos they love, and the questionnaire.
export default async function YourBrand() {
  const viewer = await requireRole("client");
  if (!viewer.clientId) {
    return (
      <>
        <PageHeader title="Your brand" />
        <EmptyState title="Your account isn't linked to a brand yet">Ask the studio to link it.</EmptyState>
      </>
    );
  }
  const supabase = await createClient();
  const [{ data: form }, { data: kit }, { data: refs }] = await Promise.all([
    supabase.from("brand_questionnaires").select("answers").eq("client_id", viewer.clientId).maybeSingle(),
    supabase.from("brand_kits").select("logo_path, colors, fonts").eq("client_id", viewer.clientId).maybeSingle(),
    // Clients don't read reference_videos through RLS; these are their own, by client id.
    createAdminClient().from("reference_videos").select("id, url, platform, title, note").eq("client_id", viewer.clientId).is("video_id", null).order("created_at"),
  ]);
  const logo = kit?.logo_path ? (await signedUrls("brand", [kit.logo_path])).get(kit.logo_path) : null;

  return (
    <>
      <PageHeader
        title="Your brand"
        description="Your logo and colors, the videos you love, and what we know about your business. We use it all on every video we make for you."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Logo and colors" />
          <div className="flex flex-wrap items-center gap-6 p-5">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Your logo" className="h-28 w-56 rounded-[16px] bg-white object-contain p-4" />
            ) : (
              <p className="text-[13.5px] text-muted">No logo yet. Send it to the studio and we&apos;ll add it.</p>
            )}
            <div className="flex flex-col gap-2">
              {!!kit?.colors?.length && (
                <div className="flex gap-1.5">
                  {kit.colors.map((c) => (
                    <span key={c} title={c} className="h-7 w-7 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)]" style={{ background: c }} />
                  ))}
                </div>
              )}
              {!!kit?.fonts?.length && <p className="text-[13px] text-muted">{kit.fonts.join(", ")}</p>}
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Videos you love" description="The references the studio works from." />
          {refs?.length ? (
            <ul className="divide-y divide-white/[0.07]">
              {refs.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-2.5">
                  <Badge>{PLATFORM_LABEL[r.platform as ReferencePlatform] ?? "Link"}</Badge>
                  <a href={r.url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-1.5 text-[13.5px] text-ink hover:text-accent">
                    <span className="truncate">{r.title ?? r.url}</span> <ExternalLink size={12} className="shrink-0" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-4 text-[13.5px] text-muted">None yet.</p>
          )}
        </Card>
      </div>
      <Card className="mt-5">
        <CardHeader title="Questionnaire" description="Answer what you can. You can come back and change it any time." />
        <div className="p-5">
          <QuestionnaireForm answers={readAnswers(form?.answers)} submitLabel={form ? "Update my answers" : "Send my answers"} />
        </div>
      </Card>
    </>
  );
}
