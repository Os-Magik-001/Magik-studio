import "server-only";
import { getAgency } from "@/lib/brand-server";
import { createPlatformClient, type Db } from "@/lib/supabase/admin";

// The server's own client, kept inside one agency. It still bypasses RLS (call it only after the
// caller's permission has been checked), but every query it makes is narrowed to the agency:
// reads, updates and deletes only match that agency's rows, and new rows are written into it.
// The database refuses a row that points into another agency (private.set_agency), so a row
// reached through one of these queries never leads outside.

// Tables whose rows may belong to no agency: the catalogue every agency reads.
const SHARED = new Set(["sound_libraries", "sound_files", "motion_prompts", "reference_library"]);
// Tables of the platform itself.
const PLATFORM = new Set(["agencies"]);

type Builder = Record<string, (...args: unknown[]) => unknown>;

function scopedTable(builder: Builder, table: string, agencyId: string) {
  const own = (q: unknown) => (q as Builder).eq("agency_id", agencyId);
  const readable = (q: unknown) => (SHARED.has(table) ? (q as Builder).or(`agency_id.is.null,agency_id.eq.${agencyId}`) : own(q));
  const stamp = (rows: unknown) => (Array.isArray(rows) ? rows.map((r) => ({ ...r, agency_id: agencyId })) : { ...(rows as object), agency_id: agencyId });
  return new Proxy(builder, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      const call = (...args: unknown[]) => (value as (...a: unknown[]) => unknown).apply(target, args);
      switch (prop) {
        case "select":
          return (...args: unknown[]) => readable(call(...args));
        case "insert":
        case "upsert":
          return (rows: unknown, ...rest: unknown[]) => call(stamp(rows), ...rest);
        case "update":
        case "delete":
          return (...args: unknown[]) => own(call(...args));
        default:
          return call;
      }
    },
  });
}

export function scopedClient(agencyId: string): Db {
  if (!/^[0-9a-f-]{36}$/i.test(agencyId)) throw new Error("Not an agency.");
  const client = createPlatformClient();
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (table: string) => {
          if (PLATFORM.has(table)) throw new Error(`${table} is not an agency's table.`);
          return scopedTable(target.from(table as never) as unknown as Builder, table, agencyId);
        };
      }
      // Reads through another schema would skip the narrowing above.
      if (prop === "schema") return () => {
        throw new Error("agencyDb() only reads the public schema.");
      };
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as Db;
}

// The agency of the current request (its address), or the one given: a worker passes the agency
// of the job it took.
export async function agencyDb(agencyId?: string): Promise<Db> {
  return scopedClient(agencyId ?? (await getAgency()).id);
}
