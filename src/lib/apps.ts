import type { Database } from "@/lib/database.types";

// The desktop's apps: every feature of Magik OS opens as an app in its own window.
// Shared by the server (which apps a role gets, which paths belong to the desktop) and the
// browser (the dock, Spotlight, and which window a link opens in).

type Role = Database["public"]["Enums"]["user_role"];

export type AppIconName =
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
  // The paths it owns: links to them open in this app's window.
  match: string[];
  icon: AppIconName;
  // The icon's gradient, top to bottom, and the glyph color.
  tint: [string, string];
  glyph?: string;
  roles: Role[];
  // One line for Spotlight and the dock's tooltip.
  hint: string;
  // Default window size.
  size?: [number, number];
};

const EVERYONE: Role[] = ["admin", "editor", "videographer", "client", "seller"];

export const APPS: AppDef[] = [
  {
    id: "pipeline",
    name: "Pipeline",
    href: "/pipeline",
    match: ["/pipeline"],
    icon: "pipeline",
    tint: ["#ffe36e", "#d9a60c"],
    glyph: "#1c1400",
    roles: ["admin", "editor"],
    hint: "Every video, by phase, and what's next",
    size: [1240, 820],
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
    size: [1180, 800],
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
    size: [1280, 840],
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
    size: [980, 720],
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
    size: [1240, 820],
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
    size: [920, 720],
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
    size: [760, 720],
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
    size: [820, 720],
  },
];

// Pages that open as documents in their own window, one window per document (staff open a
// video from the pipeline, a client folder or a notification).
export const DOCUMENTS = [
  { prefix: "/videos/", name: "Video", icon: "video", tint: ["#ffe36e", "#d9a60c"], glyph: "#1c1400" },
  { prefix: "/review/", name: "Review", icon: "videos", tint: ["#ffd479", "#e08a0b"], glyph: "#1c1400" },
] as const satisfies readonly { prefix: string; name: string; icon: AppIconName; tint: [string, string]; glyph?: string }[];

export const appsFor = (role: Role) => APPS.filter((a) => a.roles.includes(role));

export const appById = (id: string) => APPS.find((a) => a.id === id) ?? null;

const owns = (prefix: string, path: string) => path === prefix || path.startsWith(prefix + "/");

export type WindowTarget = {
  // Windows are unique by key: one per app, one per document.
  key: string;
  appId: string | null;
  name: string;
  icon: AppIconName;
  tint: [string, string];
  glyph?: string;
  size?: [number, number];
};

// Which window a path opens in, for this role.
export function windowFor(path: string, role: Role): WindowTarget | null {
  const pathname = path.split(/[?#]/)[0] || "/";
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
  if (best) {
    return { key: best.id, appId: best.id, name: best.name, icon: best.icon, tint: best.tint, glyph: best.glyph, size: best.size };
  }
  const doc = DOCUMENTS.find((d) => pathname.startsWith(d.prefix));
  if (doc) {
    const id = pathname.slice(doc.prefix.length).split("/")[0];
    return { key: `doc:${doc.prefix}${id}`, appId: null, name: doc.name, icon: doc.icon, tint: [...doc.tint], glyph: doc.glyph, size: [1240, 840] };
  }
  return null;
}

// Every path that belongs on the desktop. Opened on their own (a bookmark, a new tab, a link
// in an email), they open the desktop with the page in a window.
export const WINDOW_PREFIXES = [...new Set([...APPS.flatMap((a) => a.match), ...DOCUMENTS.map((d) => d.prefix.slice(0, -1))])];

export const isWindowPath = (path: string) => WINDOW_PREFIXES.some((p) => owns(p, path));

// Only same-origin paths into the desktop may be opened from a URL.
export function safeOpenPath(raw: string | null | undefined) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  return isWindowPath(raw.split(/[?#]/)[0]) ? raw : null;
}
