"use server";

import { refresh, updateTag } from "next/cache";
import { getViewer, requireRole } from "@/lib/auth";
import { BrandRecord } from "@/lib/brand";
import { WALLPAPERS } from "@/lib/wallpapers";
import { passwordProblem } from "@/lib/passwords";
import { createPlatformClient } from "@/lib/supabase/admin";
import { done, fail, optionalText, text, type ActionResult } from "@/lib/action-result";
import type { Json } from "@/lib/database.types";

// An agency's own brand (Settings > Branding, for its studio manager) and the agencies
// themselves (Settings > Agencies, for the platform's owner). The agencies table belongs to no
// agency, so these use the platform's client, each time on one agency by its id.

const FILES = { mark: "mark", horizontal: "horizontal", horizontalDark: "horizontalDark", icon: "icon" } as const;
type FileKind = keyof typeof FILES;
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };
const BUCKET = "agency";
const publicUrl = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
// The path of one of our own stored files, from its address.
const storedPath = (url: unknown) => {
  const prefix = publicUrl("");
  return typeof url === "string" && url.startsWith(prefix) ? url.slice(prefix.length) : null;
};

type Stored = { logos?: Record<string, string | null>; icon?: string | null; appleIcon?: string | null } & Record<string, unknown>;

export async function saveBranding(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireRole("admin");
  const db = createPlatformClient();
  const { data: agency } = await db.from("agencies").select("id, brand").eq("id", viewer.agencyId).maybeSingle();
  if (!agency) return fail("Couldn't find your studio.");
  const current = (agency.brand ?? {}) as Stored;

  const product = text(formData, "product").slice(0, 60);
  const studio = text(formData, "studio").slice(0, 60);
  const short = text(formData, "short").slice(0, 60);
  const first = text(formData, "wordmarkFirst").slice(0, 24).toUpperCase();
  const second = text(formData, "wordmarkSecond").slice(0, 12).toUpperCase();
  const accent = text(formData, "accent").toLowerCase();
  const wallpaper = text(formData, "wallpaper");
  if (!product || !studio || !short) return fail("Give the app's name, the studio's name and its short name.");
  if (!first) return fail("Give the name shown in the menu bar.");
  if (!/^#[0-9a-f]{6}$/.test(accent)) return fail("Pick an accent colour.");
  if (!WALLPAPERS.some((w) => w.id === wallpaper && w.image)) return fail("Pick a wallpaper.");

  // New files first; what they replace is removed once the record is saved. A file that is
  // taken away leaves nothing in the record, so the studio falls back to what it started with.
  const logos: Record<string, string | null> = { ...(current.logos ?? {}) };
  let icon = current.icon ?? undefined;
  const uploaded: string[] = [];
  const replaced: string[] = [];
  const set = (kind: FileKind, value: string | undefined) => {
    const old = storedPath(kind === "icon" ? icon : logos[kind]);
    if (old) replaced.push(old);
    if (kind === "icon") icon = value;
    else if (value) logos[kind] = value;
    else delete logos[kind];
  };
  for (const kind of Object.keys(FILES) as FileKind[]) {
    const file = formData.get(kind);
    if (file instanceof File && file.size) {
      const ext = TYPES[file.type];
      if (!ext) return fail("Logos must be PNG, JPG, WebP or SVG files.");
      if (file.size > 1024 * 1024) return fail("A logo file is over 1 MB. Export a smaller one and try again.");
      const path = `${agency.id}/${kind}-${crypto.randomUUID()}.${ext}`;
      const { error } = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        if (uploaded.length) await db.storage.from(BUCKET).remove(uploaded);
        return fail("Couldn't upload a logo. Try again.");
      }
      uploaded.push(path);
      set(kind, publicUrl(path));
    } else if (text(formData, `${kind}Remove`) === "1") {
      set(kind, undefined);
    }
  }

  const next: Stored = { ...current, product, studio, short, wordmark: [first, second], accent, wallpaper, logos };
  delete next.icon;
  delete next.appleIcon;
  if (icon) Object.assign(next, { icon, appleIcon: icon });
  if (!BrandRecord.safeParse(next).success) {
    if (uploaded.length) await db.storage.from(BUCKET).remove(uploaded);
    return fail("Something in these settings isn't valid. Check the names and try again.");
  }
  const { error } = await db.from("agencies").update({ brand: next as unknown as Json }).eq("id", agency.id);
  if (error) {
    if (uploaded.length) await db.storage.from(BUCKET).remove(uploaded);
    return fail("Couldn't save the branding.");
  }
  if (replaced.length) await db.storage.from(BUCKET).remove(replaced);
  updateTag("brand");
  refresh();
  return done("Saved. Everyone sees it the next time a page loads.");
}

// Back to the names and colours the studio started with.
export async function resetBranding(): Promise<ActionResult> {
  const viewer = await requireRole("admin");
  const db = createPlatformClient();
  const { data: agency } = await db.from("agencies").select("id, brand").eq("id", viewer.agencyId).maybeSingle();
  if (!agency) return fail("Couldn't find your studio.");
  const current = (agency.brand ?? {}) as Stored;
  const files = [...Object.values(current.logos ?? {}), current.icon].map(storedPath).filter((p): p is string => !!p);
  const { error } = await db.from("agencies").update({ brand: {} }).eq("id", agency.id);
  if (error) return fail("Couldn't reset the branding.");
  if (files.length) await db.storage.from(BUCKET).remove(files);
  updateTag("brand");
  refresh();
  return done("Back to the starting look.");
}

// ---------------------------------------------------------------- the platform's owner

async function requirePlatform() {
  const viewer = await getViewer();
  if (!viewer.platformAdmin) throw new Error("Not allowed.");
  return viewer;
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/;
const HOST = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

// "https://Studio.Example.com/login" and "studio.example.com:3000" are both studio.example.com.
function readDomains(raw: string): string[] | string {
  const list = raw
    .split(/[\s,]+/)
    .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[/?#].*$/, "").replace(/:\d+$/, ""))
    .filter(Boolean);
  const bad = list.find((d) => !HOST.test(d));
  if (bad) return `"${bad}" isn't a web address. Write it like studio.example.com.`;
  return [...new Set(list)].slice(0, 10);
}

async function domainsTaken(domains: string[], exceptId?: string) {
  if (!domains.length) return null;
  const { data } = await createPlatformClient().from("agencies").select("id, name, domains").overlaps("domains", domains);
  const other = (data ?? []).find((a) => a.id !== exceptId);
  return other ? `${other.domains.find((d) => domains.includes(d))} already belongs to ${other.name}.` : null;
}

export async function createAgency(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requirePlatform();
  const name = text(formData, "name").slice(0, 60);
  const slug = text(formData, "slug").toLowerCase();
  const domains = readDomains(text(formData, "domains"));
  const email = text(formData, "email").toLowerCase();
  const fullName = optionalText(formData, "fullName");
  const password = formData.get("password");
  if (!name) return fail("Give the agency a name.");
  if (!SLUG.test(slug)) return fail("The short name is 2 to 40 lower-case letters, digits or dashes, like north-studio.");
  if (typeof domains === "string") return fail(domains);
  if (!domains.length) return fail("Give the address its people will use: an account only opens at its own agency's address.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Enter the first studio manager's email.");
  const weak = passwordProblem(password);
  if (weak) return fail(weak);
  const taken = await domainsTaken(domains);
  if (taken) return fail(taken);

  const db = createPlatformClient();
  const { data: agency, error } = await db.from("agencies").insert({ name, slug, domains }).select("id").single();
  if (error || !agency) return fail(error?.code === "23505" ? "Another agency already has that short name." : "Couldn't create the agency.");
  // Its first studio manager, who then adds everyone else from Team.
  const { data: created, error: userError } = await db.auth.admin.createUser({
    email,
    password: password as string,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });
  const profile = created?.user ? await db.from("profiles").insert({ id: created.user.id, email, full_name: fullName, role: "admin", agency_id: agency.id }) : null;
  if (userError || !created?.user || profile?.error) {
    if (created?.user) await db.auth.admin.deleteUser(created.user.id);
    await db.from("studio_settings").delete().eq("agency_id", agency.id);
    await db.from("agencies").delete().eq("id", agency.id);
    return fail(userError?.code === "email_exists" ? "Someone with that email already has an account." : "Couldn't create the first studio manager, so the agency wasn't created.");
  }
  updateTag("brand");
  refresh();
  return done(`${name} is ready at ${domains[0]}. ${fullName ?? email} signs in there with the password you set; share it with them privately.`);
}

export async function saveAgencyDomains(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requirePlatform();
  const id = text(formData, "agencyId");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Unknown agency.");
  const domains = readDomains(text(formData, "domains"));
  if (typeof domains === "string") return fail(domains);
  const db = createPlatformClient();
  const { data: agency } = await db.from("agencies").select("slug").eq("id", id).maybeSingle();
  if (!agency) return fail("Unknown agency.");
  // The first agency answers at every address no other agency claims, so it may have none.
  if (!domains.length && agency.slug !== "magik") return fail("Keep at least one address, or its people can't sign in.");
  const taken = await domainsTaken(domains, id);
  if (taken) return fail(taken);
  const { error } = await db.from("agencies").update({ domains }).eq("id", id);
  if (error) return fail("Couldn't save the addresses.");
  updateTag("brand");
  refresh();
  return done("Saved.");
}
