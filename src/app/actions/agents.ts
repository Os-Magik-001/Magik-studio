"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth";
import { claudeConfigured } from "@/lib/claude";
import { writeStrategy } from "@/lib/production";
import { QUESTIONS } from "@/lib/questionnaire";
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

// The brand strategist: questionnaire -> niche, charte graphique, business and needs. Also fills
// the brand kit, so every script and edit follows it from now on. It reads the client's videos so
// far, so a second run builds on them (@/lib/production writeStrategy).
export async function runBrandStrategist(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("admin", "editor");
  if (!claudeConfigured()) return fail("The agents aren't connected yet: ANTHROPIC_API_KEY is missing.");
  const clientId = text(formData, "clientId");
  const { data: client } = await (await createClient()).from("clients").select("id").eq("id", clientId).maybeSingle();
  if (!client) return fail("Client not found.");
  try {
    await writeStrategy(client.id, createAdminClient());
  } catch (e) {
    return fail(e instanceof Error ? e.message : "The brand strategist couldn't finish.");
  }
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
