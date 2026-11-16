import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// The server's own client: it bypasses RLS and sees every agency's rows. Only for what belongs
// to no agency (finding the agency of an address, the platform's own pages). Everything else
// goes through agencyDb() (@/lib/supabase/agency), which keeps to one agency.
export function createPlatformClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// Either client: the signed-in user's (RLS) or the server's own.
export type Db = SupabaseClient<Database>;
