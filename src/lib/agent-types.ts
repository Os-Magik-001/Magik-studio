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
  bars?: number[];
};

// The motion director's design for a video (src/lib/agents.ts, runMotionDirector).
export type DesignBrief = {
  concept: string;
  system: string;
  scenes: { moment: string; template: string; prompt: string; needs: string }[];
  captions: string;
  end_card: string;
  editor_notes: string;
  templates: string[];
  written_at: string;
};

// A reference video as the engine measured it (engine/src/references.ts).
export type ReferenceStats = {
  shots: number | null;
  cutsPerSecond: number | null;
  medianShot: number | null;
  wordsPerMinute: number | null;
  speechShare: number | null;
  bpm: number | null;
  plays: number | null;
  likes: number | null;
  music: string | null;
  // Long videos: only the first minutes are watched.
  watchedSeconds?: number | null;
};

// Claude's breakdown of a reference video, which every agent works from.
export type ReferenceBreakdown = {
  summary: string;
  hook: string;
  structure: { at: string; beat: string; what: string }[];
  pacing: string;
  camera: string;
  text: string;
  graphics: string;
  sound: string;
  script: string;
  borrow: string[];
  avoid: string[];
};

export const asCharte = (v: unknown) => (v && typeof v === "object" && "palette" in v ? (v as Charte) : null);
export const asPillars = (v: unknown) => (Array.isArray(v) ? (v as Pillar[]) : []);
export const asFindings = (v: unknown) => (v && typeof v === "object" && "hooks" in v ? (v as TrendFindings) : null);
export const asReels = (v: unknown) => (Array.isArray(v) ? (v as TrendReel[]) : []);
export const asTrendAudio = (v: unknown) => (Array.isArray(v) ? (v as TrendAudio[]) : []);
export const asSoundReport = (v: unknown) => (v && typeof v === "object" && "concept" in v ? (v as SoundReport) : null);
export const asDesignBrief = (v: unknown) => (v && typeof v === "object" && "scenes" in v && "concept" in v ? (v as DesignBrief) : null);
export const asShootPlan = (v: unknown) => (v && typeof v === "object" && "scenes" in v ? (v as ShootPlan) : null);
export const asReferenceBreakdown = (v: unknown) => (v && typeof v === "object" && "hook" in v && "borrow" in v ? (v as ReferenceBreakdown) : null);
export const asReferenceStats = (v: unknown) => (v && typeof v === "object" && "cutsPerSecond" in v ? (v as ReferenceStats) : null);
