import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const TWO_HOURS = 60 * 60 * 2;

// Callers must have already confirmed (through RLS) that the viewer can see these rows.
export async function signedUrls(bucket: "footage" | "versions" | "brand" | "references", paths: string[]) {
  if (paths.length === 0) return new Map<string, string>();
  const admin = createAdminClient();
  const { data } = await admin.storage.from(bucket).createSignedUrls(paths, TWO_HOURS);
  const map = new Map<string, string>();
  data?.forEach((d) => {
    if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
  });
  return map;
}

export async function objectExists(bucket: "footage" | "versions" | "brand", path: string) {
  const admin = createAdminClient();
  const slash = path.lastIndexOf("/");
  const { data } = await admin.storage
    .from(bucket)
    .list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 1 });
  return !!data?.some((o) => o.name === path.slice(slash + 1));
}

// Links that download a file under a readable name ("Grand opening v2.mp4").
export async function downloadUrls(bucket: "versions" | "footage", items: { path: string; name: string }[]) {
  const admin = createAdminClient();
  const out = new Map<string, string>();
  await Promise.all(
    items.map(async ({ path, name }) => {
      const ext = path.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? ".mp4";
      const safe = name.normalize("NFKD").replace(/[^\w .-]+/g, "").trim().slice(0, 80) || "video";
      const { data } = await admin.storage.from(bucket).createSignedUrl(path, TWO_HOURS, { download: `${safe}${ext}` });
      if (data?.signedUrl) out.set(path, data.signedUrl);
    }),
  );
  return out;
}
