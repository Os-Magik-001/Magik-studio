"use server";

import { refresh } from "next/cache";
import { displayName, getViewer, requireRole } from "@/lib/auth";
import { deliver } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { done, fail, optionalText, text, type ActionResult } from "@/lib/action-result";

// Help: a question sent from the Help app goes to the studio managers; they answer in Help too.

const TOPICS = ["question", "problem", "idea", "billing"];

export async function askHelp(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  const topic = TOPICS.includes(text(formData, "topic")) ? text(formData, "topic") : "question";
  const body = text(formData, "body").slice(0, 4000);
  const page = optionalText(formData, "page")?.slice(0, 300) ?? null;
  if (!body) return fail("Write your question.");
  const admin = createAdminClient();
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin.from("help_requests").select("id", { count: "exact", head: true }).eq("user_id", viewer.id).gte("created_at", since);
  if ((count ?? 0) >= 10) return fail("You've sent a lot of messages this hour. The studio will get back to you.");
  const { error } = await admin.from("help_requests").insert({ user_id: viewer.id, topic, body, page });
  if (error) return fail("Couldn't send your message.");
  const { data: managers } = await admin.from("profiles").select("id").eq("role", "admin").is("paused_at", null);
  const label = { question: "A question", problem: "A problem", idea: "An idea", billing: "A billing question" }[topic];
  await deliver((managers ?? []).filter((m) => m.id !== viewer.id).map((m) => ({ user_id: m.id, kind: "help_request", title: `${label} from ${displayName(viewer)}`, body: body.slice(0, 280) })));
  refresh();
  return done("Sent. The studio will answer you here and in your notifications.");
}

export async function answerHelp(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("admin");
  const id = text(formData, "id");
  const reply = text(formData, "reply").slice(0, 2000);
  const close = text(formData, "close") === "1";
  const admin = createAdminClient();
  const { data: req } = await admin.from("help_requests").select("id, user_id, body").eq("id", id).maybeSingle();
  if (!req) return fail("Unknown message.");
  if (!reply && !close) return fail("Write an answer.");
  const { error } = await admin.from("help_requests").update({ status: close && !reply ? "closed" : "answered" }).eq("id", id);
  if (error) return fail("Couldn't save.");
  if (reply && req.user_id) {
    await deliver([{ user_id: req.user_id, kind: "help_answer", title: "The studio answered your question", body: reply }]);
  }
  refresh();
  return done(reply ? "Answer sent." : "Closed.");
}
