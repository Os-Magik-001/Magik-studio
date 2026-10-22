"use server";

import { refresh } from "next/cache";
import { getViewer, requireRole } from "@/lib/auth";
import { deliver } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { done, fail, optionalText, text, type ActionResult } from "@/lib/action-result";

// Referrals: everyone has a link (/r/<code>); the businesses they refer become leads for sales,
// and a referral that signs earns the referrer credits (studio_settings.referral_reward).

const EMAIL = /^\S+@\S+\.\S+$/;

type Lead = { name: string; company: string | null; email: string | null; phone: string | null; message: string | null };

function readLead(formData: FormData): Lead | string {
  const name = text(formData, "name").slice(0, 120);
  const company = optionalText(formData, "company")?.slice(0, 160) ?? null;
  const email = optionalText(formData, "email")?.toLowerCase().slice(0, 200) ?? null;
  const phone = optionalText(formData, "phone")?.slice(0, 40) ?? null;
  const message = optionalText(formData, "message")?.slice(0, 2000) ?? null;
  if (!name) return "Enter a name.";
  if (!email && !phone) return "Enter an email or a phone number, so the studio can reach them.";
  if (email && !EMAIL.test(email)) return "Enter a valid email address.";
  return { name, company, email, phone, message };
}

async function salesTeam() {
  const { data } = await createAdminClient().from("profiles").select("id").in("role", ["admin", "seller"]).is("paused_at", null);
  return (data ?? []).map((p) => p.id);
}

async function record(referrerId: string, referrerName: string, lead: Lead, via: "link" | "app") {
  const admin = createAdminClient();
  // A handful a day per person is plenty; more is a script.
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await admin.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", referrerId).gte("created_at", since);
  if ((count ?? 0) >= 20) return "Too many referrals today. Try again tomorrow.";
  const { data, error } = await admin
    .from("referrals")
    .insert({ referrer_id: referrerId, ...lead })
    .select("id")
    .single();
  if (error || !data) return "Couldn't save the referral.";
  const who = lead.company ? `${lead.name} (${lead.company})` : lead.name;
  await deliver(
    (await salesTeam())
      .filter((id) => id !== referrerId)
      .map((user_id) => ({
        user_id,
        kind: "referral_new",
        title: `New referral from ${referrerName}: ${who}`,
        body: [lead.email, lead.phone, lead.message].filter(Boolean).join(" · ") || null,
      })),
  );
  if (via === "link") {
    await deliver([{ user_id: referrerId, kind: "referral_received", title: `${who} used your referral link`, body: "The studio will reach out. You'll earn credits when they sign." }]);
  }
  return null;
}

// The form on someone's referral page (/r/<code>): no account needed.
export async function submitReferral(_: ActionResult, formData: FormData): Promise<ActionResult> {
  // A field people never see: bots fill it.
  if (text(formData, "website")) return done("Thanks! The studio will be in touch.");
  const code = text(formData, "code").toLowerCase();
  if (!/^[0-9a-z]{4,16}$/.test(code)) return fail("This referral link isn't valid.");
  const lead = readLead(formData);
  if (typeof lead === "string") return fail(lead);
  const { data: referrer } = await createAdminClient().from("profiles").select("id, full_name, email, paused_at").eq("referral_code", code).maybeSingle();
  if (!referrer || referrer.paused_at) return fail("This referral link isn't valid anymore.");
  const problem = await record(referrer.id, referrer.full_name ?? referrer.email.split("@")[0], lead, "link");
  if (problem) return fail(problem);
  return done("Thanks! The studio will be in touch very soon.");
}

// Someone refers a business from the Referrals app.
export async function addReferral(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  const lead = readLead(formData);
  if (typeof lead === "string") return fail(lead);
  const problem = await record(viewer.id, viewer.fullName ?? viewer.email.split("@")[0], lead, "app");
  if (problem) return fail(problem);
  refresh();
  return done(`Thanks! ${lead.name} is with the studio now. You'll earn credits when they sign.`);
}

// Sales follow a referral up; "signed" gives the referrer their credits, once.
export async function setReferralStatus(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "seller");
  const id = text(formData, "id");
  const status = text(formData, "status");
  if (!["new", "contacted", "signed", "declined"].includes(status)) return fail("Pick a status.");
  const admin = createAdminClient();
  const { data: ref } = await admin.from("referrals").select("id, referrer_id, name, company, credits, status").eq("id", id).maybeSingle();
  if (!ref) return fail("Unknown referral.");
  const patch: { status: string; credits?: number } = { status };
  let given = 0;
  if (status === "signed" && ref.credits === 0 && ref.referrer_id) {
    const { data: studio } = await admin.from("studio_settings").select("referral_reward").maybeSingle();
    given = studio?.referral_reward ?? 0;
    if (given > 0) {
      const { error } = await admin.from("credit_ledger").insert({ user_id: ref.referrer_id, amount: given, reason: `Referral signed: ${ref.company ?? ref.name}`, referral_id: ref.id, created_by: viewer.id });
      if (error) return fail("Couldn't give the credits.");
      patch.credits = given;
    }
  }
  const { error } = await admin.from("referrals").update(patch).eq("id", id);
  if (error) return fail("Couldn't save the referral.");
  if (given > 0 && ref.referrer_id) {
    await deliver([{ user_id: ref.referrer_id, kind: "referral_signed", title: `${ref.company ?? ref.name} signed with Magik: +${given} credits`, body: "Thank you for the referral." }]);
  }
  refresh();
  return done(given > 0 ? `Marked signed: ${given} credits given.` : "Saved.");
}

// The studio manager gives or takes credits by hand (a correction, a gift, credits used).
export async function adjustCredits(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin");
  const userId = text(formData, "userId");
  const amount = Math.trunc(Number(text(formData, "amount")));
  const reason = text(formData, "reason").slice(0, 200);
  if (!userId) return fail("Pick a person.");
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1_000_000) return fail("Enter a number of credits, like 50 or -20.");
  if (!reason) return fail("Say why, so they know.");
  const admin = createAdminClient();
  const { error } = await admin.from("credit_ledger").insert({ user_id: userId, amount, reason, created_by: viewer.id });
  if (error) return fail("Couldn't save the credits.");
  await deliver([{ user_id: userId, kind: "credit_adjusted", title: amount > 0 ? `+${amount} credits from the studio` : `${amount} credits`, body: reason }]);
  refresh();
  return done(`${amount > 0 ? "+" : ""}${amount} credits saved.`);
}

export async function saveReferralReward(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("admin");
  const reward = Math.trunc(Number(text(formData, "reward")));
  if (!Number.isFinite(reward) || reward < 0 || reward > 100000) return fail("Enter a number of credits between 0 and 100,000.");
  const { error } = await createAdminClient().from("studio_settings").update({ referral_reward: reward }).eq("id", true);
  if (error) return fail("Couldn't save.");
  refresh();
  return done("Saved.");
}
