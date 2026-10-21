import type { Database } from "@/lib/database.types";

// The desktop's apps: every feature of Magik OS is an app in the Dock, and opens as its own
// screen. Shared by the server (which apps a role gets) and the browser (the Dock, the screen's
// title, Spotlight).

type Role = Database["public"]["Enums"]["user_role"];

export type AppIconName =
  | "home"
  | "finance"
  | "pipeline"
  | "clients"
  | "onboarding"
  | "agents"
  | "library"
  | "sound"
  | "prompts"
  | "shoots"
  | "team"
  | "bell"
  | "settings"
  | "videos"
  | "brand"
  | "documents"
  | "video";

export type AppDef = {
  id: string;
  name: string;
  // Where the app opens.
  href: string;
  // The paths it owns: its screens, and the Dock lights it up there.
  match: string[];
  icon: AppIconName;
  // The icon's gradient, top to bottom, and the glyph color.
  tint: [string, string];
  glyph?: string;
  roles: Role[];
  // One line for Spotlight.
  hint: string;
};

const EVERYONE: Role[] = ["admin", "editor", "videographer", "client", "seller"];

export const APPS: AppDef[] = [
  {
    id: "pipeline",
    name: "Pipeline",
    href: "/pipeline",
    // A video and its review room belong to production for the studio.
    match: ["/pipeline", "/videos", "/review"],
    icon: "pipeline",
    tint: ["#ffe36e", "#d9a60c"],
    glyph: "#1c1400",
    roles: ["admin", "editor"],
    hint: "Every video, by phase, and what's next",
  },
  {
    id: "clients",
    name: "Clients",
    href: "/clients",
    match: ["/clients"],
    icon: "clients",
    tint: ["#5ac8fa", "#0a6fe0"],
    roles: ["admin", "editor"],
    hint: "Client folders, brand kits and references",
  },
  {
    id: "onboarding",
    name: "Onboarding",
    href: "/onboarding",
    match: ["/onboarding"],
    icon: "onboarding",
    tint: ["#5fe38f", "#17a347"],
    roles: ["admin", "seller"],
    hint: "Set up a new client, then send them their link",
  },
  {
    id: "agents",
    name: "Agents",
    href: "/agents",
    match: ["/agents"],
    icon: "agents",
    tint: ["#d07bff", "#7a2fd6"],
    roles: ["admin", "editor"],
    hint: "Mission control for the studio's agents",
  },
  {
    id: "library",
    name: "Library",
    href: "/library",
    match: ["/library"],
    icon: "library",
    tint: ["#6ee7f9", "#0e8fb0"],
    roles: ["admin", "editor"],
    hint: "Reference videos clients pick from",
  },
  {
    id: "sounds",
    name: "Sound",
    href: "/sounds",
    match: ["/sounds"],
    icon: "sound",
    tint: ["#ff7a93", "#e0244c"],
    roles: ["admin", "editor"],
    hint: "Music and sound-effect libraries",
  },
  {
    id: "prompts",
    name: "Motion",
    href: "/prompts",
    match: ["/prompts"],
    icon: "prompts",
    tint: ["#ffbf5a", "#f2690c"],
    roles: ["admin", "editor"],
    hint: "Motion prompt library",
  },
  {
    id: "shoots",
    name: "Shoots",
    href: "/shoots",
    match: ["/shoots"],
    icon: "shoots",
    tint: ["#ff8a7a", "#e3301f"],
    roles: ["admin", "videographer"],
    hint: "Shoot calendar, shot lists and footage",
  },
  {
    id: "team",
    name: "Team",
    href: "/team",
    match: ["/team"],
    icon: "team",
    tint: ["#a1a1aa", "#52525b"],
    roles: ["admin"],
    hint: "People, roles and passwords",
  },
  {
    id: "videos",
    name: "Your videos",
    href: "/review",
    match: ["/review"],
    icon: "videos",
    tint: ["#ffe36e", "#d9a60c"],
    glyph: "#1c1400",
    roles: ["client"],
    hint: "Watch, comment and approve your videos",
  },
  {
    id: "brand",
    name: "Your brand",
    href: "/brand",
    match: ["/brand"],
    icon: "brand",
    tint: ["#ff9ad5", "#a93df0"],
    roles: ["client"],
    hint: "Your logo, colors and brand questions",
  },
  {
    id: "documents",
    name: "Documents",
    href: "/documents",
    match: ["/documents"],
    icon: "documents",
    tint: ["#7cc4ff", "#2f6bf0"],
    roles: ["client"],
    hint: "Your invoices and contract",
  },
  {
    id: "notifications",
    name: "Notifications",
    href: "/notifications",
    match: ["/notifications"],
    icon: "bell",
    tint: ["#ff7066", "#d7261e"],
    roles: EVERYONE,
    hint: "New versions, comments and approvals",
  },
  {
    id: "settings",
    name: "Settings",
    href: "/account",
    match: ["/account"],
    icon: "settings",
    tint: ["#9a9aa2", "#46464c"],
    roles: EVERYONE,
    hint: "Your account, password and wallpaper",
  },
];

// Home: the command center, first in the Dock.
export const HOME: AppDef = {
  id: "home",
  name: "Home",
  href: "/",
  match: [],
  icon: "home",
  tint: ["#2a2620", "#0d0c0a"],
  glyph: "#f6d43a",
  roles: EVERYONE,
  hint: "Your day, your numbers, and what needs you",
};

export const appsFor = (role: Role) => APPS.filter((a) => a.roles.includes(role));

export const appById = (id: string) => APPS.find((a) => a.id === id) ?? null;

const owns = (prefix: string, path: string) => path === prefix || path.startsWith(prefix + "/");

// The app a path belongs to, for this role (the longest matching prefix wins).
export function appForPath(path: string, role: Role): AppDef | null {
  const pathname = path.split(/[?#]/)[0] || "/";
  if (pathname === "/") return HOME;
  let best: AppDef | null = null;
  let bestLength = -1;
  for (const app of appsFor(role)) {
    for (const m of app.match) {
      if (owns(m, pathname) && m.length > bestLength) {
        best = app;
        bestLength = m.length;
      }
    }
  }
  return best;
}
