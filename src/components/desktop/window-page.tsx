"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { pathKey } from "@/lib/apps";
import { setContent } from "@/components/desktop/content";

// Wraps every app page: instead of rendering where the router puts it, the page hands its
// content to the window showing its address. The window keeps it when the router moves on to
// another window's page, so every open window stays live. A page that the router hides keeps
// its last content here (nothing is removed on cleanup); windows decide what to forget.
export function WindowPage({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const path = pathKey(pathname, search.toString());
  useLayoutEffect(() => {
    setContent(path, children);
  }, [path, children]);
  return null;
}
