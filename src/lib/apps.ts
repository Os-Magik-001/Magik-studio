import type { Database } from "@/lib/database.types";

// The desktop's apps: every feature of Magik OS is an app in the Dock, and opens in its own
// window. Shared by the server (which apps a role gets) and the browser (the Dock, the windows'
// titles, Spotlight).

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
  | "video"
  | "make"
  | "calendar"
  | "website"
  | "sales"
  | "referral"
  | "help";

export type AppDef = {
  id: string;
  name: string;
  // Where the app opens.
  href: string;
  // The paths it owns: its pages open in its window, and the Dock lights it up there.
  match: string[];
  // Its icon (src/components/shell/app-icon.tsx).
  icon: AppIconName;
  roles: Role[];
  // One line for Spotlight.
  hint: string;
  // The window's size when it first opens, in pixels.
  size: [number, number];
  // Opened from the menu bar instead of the Dock.
  dock?: false;
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
    roles: ["admin", "editor"],
    hint: "Every video, by phase, and what's next",
    size: [1320, 860],
  },
  {
    id: "client-pipeline",
    name: "Pipeline",
    href: "/pipeline",
    match: ["/pipeline"],
    icon: "pipeline",
    roles: ["client"],
    hint: "Where each of your videos is: script, shoot, edit, review",
    size: [1240, 840],
  },
  {
    id: "videos",
    name: "Your videos",
    href: "/review",
    match: ["/review"],
    icon: "videos",
    roles: ["client"],
    hint: "Watch, download, comment and approve your videos",
    size: [1240, 840],
  },
  {
    id: "make",
    name: "Make a video",
    href: "/make",
    match: ["/make"],
    icon: "make",
    roles: ["admin", "editor"],
    hint: "Footage in, finished video out: the edit engine, without the client steps",
    size: [1220, 880],
  },
  {
    id: "clients",
    name: "Clients",
    href: "/clients",
    match: ["/clients"],
    icon: "clients",
    roles: ["admin", "editor"],
    hint: "Client folders, brand kits and references",
    size: [1180, 820],
  },
  {
    id: "onboarding",
    name: "Onboarding",
    href: "/onboarding",
    match: ["/onboarding"],
    icon: "onboarding",
    roles: ["admin", "seller"],
    hint: "Set up a new client, then send them their link",
    size: [1180, 840],
  },
  {
    id: "sales",
    name: "Sales",
    href: "/sales",
    match: ["/sales"],
    icon: "sales",
    roles: ["admin", "seller"],
    hint: "The sales workspace",
    size: [1100, 760],
  },
  {
    id: "calendar",
    name: "Calendar",
    href: "/calendar",
    match: ["/calendar"],
    icon: "calendar",
    roles: EVERYONE,
    hint: "Your events, shoots, deadlines and posting dates",
    size: [1280, 860],
  },
  {
    id: "agents",
    name: "Agents",
    href: "/agents",
    match: ["/agents"],
    icon: "agents",
    roles: ["admin", "editor"],
    hint: "Mission control for the studio's agents",
    size: [1320, 880],
  },
  {
    id: "library",
    name: "Library",
    href: "/library",
    match: ["/library"],
    icon: "library",
    roles: ["admin", "editor"],
    hint: "Reference videos clients pick from",
    size: [1120, 800],
  },
  {
    id: "sounds",
    name: "Sound",
    href: "/sounds",
    match: ["/sounds"],
    icon: "sound",
    roles: ["admin", "editor"],
    hint: "Music and sound-effect libraries",
    size: [1100, 780],
  },
  {
    id: "prompts",
    name: "Motion",
    href: "/prompts",
    match: ["/prompts"],
    icon: "prompts",
    roles: ["admin", "editor"],
    hint: "Motion prompt library",
    size: [1120, 800],
  },
  {
    id: "shoots",
    name: "Shoots",
    href: "/shoots",
    match: ["/shoots"],
    icon: "shoots",
    roles: ["admin", "videographer"],
    hint: "Shoot calendar, shot lists and footage",
    size: [1120, 800],
  },
  {
    id: "brand",
    name: "Your brand",
    href: "/brand",
    match: ["/brand"],
    icon: "brand",
    roles: ["client"],
    hint: "Your logo, colors and brand questions",
    size: [1040, 800],
  },
  {
    id: "website",
    name: "Website",
    href: "/website",
    match: ["/website"],
    icon: "website",
    roles: ["client"],
    hint: "Your website made with Magik",
    size: [1220, 840],
  },
  {
    id: "team",
    name: "Team",
    href: "/team",
    match: ["/team"],
    icon: "team",
    roles: ["admin"],
    hint: "People, roles, passwords, paused and deleted accounts",
    size: [1080, 760],
  },
  {
    id: "referrals",
    name: "Referrals",
    href: "/referrals",
    match: ["/referrals"],
    icon: "referral",
    roles: EVERYONE,
    hint: "Your referral link and your credits",
    size: [1060, 780],
  },
  {
    id: "settings",
    name: "Settings",
    href: "/account",
    match: ["/account"],
    icon: "settings",
    roles: EVERYONE,
    hint: "Account, appearance, notifications, calendar, security and documents",
    size: [1080, 760],
  },
  {
    id: "notifications",
    name: "Notifications",
    href: "/notifications",
    match: ["/notifications"],
    icon: "bell",
    roles: EVERYONE,
    hint: "New versions, comments and approvals",
    size: [760, 720],
    dock: false,
  },
  {
    id: "help",
    name: "Help",
    href: "/help",
    match: ["/help"],
    icon: "help",
    roles: EVERYONE,
    hint: "How Magik OS works, and a question for the studio",
    size: [960, 780],
    dock: false,
  },
];

// Home: the desktop itself, first in the Dock.
export const HOME: AppDef = {
  id: "home",
  name: "Home",
  href: "/",
  match: [],
  icon: "home",
  roles: EVERYONE,
  hint: "Your day, your numbers, and what needs you",
  size: [0, 0],
};

export const appsFor = (role: Role) => APPS.filter((a) => a.roles.includes(role));

export const appById = (id: string) => (id === "home" ? HOME : (APPS.find((a) => a.id === id) ?? null));

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

// ---------------------------------------------------------------- windows

// The window a page opens in. Each app has one main window for its lists; a video, a client
// folder or a client's onboarding opens in a window of its own, whichever page of it is shown
// (a video's page, its review room and its shoot page share one window).
export type WindowTarget = { key: string; appId: string | null; doc: boolean; size: [number, number] };

const UUID = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})";
const DOCS: { re: RegExp; kind: string; app: (role: Role) => string; size: [number, number] }[] = [
  { re: new RegExp(`^/(?:videos|review)/${UUID}(?:/|$)`, "i"), kind: "video", app: (role) => (role === "client" ? "videos" : "pipeline"), size: [1220, 900] },
  { re: new RegExp(`^/shoots/${UUID}(?:/|$)`, "i"), kind: "video", app: () => "shoots", size: [1120, 860] },
  { re: new RegExp(`^/make/${UUID}(?:/|$)`, "i"), kind: "video", app: () => "make", size: [1240, 900] },
  { re: new RegExp(`^/clients/${UUID}(?:/|$)`, "i"), kind: "client", app: () => "clients", size: [1200, 880] },
  { re: new RegExp(`^/onboarding/${UUID}(?:/|$)`, "i"), kind: "onboarding", app: () => "onboarding", size: [1140, 880] },
];

// Pages that aren't apps: they open in a browser tab of their own, or are reached before the
// desktop (sign-in, the client's setup, a paused account).
const OUTSIDE = ["/invoices", "/scripts", "/setup", "/login", "/join", "/auth", "/api", "/r", "/paused"];

export const isDesktopPath = (pathname: string) => !OUTSIDE.some((p) => owns(p, pathname));

export function windowFor(path: string, role: Role): WindowTarget | null {
  const pathname = path.split(/[?#]/)[0] || "/";
  if (pathname === "/" || !isDesktopPath(pathname)) return null;
  for (const d of DOCS) {
    const m = pathname.match(d.re);
    if (!m) continue;
    const app = appById(d.app(role));
    if (app && app.roles.includes(role)) return { key: `${d.kind}:${m[1].toLowerCase()}`, appId: app.id, doc: true, size: d.size };
  }
  const app = appForPath(pathname, role);
  if (app && app.id !== "home") return { key: `app:${app.id}`, appId: app.id, doc: false, size: app.size };
  return { key: `page:${pathname}`, appId: null, doc: false, size: [1000, 760] };
}

// A page's address as the windows know it: path and query, no hash.
export function pathKey(pathname: string, search: string) {
  const q = search.startsWith("?") ? search.slice(1) : search;
  return q ? `${pathname}?${q}` : pathname;
}
