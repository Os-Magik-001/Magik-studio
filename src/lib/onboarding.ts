// Client onboarding (Magik OS — Client Onboarding Process, 2026-10-21): the seller sets the
// client up, then one link hands over to the client, who finishes with their brand.
// Shared by the Onboarding app, the desktop and the client's setup assistant, so they always
// agree on where a client is.

export type Lane = "seller" | "client";

export const STEPS = [
  { key: "infos", lane: "seller", label: "Client infos", hint: "Details entered" },
  // Before the invoice, so the invoice can bill the pack's price.
  { key: "pack", lane: "seller", label: "Choose pack", hint: "The offer sold" },
  { key: "invoice", lane: "seller", label: "Invoice", hint: "Generated from the pack" },
  { key: "contract", lane: "seller", label: "Contract", hint: "Added to the file" },
  { key: "link", lane: "seller", label: "Send link", hint: "To the client" },
  { key: "opened", lane: "client", label: "Get link", hint: "From the seller" },
  { key: "account", lane: "client", label: "Open account", hint: "Client login" },
  { key: "questions", lane: "client", label: "Questions", hint: "One at a time" },
  { key: "references", lane: "client", label: "References", hint: "Videos to match" },
  { key: "brand", lane: "client", label: "Brand setup", hint: "Logo uploaded or created" },
] as const satisfies readonly { key: string; lane: Lane; label: string; hint: string }[];

export type StepKey = (typeof STEPS)[number]["key"];

export type OnboardingFacts = {
  hasInfos: boolean;
  packId: string | null;
  invoice: { status: string } | null;
  contract: { status: string } | null;
  invite: { sent_at: string | null; opened_at: string | null; used_at: string | null; expires_at: string; revoked_at: string | null } | null;
  hasAccount: boolean;
  progress: { questions_done_at: string | null; references_done_at: string | null; brand_done_at: string | null; completed_at: string | null } | null;
};

export function stepsDone(f: OnboardingFacts): Record<StepKey, boolean> {
  const p = f.progress;
  const account = f.hasAccount || !!f.invite?.used_at;
  return {
    infos: f.hasInfos,
    pack: !!f.packId,
    invoice: !!f.invoice && f.invoice.status !== "void",
    contract: !!f.contract,
    link: !!f.invite?.sent_at || account,
    opened: !!f.invite?.opened_at || account,
    account,
    questions: !!p?.questions_done_at,
    references: !!p?.references_done_at,
    brand: !!p?.brand_done_at,
  };
}

// The first step not done yet, in order; "done" once the client has finished.
export function currentStep(f: OnboardingFacts): StepKey | "done" {
  if (f.progress?.completed_at) return "done";
  const done = stepsDone(f);
  return STEPS.find((s) => !done[s.key])?.key ?? "done";
}

export const stepByKey = (key: StepKey) => STEPS.find((s) => s.key === key)!;

// Who the onboarding is waiting on.
export function waitingOn(f: OnboardingFacts): Lane | "done" {
  const step = currentStep(f);
  return step === "done" ? "done" : stepByKey(step).lane;
}

// The link: valid for 14 days by default, single use; a new link revokes the one before.
export const LINK_DAYS = [7, 14, 30] as const;
export const DEFAULT_LINK_DAYS = 14;

export function linkState(invite: OnboardingFacts["invite"], now = Date.now()) {
  if (!invite) return "none" as const;
  if (invite.used_at) return "used" as const;
  if (invite.revoked_at) return "revoked" as const;
  if (new Date(invite.expires_at).getTime() <= now) return "expired" as const;
  return "active" as const;
}

// The brand questions the client answers one at a time. Colors, fonts and references have
// their own steps (brand, references), so they're left out here.
export const SETUP_QUESTION_KEYS = [
  "business",
  "offer",
  "audience",
  "goals",
  "tone",
  "concept",
  "handle",
  "languages",
  "platforms",
  "music",
  "avoid",
] as const;

// The first four are needed for the brand strategist; the rest can be skipped.
export const REQUIRED_SETUP_QUESTIONS = 4;

// Money is kept in cents.
export function formatMoney(cents: number, currency = "CAD", locale = "en-CA") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}
