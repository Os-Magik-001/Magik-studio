import { redirect } from "next/navigation";
import { getViewer, homeFor } from "@/lib/auth";

// A pure redirect: block on the session instead of streaming a shell first.
export const instant = false;

export default async function Home() {
  const viewer = await getViewer();
  redirect(homeFor(viewer.role));
}
