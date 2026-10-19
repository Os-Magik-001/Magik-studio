// Shapes the agents store, shared by the server code and the pages that show them.

export type Charte = {
  palette: { name: string; hex: string; role: string }[];
  fonts: { headline: string; body: string; notes: string };
  typography: string[];
  captions: { preset: string; highlight: string; notes: string };
  motion: string;
  music_mood: string;
  tone_of_voice: string;
  logo_usage: string;
  dos: string[];
  donts: string[];
};

export type Pillar = { name: string; description: string; ideas: string[] };

export type TrendReel = {
  url: string;
  owner: string;
  plays: number | null;
  likes: number | null;
  comments: number | null;
  duration: number | null;
  caption: string;
  cutsPerSecond: number | null;
  // "Song · Artist", when Instagram reported it.
  audio?: string | null;
  why: string;
  hook: string;
  techniques: string[];
};

export type TrendFindings = {
  summary: string;
  hooks: { pattern: string; example: string; why: string }[];
  structures: { name: string; beats: string[]; length: string }[];
  editing: string[];
  on_screen_text: string[];
  audio: string[];
  scripting: string[];
  ideas: { title: string; hook: string; outline: string }[];
  avoid: string[];
};

export type ShootPlan = {
  concept: string;
  length_seconds: number;
  scenes: {
    name: string;
    location: string;
    setup: string;
    action: string;
    lines: string;
    on_screen_text: string;
    seconds: number;
    notes: string;
  }[];
  broll: string[];
  props_wardrobe: string[];
};

// A sound the top reels in the niche use (the researcher counts them; engine/src/research.ts).
export type TrendAudio = {
  title: string;
  artist: string;
  original: boolean;
  audioId: string | null;
  link: string | null;
  reels: number;
  creators: number;
  plays: number;
  example: string | null;
  bpm: number | null;
};

// What the sound designer chose for a version (engine/src/sound.ts).
export type SoundReport = {
  concept: string;
  notes: string;
  track: { id: string; title: string; artist: string; library: string; license: string; credit: string | null; page: string; bpm: number | null } | null;
  start: number;
  at: number;
  align: "start" | "hit" | "end";
  sfx: { id: string; title: string; library: string; at: number }[];
  trend: { title: string; artist: string; link: string | null; use: string } | null;
  credits: string[];
  limits: string[];
};

export const asCharte = (v: unknown) => (v && typeof v === "object" && "palette" in v ? (v as Charte) : null);
export const asPillars = (v: unknown) => (Array.isArray(v) ? (v as Pillar[]) : []);
export const asFindings = (v: unknown) => (v && typeof v === "object" && "hooks" in v ? (v as TrendFindings) : null);
export const asReels = (v: unknown) => (Array.isArray(v) ? (v as TrendReel[]) : []);
export const asTrendAudio = (v: unknown) => (Array.isArray(v) ? (v as TrendAudio[]) : []);
export const asSoundReport = (v: unknown) => (v && typeof v === "object" && "concept" in v ? (v as SoundReport) : null);
export const asShootPlan = (v: unknown) => (v && typeof v === "object" && "scenes" in v ? (v as ShootPlan) : null);
