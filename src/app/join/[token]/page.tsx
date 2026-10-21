import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { inviteByToken } from "@/lib/invites";
import { formatMoney } from "@/lib/onboarding";
import { LinkButton } from "@/components/ui";
import { SetupFrame } from "@/components/setup/setup-frame";
import { JoinFlow } from "./join-flow";

export const instant = false;

export const metadata: Metadata = { title: "Welcome to Magik", robots: { index: false, follow: false } };

// The link a seller sends a new client. Public: it opens before the client has an account.
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await inviteByToken(token);

  if (!invite || invite.state !== "active") {
    const used = invite?.state === "used";
    return (
      <SetupFrame>
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <h1 className="font-display text-[30px] font-bold tracking-tight text-ink">
            {used ? "Your account is already open" : invite ? "This link has expired" : "This link doesn't work"}
          </h1>
          <p className="mt-3 max-w-md text-[14.5px] text-ink-2">
            {used
              ? "This link was used to open your account. Sign in to pick up where you left off."
              : "For your security, links stop working after a while. Ask your contact at Magik for a new one: it takes them a second."}
          </p>
          <LinkButton href={used ? "/login?next=/setup" : "/login"} variant={used ? "primary" : "secondary"} className="mt-7">
            Sign in
          </LinkButton>
        </div>
      </SetupFrame>
    );
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const pack = invite.client.packs;
  return (
    <SetupFrame>
      <JoinFlow
        token={token}
        language={invite.client.language === "en" ? "en" : "fr"}
        clientName={invite.client.name}
        contactName={invite.client.contact_name ?? ""}
        email={invite.client.email ?? invite.email ?? ""}
        pack={pack ? `${pack.name} · ${formatMoney(pack.price_cents, "CAD")}${pack.billing === "monthly" ? " a month" : ""}` : null}
        signedInAs={typeof claims?.claims?.email === "string" ? claims.claims.email : null}
      />
    </SetupFrame>
  );
}
