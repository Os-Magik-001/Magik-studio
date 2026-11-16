// The two-agency leak test (white label, step 2). It sets up a second agency next to Magik in a
// LOCAL database, then checks from both sides that nothing crosses: every table through the
// signed-in person's access (RLS), writes aimed at the other agency, the storage buckets, and
// the database's own guard on rows that point into another agency.
//
//   supabase start, then:
//   node scripts/agency-walls.mjs <api url> <publishable key> <secret key> <an admin of the first agency's email> <their password>
//
// It refuses to run against anything but a local database. It exits 1 on any leak.
import { createClient } from "@supabase/supabase-js";

const [url, publishable, secret, firstEmail, firstPassword] = process.argv.slice(2);
if (!url || !publishable || !secret || !firstEmail || !firstPassword) throw new Error("usage: agency-walls.mjs <url> <publishable key> <secret key> <first agency admin email> <password>");
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) throw new Error("This test writes rows: it only runs against a local database.");

const TABLES = [
  "agent_runs", "brand_kits", "brand_questionnaires", "brand_strategies", "calendar_attendees", "calendar_events", "calendar_feeds",
  "client_invites", "client_team", "clients", "comments", "contracts", "credit_ledger", "edit_jobs", "footage", "help_requests", "invoices",
  "motion_prompts", "notifications", "onboardings", "packs", "profiles", "reference_library", "reference_videos", "referrals",
  "script_revisions", "scripts", "shoots", "sound_files", "sound_libraries", "studio_settings", "trend_reports", "usage_events", "versions", "videos",
];
const SHARED = new Set(["motion_prompts", "reference_library", "sound_libraries", "sound_files"]);
const PASSWORD = "walls-test-2026";
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, secret, opts);

let failed = 0;
let passed = 0;
const check = (ok, what, detail = "") => {
  if (ok) passed++;
  else {
    failed++;
    console.log(`  LEAK  ${what}${detail ? `: ${detail}` : ""}`);
  }
};
const must = async (q, what) => {
  const { data, error } = await q;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

// ---------------------------------------------------------------- two agencies

const first = (await must(service.from("agencies").select("id").eq("slug", "magik").single(), "first agency")).id;
await service.from("agencies").upsert({ slug: "walls-test", name: "Walls Test", domains: ["walls.localhost"] }, { onConflict: "slug" });
const second = (await must(service.from("agencies").select("id").eq("slug", "walls-test").single(), "second agency")).id;

async function person(email, role, extra = {}) {
  const { data: list } = await service.auth.admin.listUsers({ perPage: 1000 });
  let user = list.users.find((u) => u.email === email);
  if (!user) user = (await must(service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true }), `create ${email}`)).user;
  await must(service.from("profiles").upsert({ id: user.id, email, role, agency_id: second, ...extra }), `profile ${email}`);
  return user.id;
}
const one = async (table, match, row) => {
  const found = await must(service.from(table).select("id").match(match).limit(1), table);
  return found[0]?.id ?? (await must(service.from(table).insert({ ...match, ...row, agency_id: second }).select("id").single(), `insert ${table}`)).id;
};

await person("admin@walls.test", "admin");
const bClient = await one("clients", { name: "Walls Test Client" }, {});
const bVideo = await one("videos", { title: "Walls test video", client_id: bClient }, {});
await person("client@walls.test", "client", { client_id: bClient });
await one("packs", { name: "Walls pack" }, { price_cents: 100000 }).catch(() => null);

// One row of the first agency per kind of thing to aim at.
const aClient = (await must(service.from("clients").select("id, name").eq("agency_id", first).limit(1), "a client"))[0];
const aVideo = (await must(service.from("videos").select("id").eq("agency_id", first).limit(1), "a video"))[0];
const aProfile = (await must(service.from("profiles").select("id").eq("agency_id", first).eq("role", "editor").limit(1), "a profile"))[0];
if (!aClient || !aVideo || !aProfile) throw new Error("The first agency needs at least a client, a video and an editor to test against.");

const signIn = async (email, password) => {
  const c = createClient(url, publishable, opts);
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return c;
};
const asSecond = await signIn("admin@walls.test", PASSWORD);
const asSecondClient = await signIn("client@walls.test", PASSWORD);
const asFirst = await signIn(firstEmail, firstPassword);

// ---------------------------------------------------------------- reads, table by table

async function reads(client, who, own, other) {
  for (const table of TABLES) {
    const { data, error } = await client.from(table).select("agency_id").limit(5000);
    if (error) {
      check(false, `${who} reads ${table}`, error.message);
      continue;
    }
    const foreign = data.filter((r) => r.agency_id !== own && !(SHARED.has(table) && r.agency_id === null));
    check(foreign.length === 0, `${who} reads ${table}`, `${foreign.length} row(s) of another agency`);
    void other;
  }
  check((await client.from("agencies").select("id")).data?.length ? false : true, `${who} reads agencies`);
}
console.log("Reads through each person's own access");
await reads(asSecond, "second agency's admin", second, first);
await reads(asSecondClient, "second agency's client", second, first);
await reads(asFirst, "first agency's admin", first, second);
check(((await asSecond.from("clients").select("id")).data ?? []).some((c) => c.id === bClient), "second agency's admin sees their own client");
check(((await asFirst.from("clients").select("id")).data ?? []).some((c) => c.id === aClient.id), "first agency's admin sees their own client");
for (const [table, id] of [["clients", aClient.id], ["videos", aVideo.id], ["profiles", aProfile.id]]) {
  check(((await asSecond.from(table).select("id").eq("id", id)).data ?? []).length === 0, `second agency's admin opens a ${table} row of the first by its id`);
}

// ---------------------------------------------------------------- writes aimed across

console.log("Writes aimed at the other agency");
const before = aClient.name;
await asSecond.from("clients").update({ name: "taken over" }).eq("id", aClient.id);
check((await must(service.from("clients").select("name").eq("id", aClient.id).single(), "reread")).name === before, "second agency's admin renames a client of the first");
await asSecond.from("videos").delete().eq("id", aVideo.id);
check(!!(await must(service.from("videos").select("id").eq("id", aVideo.id), "reread")).length, "second agency's admin deletes a video of the first");
for (const [what, table, row] of [
  ["a video under the first agency's client", "videos", { title: "planted", client_id: aClient.id }],
  ["a shoot on the first agency's video", "shoots", { video_id: aVideo.id, starts_at: new Date().toISOString() }],
  ["a video stamped with the first agency", "videos", { title: "planted", client_id: bClient, agency_id: first }],
  ["an own video assigned to the first agency's editor", "videos", { title: "planted", client_id: bClient, editor_id: aProfile.id }],
]) {
  const { data, error } = await asSecond.from(table).insert(row).select("id");
  check(!!error && !data?.length, `second agency's admin inserts ${what}`);
  if (data?.length) await service.from(table).delete().eq("id", data[0].id);
}

// ---------------------------------------------------------------- the database's own guard (server writes)

console.log("Rows that point into another agency, written by the server");
for (const [what, table, row] of [
  ["a video of the second agency under the first's client", "videos", { title: "planted", client_id: aClient.id, agency_id: second }],
  ["a comment-like child (shoot) of the second agency on the first's video", "shoots", { video_id: aVideo.id, starts_at: new Date().toISOString(), agency_id: second }],
  ["a notification of the second agency for the first's person", "notifications", { user_id: aProfile.id, kind: "test", title: "planted", agency_id: second }],
  ["a second-agency video with the first's editor", "videos", { title: "planted", client_id: bClient, editor_id: aProfile.id }],
]) {
  const { data, error } = await service.from(table).insert(row).select("id");
  check(!!error && !data?.length, `the server writes ${what}`);
  if (data?.length) await service.from(table).delete().eq("id", data[0].id);
}
{
  // A child with no agency given takes its parent's.
  const { data } = await service.from("shoots").insert({ video_id: bVideo, starts_at: new Date().toISOString() }).select("id, agency_id").single();
  check(data?.agency_id === second, "a new shoot takes its video's agency");
  if (data) {
    await service.from("shoots").update({ agency_id: first }).eq("id", data.id);
    check((await must(service.from("shoots").select("agency_id").eq("id", data.id).single(), "reread")).agency_id === second, "a row can be moved to another agency");
    const moved = await service.from("shoots").update({ video_id: aVideo.id }).eq("id", data.id).select("id");
    check(!!moved.error, "a shoot can be re-pointed to another agency's video");
    await service.from("shoots").delete().eq("id", data.id);
  }
}

// ---------------------------------------------------------------- files

console.log("Storage");
const file = new Blob(["x"], { type: "image/png" });
for (const [bucket, id, what] of [["brand", aClient.id, "client"], ["footage", aVideo.id, "video"], ["versions", aVideo.id, "video"]]) {
  const path = `${id}/walls-test-${Date.now()}.png`;
  const { error } = await asSecond.storage.from(bucket).upload(path, file);
  check(!!error, `second agency's admin uploads to ${bucket} under the first agency's ${what}`);
  if (!error) await service.storage.from(bucket).remove([path]);
}
{
  const path = `${bClient}/walls-test-${Date.now()}.png`;
  const { error } = await asSecond.storage.from("brand").upload(path, file);
  check(!error, "second agency's admin uploads under their own client", error?.message);
  await service.storage.from("brand").remove([path]);
}

// ---------------------------------------------------------------- numbering

console.log("One of each, per agency");
const n1 = await service.rpc("take_invoice_number", { agency: second });
check(!n1.error && /^WAL-/.test(n1.data ?? ""), "the second agency numbers its own invoices", n1.error?.message ?? String(n1.data));
check((await asSecond.rpc("take_invoice_number", { agency: first })).error != null, "a signed-in person takes an invoice number of another agency");
check((await asSecond.rpc("claim_agent_run", {})).error != null, "a signed-in person claims an agent run");

console.log(failed ? `\n${failed} leak(s), ${passed} checks passed.` : `\nNo leaks: ${passed} checks passed.`);
process.exit(failed ? 1 : 0);
