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
