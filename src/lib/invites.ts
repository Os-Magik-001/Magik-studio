import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { linkState } from "@/lib/onboarding";

// The link a seller sends a new client: /join/<token>. Only the token's hash is stored, so the
// link can't be read back from the database; a lost link is replaced by a new one.

export const newToken = () => randomBytes(24).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

export async function inviteByToken(token: string) {
  if (!TOKEN.test(token)) return null;
  const { data } = await createAdminClient()
    .from("client_invites")
    .select(
      "id, client_id, email, expires_at, sent_at, opened_at, used_at, revoked_at, created_by, clients(id, name, contact_name, email, language, pack_id, packs(name, price_cents, billing, videos_per_month, revision_rounds, features))",
    )
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!data?.clients) return null;
  return { ...data, client: data.clients, state: linkState(data) };
}

// This deployment's address, for links that leave the app.
export async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
