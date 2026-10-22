// The studio's agents as the app names them, everywhere: the Agents graph, the client's
// Production panel and the pipeline. `skills`: the key their skills use (engine/skills).

export type RosterKey = "strategist" | "researcher" | "planner" | "scriptwriter" | "motion" | "sound" | "engine";

export const ROSTER: Record<RosterKey, { name: string; does: string; skills: string }> = {
  strategist: { name: "Brand strategist", does: "Turns the client's answers into the niche, the charte graphique, the content pillars and the brand kit.", skills: "strategist" },
  researcher: { name: "Trend researcher", does: "Finds the top reels of the niche on Instagram, watches them and writes down what works.", skills: "researcher" },
  planner: { name: "Content planner", does: "Plans the month's videos from the strategy and the research: one brief per video.", skills: "planner" },
  scriptwriter: { name: "Scriptwriter", does: "Writes each script as numbered beats, the videographer's shoot plan and the edit prompt.", skills: "scriptwriter" },
  motion: { name: "Motion director", does: "Designs the graphics of every scene from the script and the brand.", skills: "motion" },
  sound: { name: "Sound designer", does: "Scores each cut: the music, the sound effects and the trending sound to post with.", skills: "sound" },
  engine: { name: "Edit engine", does: "Cuts the footage, adds the captions, the motion and the color, and renders the video.", skills: "editor" },
};
