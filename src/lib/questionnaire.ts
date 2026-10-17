// The brand questionnaire a client fills in (or the studio fills in for them).
// Agent 1 turns the answers into the niche, the charte graphique and the brief.

export const QUESTIONS = [
  { key: "business", label: "Your business", hint: "What you do, where, and since when.", rows: 3 },
  { key: "offer", label: "Products or services", hint: "What you sell, your best sellers, rough prices.", rows: 3 },
  { key: "audience", label: "Your customers", hint: "Who buys from you: age, place, interests, why they choose you.", rows: 3 },
  { key: "goals", label: "What the videos should do", hint: "More followers, bookings, sales, launches, recruiting…", rows: 2 },
  { key: "concept", label: "Your concept and ideas", hint: "The story you want to tell, series or formats you have in mind.", rows: 3 },
  { key: "tone", label: "Personality", hint: "3 to 5 words for how your brand should feel (bold, funny, premium…).", rows: 1 },
  { key: "colors", label: "Brand colors", hint: "Hex codes if you have them (#E0222B), or describe them.", rows: 1 },
  { key: "fonts", label: "Fonts and logo", hint: "Font names, logo notes, anything that must look a certain way.", rows: 2 },
  { key: "references", label: "Accounts you admire", hint: "Instagram handles of competitors or creators whose videos you like.", rows: 2 },
  { key: "handle", label: "Your Instagram", hint: "@handle", rows: 1 },
  { key: "languages", label: "Language of the videos", hint: "French, English, both, subtitles…", rows: 1 },
  { key: "music", label: "Music you like", hint: "Genres or artists that fit the brand.", rows: 1 },
  { key: "avoid", label: "What to avoid", hint: "Topics, styles, words or looks you never want.", rows: 2 },
  { key: "platforms", label: "Where and how often you post", hint: "Instagram, TikTok, YouTube Shorts; videos per week.", rows: 1 },
] as const;

export type QuestionKey = (typeof QUESTIONS)[number]["key"];
export type Answers = Partial<Record<QuestionKey, string>>;

export function readAnswers(raw: unknown): Answers {
  if (!raw || typeof raw !== "object") return {};
  const out: Answers = {};
  for (const q of QUESTIONS) {
    const v = (raw as Record<string, unknown>)[q.key];
    if (typeof v === "string" && v.trim()) out[q.key] = v.trim();
  }
  return out;
}

export const answeredCount = (a: Answers) => QUESTIONS.filter((q) => a[q.key]).length;
