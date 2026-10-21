"use client";

import { createContext, use } from "react";
import type { AppDef } from "@/lib/apps";
import type { Database } from "@/lib/database.types";

export type Role = Database["public"]["Enums"]["user_role"];
export type ShellViewer = { id: string; name: string; email: string; role: Role; roleLabel: string };

export type ShellState = {
  viewer: ShellViewer;
  apps: AppDef[];
  unread: number;
  // An app screen fills the whole window (the green button).
  full: boolean;
  setFull: (full: boolean) => void;
  openSpotlight: () => void;
};

export const ShellContext = createContext<ShellState | null>(null);

export function useShell() {
  const shell = use(ShellContext);
  if (!shell) throw new Error("useShell outside the shell");
  return shell;
}
