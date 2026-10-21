import { redirect } from "next/navigation";
import { appsFor } from "@/lib/apps";
import { displayName, getViewer } from "@/lib/auth";
import { setupPending } from "@/lib/setup";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL } from "@/lib/workflow";
import { Shell } from "@/components/shell/shell";
import { Wallpaper } from "@/components/shell/wallpaper";

// Every page here is per-user and checked against the session at request time.
export const instant = false;

// Magik OS: Home and every app, inside the menu bar and the Dock.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  // A new client finishes the setup assistant first.
  if (viewer.role === "client" && (await setupPending(viewer))) redirect("/setup");
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return (
    <>
      <Wallpaper />
      <Shell
        viewer={{ id: viewer.id, name: displayName(viewer), email: viewer.email, role: viewer.role, roleLabel: ROLE_LABEL[viewer.role] }}
        apps={appsFor(viewer.role)}
        unread={count ?? 0}
      >
        {children}
      </Shell>
    </>
  );
}
