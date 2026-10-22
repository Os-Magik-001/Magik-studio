import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { SetupFrame, Hello } from "@/components/setup/setup-frame";
import { ReferralForm } from "./referral-form";

export const instant = false;

export const metadata: Metadata = { title: "You're invited to Magik", robots: { index: false, follow: false } };

// Someone's referral link: the people they refer leave their details for the studio. Public.
export default async function ReferralPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const valid = /^[0-9a-z]{4,16}$/i.test(code);
  const { data: referrer } = valid
    ? await createAdminClient().from("profiles").select("full_name, email, paused_at").eq("referral_code", code.toLowerCase()).maybeSingle()
    : { data: null };
  // First name only: the page is public.
  const first = referrer && !referrer.paused_at ? (referrer.full_name ?? referrer.email.split("@")[0]).split(/\s+/)[0] : null;
  return (
    <SetupFrame>
      <div className="flex flex-1 flex-col items-center py-4 text-center">
        <Hello word="welcome" />
        {first ? (
          <>
            <h1 className="mt-2 font-display text-[30px] leading-tight font-bold tracking-tight text-ink">{first} thinks Magik can help your business.</h1>
            <p className="mt-3 max-w-lg text-[15px] text-ink-2">
              Magik Studio makes the videos that bring businesses their clients: strategy, scripts, shoots and editing. Leave your details and the studio will reach out.
            </p>
            <div className="mt-8 w-full max-w-md text-left">
              <ReferralForm code={code.toLowerCase()} />
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-2 font-display text-[30px] font-bold tracking-tight text-ink">This invitation link doesn&apos;t work.</h1>
            <p className="mt-3 max-w-md text-[14.5px] text-ink-2">Ask the person who sent it for a new one, or write to the studio directly.</p>
          </>
        )}
      </div>
    </SetupFrame>
  );
}
