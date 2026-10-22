"use server";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireRole, type Viewer } from "@/lib/auth";
import { claudeConfigured } from "@/lib/claude";
import { designLogoIdeas } from "@/lib/agents";
import { readAnswers } from "@/lib/questionnaire";
import { REQUIRED_SETUP_QUESTIONS, SETUP_QUESTION_KEYS } from "@/lib/onboarding";
import { LOGO_FONTS, cleanSpec, suggestLogos, type LogoSpec } from "@/lib/logo-templates";
import { parseReferenceLink } from "@/lib/reference-links";
import { inviteByToken } from "@/lib/invites";
import { notifySales } from "@/lib/notify";
import { startProduction } from "@/lib/production";
import { passwordProblem } from "@/lib/passwords";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { done, fail, text, type ActionResult } from "@/lib/action-result";

// The client's lane of onboarding: the link -> an account -> the contract -> the questions ->
// references -> the brand. Everything here acts for the signed-in client's own company only.

const EMAIL = /^\S+@\S+\.\S+$/;
const now = () => new Date().toISOString();
const safeName = (name: string) => name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-100);
const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };

async function setupClient(): Promise<Viewer & { clientId: string }> {
  const viewer = await requireRole("client");
  if (!viewer.clientId) notFound();
  return viewer as Viewer & { clientId: string };
}

async function clientName(clientId: string) {
  const { data } = await createAdminClient().from("clients").select("name").eq("id", clientId).maybeSingle();
  return data?.name ?? "A client";
}

// ---------------------------------------------------------------- the link and the account

export async function markInviteOpened(token: string) {
  const invite = await inviteByToken(String(token ?? ""));
  if (!invite || invite.state !== "active" || invite.opened_at) return;
  await createAdminClient().from("client_invites").update({ opened_at: now() }).eq("id", invite.id).is("opened_at", null);
}

export async function createAccountFromInvite(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const invite = await inviteByToken(text(formData, "token"));
  if (!invite) return fail("This link isn't valid. Ask your contact at Magik for a new one.");
  if (invite.state === "used") return fail("This link has already been used to open an account. Sign in instead.");
  if (invite.state !== "active") return fail("This link has expired. Ask your contact at Magik for a new one.");

  const fullName = text(formData, "fullName").slice(0, 120);
  const email = text(formData, "email").toLowerCase();
  const password = formData.get("password");
  if (!fullName) return fail("Enter your name.");
  if (!EMAIL.test(email)) return fail("Enter a valid email address.");
  const weak = passwordProblem(password);
  if (weak) return fail(weak);
  if (password !== formData.get("confirm")) return fail("The two passwords don't match.");

  const admin = createAdminClient();
  // Claim the link first, so one link can't open two accounts.
  const { data: claimed } = await admin.from("client_invites").update({ used_at: now() }).eq("id", invite.id).is("used_at", null).select("id").maybeSingle();
  if (!claimed) return fail("This link has already been used to open an account. Sign in instead.");
  const release = () => admin.from("client_invites").update({ used_at: null }).eq("id", invite.id);

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: password as string,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !created.user) {
    await release();
    return fail(
      error?.code === "email_exists"
        ? "This email already has an account. Sign in with it, or use another email."
        : error?.code === "weak_password"
          ? "That password is too weak. Pick a longer one."
          : "Couldn't open your account. Try again.",
    );
  }
  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id: created.user.id, email, full_name: fullName, role: "client", client_id: invite.client_id });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    await release();
    return fail("Couldn't open your account. Try again.");
  }
  await admin.from("client_invites").update({ used_by: created.user.id, opened_at: invite.opened_at ?? now() }).eq("id", invite.id);
  // A client set up before onboarding existed still goes through the setup assistant.
  await admin.from("onboardings").upsert({ client_id: invite.client_id }, { onConflict: "client_id", ignoreDuplicates: true });

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password: password as string });
  await notifySales(invite.client_id, {
    kind: "onboarding_account",
    title: `${invite.client.name} opened their account`,
    body: `${fullName} (${email}) is going through the setup.`,
  });
  redirect("/setup");
}

// ---------------------------------------------------------------- the contract

export async function signContract(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await setupClient();
  const signature = text(formData, "signature").slice(0, 120);
  if (text(formData, "agree") !== "1") return fail("Tick the box to confirm you've read and accept the contract.");
  if (signature.length < 3) return fail("Type your full name to sign.");
  const admin = createAdminClient();
  const { data: contract } = await admin.from("contracts").select("id, client_id, status").eq("id", text(formData, "contractId")).maybeSingle();
  if (!contract || contract.client_id !== viewer.clientId) return fail("Contract not found.");
  if (contract.status !== "signed") {
    const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
    await admin
      .from("contracts")
      .update({ status: "signed", signed_name: signature, signed_at: now(), signed_by: viewer.id, signed_ip: ip })
      .eq("id", contract.id);
    await notifySales(viewer.clientId, {
      kind: "onboarding_contract",
      title: `${await clientName(viewer.clientId)} signed the contract`,
      body: `Signed in the app by ${signature}.`,
    });
  }
  redirect("/setup");
}

// ---------------------------------------------------------------- the questions

// Saved one at a time, as the client answers, so nothing is lost if they leave.
export async function saveSetupAnswer(input: { key: string; value: string }): Promise<ActionResult> {
  const viewer = await setupClient();
  if (!(SETUP_QUESTION_KEYS as readonly string[]).includes(input.key)) return fail("Unknown question.");
  const supabase = await createClient();
  const { data: row } = await supabase.from("brand_questionnaires").select("answers").eq("client_id", viewer.clientId).maybeSingle();
  const answers: Record<string, string> = { ...readAnswers(row?.answers) };
  const value = String(input.value ?? "").trim().slice(0, 4000);
  if (value) answers[input.key] = value;
  else delete answers[input.key];
  const { error } = await supabase.from("brand_questionnaires").upsert({ client_id: viewer.clientId, answers, submitted_by: viewer.id });
  if (error) return fail("Couldn't save your answer. Check your connection and try again.");
  return done();
}

export async function finishQuestions(): Promise<ActionResult> {
  const viewer = await setupClient();
  const supabase = await createClient();
  const { data: row } = await supabase.from("brand_questionnaires").select("answers").eq("client_id", viewer.clientId).maybeSingle();
  const answers = readAnswers(row?.answers);
  const missing = SETUP_QUESTION_KEYS.slice(0, REQUIRED_SETUP_QUESTIONS).filter((k) => !answers[k]);
  if (missing.length) return fail("Answer the first questions before going on: we need them to get started.");
  await createAdminClient().from("onboardings").update({ questions_done_at: now() }).eq("client_id", viewer.clientId);
  return done();
}

// ---------------------------------------------------------------- references

export async function addSetupReference(input: { link?: string; note?: string; libraryId?: string }): Promise<ActionResult> {
  const viewer = await setupClient();
  const admin = createAdminClient();
  let url = String(input.link ?? "");
  let libraryId: string | null = null;
  let title: string | null = null;
  if (input.libraryId) {
    const { data: item } = await admin.from("reference_library").select("id, url, title, active").eq("id", input.libraryId).maybeSingle();
    if (!item?.active) return fail("This video isn't in the library anymore.");
    url = item.url;
    libraryId = item.id;
    title = item.title;
  }
  const link = parseReferenceLink(url);
  if ("error" in link) return fail(link.error);
  const { count } = await admin.from("reference_videos").select("id", { count: "exact", head: true }).eq("client_id", viewer.clientId).is("video_id", null);
  if ((count ?? 0) >= 12) return fail("That's plenty: 12 videos at most. Remove one to add another.");
  const { data, error } = await admin
    .from("reference_videos")
    .insert({
      client_id: viewer.clientId,
      video_id: null,
      url: link.url,
      platform: link.platform,
      focus: [],
      note: String(input.note ?? "").trim().slice(0, 600) || null,
      title,
      library_id: libraryId,
      created_by: viewer.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.code === "23505" ? "You've already added this video." : "Couldn't add the video.");
  return done(undefined, { id: data.id });
}

export async function removeSetupReference(id: string): Promise<ActionResult> {
  const viewer = await setupClient();
  await createAdminClient().from("reference_videos").delete().eq("id", String(id)).eq("client_id", viewer.clientId).eq("created_by", viewer.id);
  return done();
}

export async function finishReferences(): Promise<ActionResult> {
  const viewer = await setupClient();
  await createAdminClient().from("onboardings").update({ references_done_at: now() }).eq("client_id", viewer.clientId);
  return done();
}

// ---------------------------------------------------------------- the brand

async function finishBrand(viewer: Viewer & { clientId: string }, hasBrand: boolean, how: string) {
  const at = now();
  await createAdminClient()
    .from("onboardings")
    .update({ has_brand: hasBrand, brand_done_at: at, completed_at: at })
    .eq("client_id", viewer.clientId);
  // Everything is filled in: production starts by itself (the brand strategist, then the trend
  // research); the studio plans the month from the client's Production panel.
  const started = claudeConfigured() && (await startProduction(viewer.clientId, null, { firstTime: true }).catch(() => false));
  await notifySales(viewer.clientId, {
    kind: "onboarding_done",
    title: `${await clientName(viewer.clientId)} finished onboarding`,
    body: started ? `${how} Production started: the brand strategist is at work.` : how,
  });
}

async function replaceLogo(clientId: string, path: string, patch: Record<string, unknown>) {
  const admin = createAdminClient();
  const { data: kit } = await admin.from("brand_kits").select("logo_path").eq("client_id", clientId).maybeSingle();
  const { error } = await admin.from("brand_kits").upsert({ client_id: clientId, logo_path: path, ...patch });
  if (error) return false;
  if (kit?.logo_path && kit.logo_path !== path) await admin.storage.from("brand").remove([kit.logo_path]);
  return true;
}

const HEX = /^#[0-9a-f]{6}$/i;

// "Yes, I have a brand": their own logo, and their colors and fonts if they know them.
export async function uploadBrandLogo(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await setupClient();
  const file = formData.get("logo");
  if (!(file instanceof File) || !file.size) return fail("Choose your logo file.");
  const ext = LOGO_TYPES[file.type];
  if (!ext) return fail("Your logo must be a PNG, JPG, WebP or SVG file.");
  if (file.size > 4 * 1024 * 1024) return fail("This file is over 4 MB. Export a smaller PNG and try again.");
  const colors = formData
    .getAll("colors")
    .map(String)
    .filter((c) => HEX.test(c))
    .map((c) => c.toUpperCase())
    .slice(0, 5);
  const fonts = text(formData, "fonts")
    .split(/[,\n]/)
    .map((f) => f.trim())
    .filter(Boolean)
    .slice(0, 4);

  const admin = createAdminClient();
  const path = `${viewer.clientId}/${crypto.randomUUID()}-${safeName(file.name.replace(/\.[^.]+$/, ""))}.${ext}`;
  const { error } = await admin.storage.from("brand").upload(path, file, { contentType: file.type, upsert: false });
  if (error) return fail("Couldn't upload your logo. Try again.");
  const saved = await replaceLogo(viewer.clientId, path, {
    logo_source: "uploaded",
    logo_spec: null,
    ...(colors.length ? { colors } : {}),
    ...(fonts.length ? { fonts } : {}),
  });
  if (!saved) {
    await admin.storage.from("brand").remove([path]);
    return fail("Couldn't save your logo. Try again.");
  }
  await finishBrand(viewer, true, "They uploaded their logo.");
  redirect("/setup");
}

// "No, create one": the logo they built in the creator, as a transparent PNG.
export async function saveCreatedLogo(formData: FormData): Promise<ActionResult> {
  const viewer = await setupClient();
  const file = formData.get("logo");
  if (!(file instanceof File) || file.type !== "image/png" || !file.size) return fail("Couldn't read the logo. Try again.");
  if (file.size > 4 * 1024 * 1024) return fail("The logo came out too large. Try again.");
  let spec: LogoSpec;
  try {
    spec = cleanSpec(JSON.parse(text(formData, "spec")), await clientName(viewer.clientId));
  } catch {
    return fail("Couldn't read the logo. Try again.");
  }
  const admin = createAdminClient();
  const path = `${viewer.clientId}/${crypto.randomUUID()}-logo.png`;
  const { error } = await admin.storage.from("brand").upload(path, file, { contentType: "image/png", upsert: false });
  if (error) return fail("Couldn't save your logo. Try again.");
  const saved = await replaceLogo(viewer.clientId, path, {
    logo_source: "created",
    logo_spec: spec,
    colors: [spec.colors.primary, spec.colors.accent],
    fonts: [LOGO_FONTS.find((f) => f.id === spec.font)?.name ?? "Montserrat"],
  });
  if (!saved) {
    await admin.storage.from("brand").remove([path]);
    return fail("Couldn't save your logo. Try again.");
  }
  await finishBrand(viewer, false, "They created their logo in the setup.");
  return done();
}

// Six starting points for the logo creator: designed from their answers by Claude when it's
// connected, otherwise picked from the templates by their personality words.
export async function logoSuggestions(): Promise<LogoSpec[]> {
  const viewer = await setupClient();
  const supabase = await createClient();
  const [name, { data: form }] = await Promise.all([
    clientName(viewer.clientId),
    supabase.from("brand_questionnaires").select("answers").eq("client_id", viewer.clientId).maybeSingle(),
  ]);
  const answers = readAnswers(form?.answers);
  if (claudeConfigured()) {
    try {
      const ideas = await designLogoIdeas({ clientName: name, answers });
      const specs = ideas.map((idea) => cleanSpec({ ...idea, colors: { ...idea.colors, background: null } }, name));
      if (specs.length >= 3) return specs.slice(0, 6);
    } catch {}
  }
  return suggestLogos(name, answers.tone ?? "");
}

// ---------------------------------------------------------------- done

export async function completeSetup() {
  const viewer = await setupClient();
  await createAdminClient().from("onboardings").update({ completed_at: now() }).eq("client_id", viewer.clientId).is("completed_at", null);
  redirect("/");
}
