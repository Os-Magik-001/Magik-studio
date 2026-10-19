"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth";
import { claudeConfigured } from "@/lib/claude";
import { runStrategist } from "@/lib/agents";
import { clientMemory } from "@/lib/memory";
import { QUESTIONS, answeredCount, readAnswers } from "@/lib/questionnaire";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { done, fail, text, type ActionResult } from "@/lib/action-result";

// The client (for their own brand) or the studio saves the questionnaire.
export async function saveQuestionnaire(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor", "client");
  const clientId = viewer.role === "client" ? viewer.clientId : text(formData, "clientId");
  if (!clientId) return fail("Client not found.");
  const answers = Object.fromEntries(QUESTIONS.map((q) => [q.key, text(formData, q.key)]).filter(([, v]) => v));

  const supabase = await createClient();
  const { error } = await supabase
    .from("brand_questionnaires")
    .upsert({ client_id: clientId, answers, submitted_by: viewer.id });
  if (error) return fail("Couldn't save the answers.");
  refresh();
  return done(viewer.role === "client" ? "Thanks! The studio has your answers." : "Answers saved.");
}

// Agent 1: questionnaire -> niche, charte graphique, business and needs. Also fills the
// brand kit, so every script and edit follows it from now on. It reads the client's videos
// so far, so a second run builds on them.
export async function runBrandStrategist(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("admin", "editor");
  if (!claudeConfigured()) return fail("Claude isn't connected yet: ANTHROPIC_API_KEY is missing.");
  const clientId = text(formData, "clientId");

  const supabase = await createClient();
  const [{ data: client }, { data: form }, { data: kit }, memory] = await Promise.all([
    supabase.from("clients").select("id, name").eq("id", clientId).maybeSingle(),
    supabase.from("brand_questionnaires").select("answers").eq("client_id", clientId).maybeSingle(),
    supabase.from("brand_kits").select("client_id, logo_path").eq("client_id", clientId).maybeSingle(),
    clientMemory(clientId, { depth: "brief" }),
  ]);
  if (!client) return fail("Client not found.");
  const answers = readAnswers(form?.answers);
  if (answeredCount(answers) < 4) return fail("Fill in at least 4 answers of the questionnaire first.");

  let strategy;
  try {
    strategy = await runStrategist({ clientName: client.name, answers, memory: memory.text });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "The brand strategist couldn't finish.");
  }

  const clean = (handles: string[]) => [...new Set(handles.map((h) => h.trim().replace(/^[@#]/, "").replace(/\s+/g, "")).filter(Boolean))];
  const admin = createAdminClient();
  const { error } = await admin.from("brand_strategies").upsert({
    client_id: client.id,
    status: "done",
    niche: strategy.niche,
    keywords: clean(strategy.keywords).slice(0, 8),
    reference_accounts: clean(strategy.reference_accounts).slice(0, 6),
    business: strategy.business,
    audience: strategy.audience,
    needs: strategy.needs,
    pillars: strategy.pillars,
    charte: strategy.charte,
    error: null,
  });
  if (error) return fail("The strategy was written but couldn't be saved.");

  // The brand kit the engine reads: primary color first (end cards), the accent next.
  const order = ["primary", "accent", "secondary", "background", "text"];
  const colors = [...strategy.charte.palette]
    .filter((c) => /^#[0-9a-f]{6}$/i.test(c.hex))
    .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))
    .map((c) => c.hex.toUpperCase());
  await supabase.from("brand_kits").upsert({
    client_id: client.id,
    colors,
    fonts: [strategy.charte.fonts.headline, strategy.charte.fonts.body].filter(Boolean),
    music_mood: strategy.charte.music_mood,
    style_rules: strategy.style_rules,
    logo_path: kit?.logo_path ?? null,
  });
  refresh();
  return done("Brand strategy ready. The brand kit was updated from the charte graphique.");
}

// Agent 2: queue a research run; the edit engine finds and watches the viral reels.
export async function requestTrendResearch(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  const clientId = text(formData, "clientId");
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (!client) return fail("Client not found.");

  const list = (key: string) =>
    [...new Set(text(formData, key).split(/[\s,]+/).map((h) => h.replace(/^[@#]/, "").trim()).filter(Boolean))];
  const hashtags = list("hashtags").slice(0, 4);
  const accounts = list("accounts").slice(0, 4);
  if (!hashtags.length && !accounts.length) return fail("Give at least one hashtag or account to search.");

  const admin = createAdminClient();
  const { count } = await admin
    .from("trend_reports")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .in("status", ["queued", "running"]);
  if (count) return fail("A research run is already in progress for this client.");

  const { error } = await admin.from("trend_reports").insert({ client_id: clientId, hashtags, accounts, requested_by: viewer.id });
  if (error) return fail("Couldn't start the research.");
  refresh();
  return done("Research queued. The engine is finding and watching the top reels (a few minutes).");
}
