"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { claudeConfigured } from "@/lib/claude";
import { writeInvoiceWording } from "@/lib/agents";
import { createAdminClient } from "@/lib/supabase/admin";
import { done, fail, optionalText, text, type ActionResult } from "@/lib/action-result";
import { DEFAULT_LINK_DAYS, LINK_DAYS } from "@/lib/onboarding";
import { defaultNote, packLine, readTaxes, totals, type Lang } from "@/lib/invoices";
import { hashToken, newToken, siteOrigin } from "@/lib/invites";

// The seller's lane of onboarding: client details -> pack -> invoice -> contract -> link.
// Sellers and studio managers only. Writes go through the secret key after the role check.

const EMAIL = /^\S+@\S+\.\S+$/;
const UUID = /^[0-9a-f-]{36}$/i;
const now = () => new Date().toISOString();
// Dates on invoices are the studio's (Montréal), not the server's (UTC).
const localDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(d);
const safeName = (name: string) => name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-100);

function clientFields(formData: FormData) {
  return {
    name: text(formData, "name").slice(0, 120),
    contact_name: optionalText(formData, "contactName"),
    email: optionalText(formData, "email")?.toLowerCase() ?? null,
    phone: optionalText(formData, "phone"),
    address: optionalText(formData, "address"),
    website: optionalText(formData, "website"),
    instagram: optionalText(formData, "instagram")?.replace(/^@+/, "") ?? null,
    language: text(formData, "language") === "en" ? "en" : "fr",
    notes: optionalText(formData, "notes"),
  };
}

function clientProblem(f: ReturnType<typeof clientFields>) {
  if (!f.name) return "Give the client's business a name.";
  if (!f.contact_name) return "Add the name of the person you deal with.";
  if (!f.email || !EMAIL.test(f.email)) return "Enter the client's email address: the link goes there.";
  return null;
}

// ---------------------------------------------------------------- 1. client infos

export async function createOnboardingClient(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "seller");
  const f = clientFields(formData);
  const problem = clientProblem(f);
  if (problem) return fail(problem);
  const admin = createAdminClient();
  const { data, error } = await admin.from("clients").insert({ ...f, seller_id: viewer.id }).select("id").single();
  if (error) return fail("Couldn't create the client.");
  await Promise.all([admin.from("brand_kits").insert({ client_id: data.id }), admin.from("onboardings").insert({ client_id: data.id })]);
  redirect(`/onboarding/${data.id}?step=pack`);
}

// An existing client (from before onboarding) goes through it too.
export async function startOnboarding(formData: FormData) {
  await requireRole("admin", "seller");
  const clientId = text(formData, "clientId");
  if (!UUID.test(clientId)) return;
  await createAdminClient().from("onboardings").upsert({ client_id: clientId }, { onConflict: "client_id", ignoreDuplicates: true });
  redirect(`/onboarding/${clientId}`);
}

export async function saveClientInfos(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("admin", "seller");
  const clientId = text(formData, "clientId");
  if (!UUID.test(clientId)) return fail("Client not found.");
  const f = clientFields(formData);
  const problem = clientProblem(f);
  if (problem) return fail(problem);
  const { error } = await createAdminClient().from("clients").update(f).eq("id", clientId);
  if (error) return fail("Couldn't save the details.");
  refresh();
  return done("Saved.");
}

// ---------------------------------------------------------------- 2. pack

export async function choosePack(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("admin", "seller");
  const clientId = text(formData, "clientId");
  const packId = text(formData, "packId");
  if (!UUID.test(clientId) || !UUID.test(packId)) return fail("Pick one of the packs.");
  const admin = createAdminClient();
  const { data: pack } = await admin.from("packs").select("id, revision_rounds, active").eq("id", packId).maybeSingle();
  if (!pack?.active) return fail("Pick one of the packs.");
  // The pack's revision rounds become the client's limit (beyond it, changes are billable).
  const { error } = await admin.from("clients").update({ pack_id: pack.id, revision_limit: pack.revision_rounds }).eq("id", clientId);
  if (error) return fail("Couldn't save the pack.");
  redirect(`/onboarding/${clientId}?step=invoice`);
}

function packFields(formData: FormData) {
  const price = Number(text(formData, "price").replace(/\s/g, "").replace(",", "."));
  const videos = text(formData, "videosPerMonth");
  return {
    name: text(formData, "name").slice(0, 80),
    description: optionalText(formData, "description")?.slice(0, 400) ?? null,
    price_cents: Number.isFinite(price) ? Math.round(price * 100) : NaN,
    billing: text(formData, "billing") === "one_time" ? "one_time" : "monthly",
    videos_per_month: videos ? Number(videos) : null,
    revision_rounds: Number(text(formData, "revisionRounds") || "2"),
    features: text(formData, "features")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 12),
  };
}

export async function savePack(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("admin");
  const id = optionalText(formData, "packId");
  const f = packFields(formData);
  if (!f.name) return fail("Give the pack a name.");
  if (!Number.isFinite(f.price_cents) || f.price_cents < 0) return fail("Enter the price, e.g. 1500 or 1499.99.");
  if (f.videos_per_month !== null && (!Number.isInteger(f.videos_per_month) || f.videos_per_month < 0 || f.videos_per_month > 200)) {
    return fail("Videos per month must be a whole number.");
  }
  if (!Number.isInteger(f.revision_rounds) || f.revision_rounds < 0 || f.revision_rounds > 20) return fail("Revision rounds must be from 0 to 20.");
  const admin = createAdminClient();
  const { error } = id ? await admin.from("packs").update(f).eq("id", id) : await admin.from("packs").insert({ ...f, active: true });
  if (error) return fail("Couldn't save the pack.");
  refresh();
  return done(id ? "Pack saved." : "Pack added.");
}

export async function setPackActive(formData: FormData) {
  await requireRole("admin");
  const id = text(formData, "packId");
  if (!UUID.test(id)) return;
  await createAdminClient().from("packs").update({ active: text(formData, "active") === "1" }).eq("id", id);
  refresh();
}

// ---------------------------------------------------------------- 3. invoice

export async function generateInvoice(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "seller");
  const clientId = text(formData, "clientId");
  if (!UUID.test(clientId)) return fail("Client not found.");
  const admin = createAdminClient();
  const [{ data: client }, { data: settings }] = await Promise.all([
    admin
      .from("clients")
      .select("id, name, contact_name, email, phone, address, language, packs(id, name, description, price_cents, billing, videos_per_month, revision_rounds, features)")
      .eq("id", clientId)
      .maybeSingle(),
    admin.from("studio_settings").select("*").maybeSingle(),
  ]);
  if (!client) return fail("Client not found.");
  const pack = client.packs;
  if (!pack) return fail("Choose the pack first: the invoice bills it.");
  if (!settings) return fail("The studio's invoice details are missing.");
  const lang: Lang = client.language === "en" ? "en" : "fr";

  // Claude words the line and the note in the client's language; the numbers are ours.
  let wording: { detail: string; note: string } | null = null;
  if (claudeConfigured()) {
    try {
      wording = await writeInvoiceWording({ clientName: client.name, language: lang, pack, paymentTerms: settings.payment_terms_days });
    } catch {
      wording = null;
    }
  }
  const lines = [packLine(pack, lang, wording?.detail)];
  const taxes = readTaxes(settings.taxes);
  const t = totals(lines, taxes);

  const { data: number, error: numberError } = await admin.rpc("take_invoice_number");
  if (numberError || !number) return fail("Couldn't number the invoice.");
  // An unpaid invoice from before is replaced, not deleted.
  await admin.from("invoices").update({ status: "void" }).eq("client_id", client.id).in("status", ["issued", "sent"]);

  const issued = new Date();
  const { error } = await admin.from("invoices").insert({
    client_id: client.id,
    number,
    pack_id: pack.id,
    status: "issued",
    issued_on: localDate(issued),
    due_on: localDate(new Date(issued.getTime() + settings.payment_terms_days * 86_400_000)),
    currency: settings.currency,
    lines,
    taxes: t.taxLines,
    subtotal_cents: t.subtotal,
    total_cents: t.total,
    notes: wording?.note?.trim() || defaultNote(lang, settings.payment_terms_days),
    language: lang,
    bill_to: { name: client.name, contact: client.contact_name, email: client.email, phone: client.phone, address: client.address },
    issuer: {
      name: settings.business_name,
      email: settings.email,
      phone: settings.phone,
      address: settings.address,
      website: settings.website,
      taxes,
      payment_instructions: settings.payment_instructions,
    },
    written_by_claude: !!wording,
    created_by: viewer.id,
  });
  if (error) return fail("Couldn't save the invoice.");
  refresh();
  return done(`Invoice ${number} is ready.`);
}

export async function setInvoiceStatus(formData: FormData) {
  await requireRole("admin", "seller");
  const id = text(formData, "invoiceId");
  const status = text(formData, "status");
  if (!UUID.test(id) || !["issued", "sent", "paid", "void"].includes(status)) return;
  await createAdminClient()
    .from("invoices")
    .update({
      status,
      ...(status === "paid" ? { paid_at: now() } : {}),
      ...(status === "sent" ? { sent_at: now() } : {}),
    })
    .eq("id", id);
  refresh();
}

export async function saveStudioSettings(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("admin");
  const terms = Number(text(formData, "paymentTerms"));
  if (!Number.isInteger(terms) || terms < 0 || terms > 120) return fail("Payment terms are a number of days, 0 to 120.");
  const prefix = text(formData, "invoicePrefix").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (!prefix) return fail("Give invoice numbers a prefix, like MGK.");
  const taxes = [0, 1, 2]
    .map((i) => ({
      name: text(formData, `taxName${i}`).slice(0, 20),
      rate: Number(text(formData, `taxRate${i}`).replace(",", ".")),
      number: text(formData, `taxNumber${i}`).slice(0, 40),
    }))
    .filter((t) => t.name);
  if (taxes.some((t) => !Number.isFinite(t.rate) || t.rate < 0 || t.rate > 50)) return fail("Tax rates are percentages, like 5 or 9.975.");
  const currency = text(formData, "currency").toUpperCase();
  const { error } = await createAdminClient()
    .from("studio_settings")
    .update({
      business_name: text(formData, "businessName") || "Magik Studio",
      address: optionalText(formData, "address"),
      email: optionalText(formData, "email"),
      phone: optionalText(formData, "phone"),
      website: optionalText(formData, "website"),
      currency: ["CAD", "USD", "EUR"].includes(currency) ? currency : "CAD",
      taxes,
      payment_terms_days: terms,
      payment_instructions: optionalText(formData, "paymentInstructions"),
      invoice_prefix: prefix,
    })
    .eq("id", true);
  if (error) return fail("Couldn't save the invoice details.");
  refresh();
  return done("Saved. New invoices use these details.");
}

// ---------------------------------------------------------------- 4. contract

export async function uploadContract(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "seller");
  const clientId = text(formData, "clientId");
  const file = formData.get("file");
  if (!UUID.test(clientId)) return fail("Client not found.");
  if (!(file instanceof File) || !file.size) return fail("Choose the contract (a PDF).");
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) return fail("The contract must be a PDF.");
  if (file.size > 4 * 1024 * 1024) return fail("This PDF is over 4 MB. Compress it and try again.");
  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (!client) return fail("Client not found.");
  const path = `${client.id}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error: uploadError } = await admin.storage.from("contracts").upload(path, file, { contentType: "application/pdf", upsert: false });
  if (uploadError) return fail("Couldn't upload the contract.");
  // Signed on paper, or before the link: the client won't be asked to sign in the app.
  const signedOutside = text(formData, "signedOutside") === "1";
  const { error } = await admin.from("contracts").insert({
    client_id: client.id,
    storage_path: path,
    file_name: file.name.slice(0, 160),
    created_by: viewer.id,
    ...(signedOutside ? { status: "signed", signed_outside: true, signed_at: now() } : {}),
  });
  if (error) {
    await admin.storage.from("contracts").remove([path]);
    return fail("Couldn't save the contract.");
  }
  refresh();
  return done(signedOutside ? "Contract added, marked as signed." : "Contract added. The client signs it after opening their account.");
}

export async function markContractSigned(formData: FormData) {
  await requireRole("admin", "seller");
  const id = text(formData, "contractId");
  if (!UUID.test(id)) return;
  await createAdminClient().from("contracts").update({ status: "signed", signed_outside: true, signed_at: now() }).eq("id", id).eq("status", "awaiting_signature");
  refresh();
}

export async function removeContract(formData: FormData) {
  await requireRole("admin", "seller");
  const id = text(formData, "contractId");
  if (!UUID.test(id)) return;
  const admin = createAdminClient();
  const { data } = await admin.from("contracts").select("storage_path").eq("id", id).maybeSingle();
  if (!data) return;
  await admin.from("contracts").delete().eq("id", id);
  await admin.storage.from("contracts").remove([data.storage_path]);
  refresh();
}

// ---------------------------------------------------------------- 5. the link

export async function createInviteLink(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "seller");
  const clientId = text(formData, "clientId");
  const days = Number(text(formData, "days"));
  const valid = (LINK_DAYS as readonly number[]).includes(days) ? days : DEFAULT_LINK_DAYS;
  if (!UUID.test(clientId)) return fail("Client not found.");
  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("id, email").eq("id", clientId).maybeSingle();
  if (!client) return fail("Client not found.");
  // A new link replaces any link still open.
  await admin.from("client_invites").update({ revoked_at: now() }).eq("client_id", client.id).is("used_at", null).is("revoked_at", null);
  const token = newToken();
  const { error } = await admin.from("client_invites").insert({
    client_id: client.id,
    token_hash: hashToken(token),
    email: client.email,
    expires_at: new Date(Date.now() + valid * 86_400_000).toISOString(),
    created_by: viewer.id,
  });
  if (error) return fail("Couldn't create the link.");
  refresh();
  return done(`Link ready, valid for ${valid} days.`, { link: `${await siteOrigin()}/join/${token}` });
}

// The seller copied, emailed, texted or shared the link: the seller's lane is done.
export async function markInviteSent(input: { clientId: string; via: "copy" | "email" | "sms" | "share" }): Promise<ActionResult> {
  await requireRole("admin", "seller");
  if (!UUID.test(input.clientId) || !["copy", "email", "sms", "share"].includes(input.via)) return fail("Client not found.");
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("client_invites")
    .select("id, sent_at")
    .eq("client_id", input.clientId)
    .is("revoked_at", null)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!invite) return fail("Create a link first.");
  if (!invite.sent_at) await admin.from("client_invites").update({ sent_at: now(), sent_via: input.via }).eq("id", invite.id);
  refresh();
  return done();
}
