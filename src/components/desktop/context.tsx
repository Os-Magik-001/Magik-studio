"use client";

import { createContext, use } from "react";
import type { AppDef } from "@/lib/apps";
import type { Database } from "@/lib/database.types";
import type { Area, Rect, State, Zoom } from "@/components/desktop/windows";

export type Role = Database["public"]["Enums"]["user_role"];
export type ShellViewer = { id: string; name: string; email: string; role: Role; roleLabel: string };

export type OpenOptions = { newWindow?: boolean };

// Magik OS around every app: the windows, the menu bar, the Dock, Spotlight, Mission Control.
export type DesktopApi = {
  viewer: ShellViewer;
  // The role's apps, the Dock's and the menu bar's.
  apps: AppDef[];
  unread: number;
  setUnread: (n: number) => void;
  wins: State["wins"];
  focused: string | null;
  area: Area;
  phone: boolean;
  mission: boolean;
  // Mission Control; with an app, only that app's windows (App Exposé).
  setMission: (on: boolean, appId?: string) => void;
  // Open a page in its window (an app, a video, a client folder…).
  open: (href: string, options?: OpenOptions) => void;
  focus: (id: string) => void;
  close: (id: string | string[]) => void;
  minimize: (id: string) => void;
  zoom: (id: string, zoom: Zoom) => void;
  place: (id: string, rect: Rect) => void;
  back: (id: string) => void;
  forward: (id: string) => void;
  reload: (id: string) => void;
  // The focused window's page changes its own address, without a step in its history.
  replace: (id: string, path: string) => void;
  // Every window to the Dock, the desktop in front.
  showDesktop: () => void;
  openSpotlight: () => void;
  // The Dock icon a window minimizes into.
  registerDockIcon: (appId: string, el: HTMLElement | null) => void;
  dockIconRect: (appId: string | null) => DOMRect | null;
  // Set while a window is dragged or resized, so the heavy glass can rest.
  setBusy: (busy: boolean) => void;
};

export const DesktopContext = createContext<DesktopApi | null>(null);

export function useDesktop() {
  const desktop = use(DesktopContext);
  if (!desktop) throw new Error("useDesktop outside the desktop");
  return desktop;
}

// For a page's own components: the window they're in, if any.
export type WindowState = { id: string; path: string; focused: boolean; visible: boolean };

export const WindowContext = createContext<WindowState | null>(null);

export const useWindowState = () => use(WindowContext);
