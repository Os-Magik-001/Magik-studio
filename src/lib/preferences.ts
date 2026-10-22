// Each person's settings (profiles.preferences): the desktop's look, the notifications they
// muted, their calendar. Shared by the server (what to save, whom to notify) and the browser
// (what to apply).

export const DOCK_SIZES = ["large", "medium", "small"] as const;
export type DockSize = (typeof DOCK_SIZES)[number];

export const CALENDAR_VIEWS = ["month", "week", "day", "agenda"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export type Preferences = {
  wallpaper?: string;
  // How much the wallpaper is darkened, 0 to 60 (%).
  dim?: number;
  dock?: DockSize;
  // The app names under the Dock's icons.
  labels?: boolean;
  // "solid": windows without transparency.
  solid?: boolean;
  // Notification categories the person doesn't want.
  muted?: string[];
  // 0: weeks start on Sunday, 1: on Monday.
  weekStart?: 0 | 1;
  calendarView?: CalendarView;
};

export const NOTIFICATION_CATEGORIES = [
  { key: "videos", label: "New versions and approvals", hint: "A cut is ready, sent, approved, or changes are asked" },
  { key: "comments", label: "Comments", hint: "Someone comments on a video" },
  { key: "scripts", label: "Scripts", hint: "A script is ready, approved, or changes are asked" },
  { key: "shoots", label: "Shoots and footage", hint: "A shoot is planned, footage arrives" },
  { key: "production", label: "Production news", hint: "Research, content plans, designs and music" },
  { key: "onboarding", label: "Onboarding", hint: "A client opens their account, signs, finishes their setup" },
  { key: "calendar", label: "Calendar", hint: "You're invited to an event" },
  { key: "referrals", label: "Referrals and credits", hint: "Someone you referred signs up, credits arrive" },
  { key: "studio", label: "Messages from the studio", hint: "Help answers, your website, account news" },
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]["key"];

// The category a notification kind belongs to.
export function categoryOf(kind: string): NotificationCategory {
  if (kind === "comment") return "comments";
  if (kind.startsWith("script") || kind === "revise") return "scripts";
  if (kind === "shoot_scheduled" || kind === "footage_in") return "shoots";
  if (kind.startsWith("onboarding") || kind === "invoice" || kind === "client") return "onboarding";
  if (kind.startsWith("calendar")) return "calendar";
  if (kind.startsWith("referral") || kind.startsWith("credit")) return "referrals";
  if (kind.startsWith("help") || kind.startsWith("website") || kind.startsWith("account")) return "studio";
  if (["production", "strategy", "plan", "design", "music", "sfx", "logos", "adapt"].includes(kind)) return "production";
  return "videos";
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

// Whatever is stored, as clean preferences (unknown keys and bad values dropped).
export function readPreferences(raw: unknown): Preferences {
  if (!isRecord(raw)) return {};
  const p: Preferences = {};
  if (typeof raw.wallpaper === "string" && /^[a-z0-9-]{1,40}$/.test(raw.wallpaper)) p.wallpaper = raw.wallpaper;
  if (typeof raw.dim === "number" && Number.isFinite(raw.dim)) p.dim = Math.max(0, Math.min(60, Math.round(raw.dim)));
  if (typeof raw.dock === "string" && (DOCK_SIZES as readonly string[]).includes(raw.dock)) p.dock = raw.dock as DockSize;
  if (typeof raw.labels === "boolean") p.labels = raw.labels;
  if (typeof raw.solid === "boolean") p.solid = raw.solid;
  if (Array.isArray(raw.muted)) {
    const keys = NOTIFICATION_CATEGORIES.map((c) => c.key as string);
    p.muted = raw.muted.filter((m): m is string => typeof m === "string" && keys.includes(m));
  }
  if (raw.weekStart === 0 || raw.weekStart === 1) p.weekStart = raw.weekStart;
  if (typeof raw.calendarView === "string" && (CALENDAR_VIEWS as readonly string[]).includes(raw.calendarView)) p.calendarView = raw.calendarView as CalendarView;
  return p;
}

// The desktop's look: the part of the preferences Settings > Appearance changes.
export type Look = Pick<Preferences, "wallpaper" | "dim" | "dock" | "labels" | "solid">;

export const lookOf = (p: Preferences): Look => ({ wallpaper: p.wallpaper, dim: p.dim, dock: p.dock, labels: p.labels, solid: p.solid });

export const hasLook = (l: Look) => Object.values(l).some((v) => v !== undefined);
