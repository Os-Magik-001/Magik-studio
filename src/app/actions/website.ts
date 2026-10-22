"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth";
import { notifySales } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { done, fail, optionalText, text, type ActionResult } from "@/lib/action-result";

// A client tells the studio they'd like a website, or a change to theirs.
export async function requestWebsite(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("client");
  if (!viewer.clientId) return fail("Your account isn't linked to a business yet.");
  const kind = text(formData, "kind") === "change" ? "change" : "interest";
  const message = optionalText(formData, "message")?.slice(0, 2000) ?? undefined;
  if (kind === "change" && !message) return fail("Say what you'd like changed.");
  const { data: client } = await createAdminClient().from("clients").select("name").eq("id", viewer.clientId).maybeSingle();
  const name = client?.name ?? "A client";
  await notifySales(viewer.clientId, {
    kind: "website_request",
    title: kind === "change" ? `${name} would like a change to their website` : `${name} would like a website with Magik`,
    body: message,
  });
  return done(kind === "change" ? "Sent. The studio will get back to you." : "Thanks! The studio will reach out about your website.");
}

// The studio manager records the client's website made with Magik.
export async function saveClientWebsite(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole("admin");
  const clientId = text(formData, "clientId");
  const status = text(formData, "status");
  const url = optionalText(formData, "siteUrl");
  const adminUrl = optionalText(formData, "siteAdminUrl");
  if (!["none", "building", "live"].includes(status)) return fail("Pick where the website is.");
  const valid = (u: string | null) => !u || /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(u);
  if (!valid(url) || !valid(adminUrl)) return fail("Addresses start with https://");
  if (status === "live" && !url) return fail("A live website needs its address.");
  const { error } = await createAdminClient().from("clients").update({ site_status: status, site_url: url, site_admin_url: adminUrl }).eq("id", clientId);
  if (error) return fail("Couldn't save the website.");
  refresh();
  return done("Saved. The client sees it in their Website app.");
}
