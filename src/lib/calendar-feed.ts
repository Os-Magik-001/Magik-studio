import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// A person's private calendar link, for Google or Apple Calendar to subscribe to:
// /api/calendar/<id>.<nonce>.<sig>.ics, where sig is an HMAC of the id and the nonce made with
// the server's key. A new nonce (a new link) makes the old one stop working.

const sign = (userId: string, nonce: string) =>
  createHmac("sha256", process.env.SUPABASE_SECRET_KEY ?? "").update(`magik-calendar:${userId}:${nonce}`).digest("base64url").slice(0, 32);

export async function feedToken(userId: string, fresh = false) {
  const admin = createAdminClient();
  let nonce: string | null = null;
  if (!fresh) {
    const { data } = await admin.from("calendar_feeds").select("nonce").eq("user_id", userId).maybeSingle();
    nonce = data?.nonce ?? null;
  }
  if (!nonce) {
    nonce = randomBytes(9).toString("base64url");
    await admin.from("calendar_feeds").upsert({ user_id: userId, nonce, created_at: new Date().toISOString() });
  }
  return `${userId}.${nonce}.${sign(userId, nonce)}`;
}

// The person a link belongs to, or null if it's not (or no longer) valid.
export async function feedOwner(token: string): Promise<string | null> {
  const m = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{6,40})\.([A-Za-z0-9_-]{32})$/i.exec(token);
  if (!m) return null;
  const [, userId, nonce, sig] = m;
  const expected = Buffer.from(sign(userId, nonce));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const { data } = await createAdminClient().from("calendar_feeds").select("nonce").eq("user_id", userId).maybeSingle();
  return data?.nonce === nonce ? userId : null;
}
