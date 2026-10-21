import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { appsFor } from "@/lib/apps";
import { displayName, getViewer } from "@/lib/auth";
import { desktopData } from "@/lib/desktop";
import { setupPending } from "@/lib/setup";
import { ROLE_LABEL } from "@/lib/workflow";
import { Desktop } from "@/components/desktop/desktop";

// The desktop: blocks on the session (the apps, the widgets and the setup check depend on it).
export const instant = false;

export const metadata: Metadata = { title: { absolute: "Magik OS" } };

export default async function Home({ searchParams }: { searchParams: Promise<{ open?: string; welcome?: string }> }) {
  const viewer = await getViewer();
  // A new client finishes the setup assistant before reaching the desktop.
  if (viewer.role === "client" && (await setupPending(viewer))) redirect("/setup");
  const [{ open, welcome }, data] = await Promise.all([searchParams, desktopData(viewer)]);
  return (
    <Desktop
      viewer={{ id: viewer.id, name: displayName(viewer), email: viewer.email, role: viewer.role, roleLabel: ROLE_LABEL[viewer.role] }}
      apps={appsFor(viewer.role)}
      data={data}
      initialOpen={open ?? null}
      welcome={welcome === "1"}
    />
  );
}
