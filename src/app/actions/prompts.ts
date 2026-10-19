"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth";
import { PROMPT_MOTION_TAGS } from "@/lib/motion-prompts";
import { createAdminClient } from "@/lib/supabase/admin";
import { done, fail, optionalText, text, type ActionResult } from "@/lib/action-result";

// A Prompt Motion entry's address ends with its creator's handle and a short code
// ("prompt-motion.com/stephanlivera-df17a2"): a fair guess at the creator when none is given.
function creatorFrom(link: string | null) {
  const m = link?.match(/prompt-motion\.com\/([a-z0-9-]+)-[0-9a-f]{6}\/?$/i);
  return m ? `@${m[1]}` : null;
}

// The team saves a prompt it liked (from Prompt Motion or anywhere), with its link and
// creator, so the scriptwriter can adapt it for the engine.
export async function addMotionPrompt(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin", "editor");
  const title = text(formData, "title");
  const prompt = text(formData, "prompt");
  const link = optionalText(formData, "link");
  if (!title || !prompt) return fail("Give it a title and paste the prompt.");
  if (prompt.length > 20000) return fail("That's over 20,000 characters: keep the part that matters.");
  if (link && !/^https?:\/\//.test(link)) return fail("The link should start with https://");

  const { error } = await createAdminClient()
    .from("motion_prompts")
    .insert({
      title: title.slice(0, 120),
      prompt,
      kind: text(formData, "kind") === "skill" ? "skill" : "prompt",
      tags: formData.getAll("tags").map(String).filter((t) => PROMPT_MOTION_TAGS.includes(t)),
      source_url: link,
      creator: optionalText(formData, "creator") ?? creatorFrom(link),
      notes: optionalText(formData, "notes"),
      created_by: viewer.id,
    });
  if (error) return fail("Couldn't save the prompt.");
  refresh();
  return done("Saved. The scriptwriter uses it from the next script on.");
}

export async function deleteMotionPrompt(formData: FormData) {
  await requireRole("admin", "editor");
  await createAdminClient().from("motion_prompts").delete().eq("id", text(formData, "promptId"));
  refresh();
}
