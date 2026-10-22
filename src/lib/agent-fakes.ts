import "server-only";

// Stand-in answers for the agents, for testing the studio's flow on a local copy without calling
// Claude. Only with MAGIK_FAKE_AGENTS=1, and never in production.

export type FakeKind = "strategy" | "plan" | "script" | "adapt" | "revise" | "design" | "invoice" | "logos";

export const fakeAgents = () => process.env.MAGIK_FAKE_AGENTS === "1" && process.env.NODE_ENV !== "production";

const pick = (prompt: string, re: RegExp, fallback: string) => prompt.match(re)?.[1]?.trim() || fallback;

const IDEAS = [
  ["Why our croissant has 27 layers", "Butter science", "Trust: show the craft", "Extreme close-up: a croissant cracks in two. VO: “27 couches. Une seule règle.”"],
  ["4 a.m. on rue Saint-Denis", "Before you wake up", "Awareness: the ritual", "Black screen, an alarm flips to 3:58. On screen: 4 h du matin."],
  ["Meet the regulars", "The regulars", "Fill weekend mornings", "A regular orders without speaking; the team already knows."],
  ["Galette des rois: the countdown", "Seasonal launches", "Pre-orders by the date", "The crown lands on a golden galette. On screen: J-10."],
  ["Levain in 20 seconds", "Butter science", "Trust: show the craft", "A jar of levain doubles in a timelapse."],
  ["The first customer of the day", "Before you wake up", "Awareness: the ritual", "The door opens at 7:00 sharp; the first bag of the day."],
  ["Holiday pre-orders are open", "Seasonal launches", "300 pre-orders by Dec 20", "A wall of bûches; one slides toward the camera."],
  ["What 'fait maison' really means", "Butter science", "Trust: show the craft", "Flour hits the counter in slow motion."],
] as const;

function strategy(name: string) {
  return {
    niche: `Artisan bakery-café in Montréal (${name})`,
    keywords: ["boulangerie", "montrealfood", "croissant", "plateaumontroyal", "viennoiserie"],
    reference_accounts: ["fournilrosemont", "painvivant.mtl"],
    business: `${name} bakes everything on site from 4 a.m.: croissants, sourdough and viennoiseries, with coffee at the counter. The butter croissant is the bestseller. What sets it apart is the early-morning ritual and the people who run it.`,
    audience: "Neighbours, students and young families who walk by every morning, plus Montréal foodies who cross town for a great croissant.",
    needs: ["Fill the counter on weekend mornings", "Sell 300 holiday pre-orders by December 20", "Grow Instagram from 2.1K to 8K followers by March", "Make the 4 a.m. ritual the brand's signature"],
    pillars: [
      { name: "Before you wake up", description: "The 4 a.m. ritual, as a series.", ideas: ["The 4 a.m. croissant", "27 layers, explained", "The oven's first batch"] },
      { name: "Butter science", description: "Short, satisfying explanations of the craft.", ideas: ["Why the crackle matters", "Levain in 20 seconds", "What 'fait maison' really means"] },
      { name: "The regulars", description: "The people who come every morning.", ideas: ["Mme Gagnon's 2 croissants", "The student who studies at the counter", "Dog of the week"] },
      { name: "Seasonal launches", description: "Holiday and seasonal products, with pre-orders.", ideas: ["Bûche reveal", "Galette des rois countdown", "Pumpkin brioche test"] },
    ],
    charte: {
      palette: [
        { name: "Cream", hex: "#F6EBD9", role: "background" },
        { name: "Crust", hex: "#8B5A2B", role: "primary" },
        { name: "Butter", hex: "#F2C14E", role: "accent" },
        { name: "Espresso", hex: "#2B1D14", role: "text" },
      ],
      fonts: { headline: "DM Serif Display", body: "Inter", notes: "The serif carries the craft; Inter keeps captions easy to read on a phone." },
      typography: ["Sentence case, never all caps", "One idea per screen, 3 to 6 words", "Key word in butter gold"],
      captions: { preset: "editorial", highlight: "#F2C14E", notes: "French on screen, English subtitles. Never cover the dough or the hands." },
      motion: "Slow and warm: push-ins on the dough, match cuts on the fold, steam and flour as transitions. kinetic_type for the hook, stat_card for 27 layers, logo_reveal on cream for the end.",
      music_mood: "Warm acoustic, brushed drums, morning jazz; the croissant's crackle is the hero sound.",
      tone_of_voice: "Warm, crafty, honest, a little funny. « Ici, on se lève avant le soleil. » « Le beurre, c'est sérieux. »",
      logo_usage: "On the end card on cream; never over the product.",
      dos: ["Show hands and textures", "Real sounds of the kitchen", "Léa and the regulars, never models"],
      donts: ["Fast zooms and glitch effects", "Neon or cold colours", "Prices on screen (they change)"],
    },
    style_rules: "Cream, crust and butter gold; DM Serif Display titles, Inter captions in French with English subtitles; slow warm push-ins; the kitchen's real sounds up front; music low; end on the logo on cream.",
  };
}

function plan(prompt: string) {
  const count = Math.max(1, Math.min(12, Number(pick(prompt, /Plan (\d+) video/, "4"))));
  const month = pick(prompt, /video[s]? for ([^.]+)\./, "this month");
  return {
    summary: `A month built on the 4 a.m. ritual: two craft videos to earn trust, one people story to bring the regulars in, and the seasonal launch with a clear pre-order call to action.`,
    month,
    ideas: Array.from({ length: count }, (_, i) => {
      const [title, pillar, goal, hook] = IDEAS[i % IDEAS.length];
      return {
        title: i < IDEAS.length ? title : `${title} (${Math.floor(i / IDEAS.length) + 1})`,
        pillar,
        goal,
        hook,
        brief: `${title}. Filmed at the bakery with Léa and the team, early morning. We must see the hands, the dough and the finished product up close. End with one clear call to action. About 25 seconds, French with English subtitles.`,
        format: "social_short",
        length_seconds: 25,
        shoot_group: i % 2 === 0 ? "Morning at the bakery" : "",
        why: "Process reels with a visual payoff are the top performers in the niche (6 of 10).",
      };
    }),
  };
}

function script(prompt: string) {
  const title = pick(prompt, /Video: (.+)/, "The 4 a.m. croissant");
  return {
    concept: `${title}: the ritual nobody sees, told in 25 seconds from the alarm to the first customer.`,
    length_seconds: 25,
    beats: [
      { time: "0:00–0:02", title: "Hook", visual: "Black screen. An alarm clock flips from 3:58 to 3:59.", voice: "", on_screen: "4 h du matin." },
      { time: "0:02–0:06", title: "Montréal sleeps", visual: "The empty street outside; the bakery's window is the only light on.", voice: "Léa: Montréal dort. Pas nous.", on_screen: "Montréal dort." },
      { time: "0:06–0:12", title: "The butter", visual: "Hands fold the dough over a slab of cold butter; close-up on the layers.", voice: "Léa: Le secret, c'est le beurre. Et la patience.", on_screen: "27 couches" },
      { time: "0:12–0:18", title: "The oven", visual: "The oven door opens; steam rises over a tray of golden croissants.", voice: "", on_screen: "" },
      { time: "0:18–0:22", title: "The crack", visual: "Extreme close-up: a croissant breaks in two; the crackle is loud.", voice: "", on_screen: "Craque." },
      { time: "0:22–0:25", title: "First customer", visual: "7:00, the door opens, the first bag of the day crosses the counter.", voice: "Léa: Bon matin !", on_screen: "Ouvert dès 7 h · Rue Saint-Denis" },
    ],
    scenes: [
      { name: "The alarm", location: "Léa's kitchen table (or the bakery's back room)", setup: "Close-up, tripod, 9:16, low light", action: "The alarm flips to 3:59.", lines: "", on_screen_text: "4 h du matin.", seconds: 2, notes: "3 takes; record 2 s before and after." },
      { name: "The street", location: "Outside the bakery, 5:30", setup: "Wide, tripod, from across the street", action: "The empty street; the window lit.", lines: "Léa (VO): Montréal dort. Pas nous.", on_screen_text: "Montréal dort.", seconds: 4, notes: "Blue hour if possible." },
      { name: "The fold", location: "The bakery's counter", setup: "Overhead and side close-ups, gimbal", action: "Léa folds the dough over the butter.", lines: "Léa: Le secret, c'est le beurre. Et la patience.", on_screen_text: "27 couches", seconds: 6, notes: "Lav mic on Léa. Get the layers in macro." },
      { name: "The oven", location: "The oven", setup: "Medium, handheld, steam backlit", action: "The door opens; the tray comes out.", lines: "", on_screen_text: "", seconds: 6, notes: "Backlight the steam." },
      { name: "The crack", location: "The counter", setup: "Macro, tripod", action: "Hands break a croissant in two.", lines: "", on_screen_text: "Craque.", seconds: 4, notes: "Record the sound close: it's the hero sound." },
      { name: "First customer", location: "The front door and counter, 7:00", setup: "Medium, handheld", action: "The first customer comes in; Léa hands the bag over.", lines: "Léa: Bon matin !", on_screen_text: "Ouvert dès 7 h", seconds: 3, notes: "Ask a regular in advance." },
    ],
    broll: ["Flour falling in slow motion", "The sign switching on", "Steam over the trays", "Coffee pouring", "Hands dusting a counter", "The street at blue hour"],
    props_wardrobe: ["Léa's apron with the logo", "The vintage alarm clock", "Kraft paper bags"],
    shots: ["Alarm clock flips to 3:59 (close-up)", "Street at 5:30, window lit (wide)", "The fold, overhead", "The layers in macro", "Oven door opens, steam", "Croissant breaks in two (macro, with sound)", "First customer at 7:00"],
    edit_prompt: `Structure: hook 0–2 s on the alarm, the street 2–6 s, the fold 6–12 s, the oven 12–18 s, the crack 18–22 s, first customer 22–25 s. A change every 2–3 s. Captions: editorial preset, French, key words in #F2C14E. Motion: kinetic_type for "4 h du matin." at 0.0 s; stat_card "27 couches" at 0:07. Cuts only, a steam wipe into the oven. Music: warm acoustic, low under Léa, up at the crack. End on the logo on cream.`,
  };
}

const FAKES: Record<FakeKind, (prompt: string, name: string) => unknown> = {
  strategy: (_, name) => strategy(name),
  plan: (prompt) => plan(prompt),
  script: (prompt) => script(prompt),
  revise: (prompt) => ({ ...script(prompt), reply: "Done: I tightened the hook and moved the crack earlier." }),
  adapt: (prompt) => {
    const s = script(prompt);
    return { concept: s.concept, length_seconds: s.length_seconds, shots: s.shots, edit_prompt: s.edit_prompt };
  },
  design: () => ({
    concept: "A warm notebook: hand-set serif titles with butter-gold underlines.",
    system: "DM Serif Display and Inter; accent #F2C14E; titles 110 px; ease-out 0.3 s in, 0.2 s out.",
    scenes: [{ moment: "0:00 hook", template: "kinetic_type", prompt: "“4 h du matin.” types on in DM Serif Display, centered, cream on black.", needs: "" }],
    captions: "Editorial preset, bottom third, French with English subtitles.",
    end_card: "The logo on cream with « Ouvert dès 7 h ».",
    editor_notes: "Hold the crack shot clean for 1.5 s.",
  }),
  invoice: () => ({ detail: "Production de vidéos courtes pour Instagram, selon le forfait choisi.", note: "Merci de votre confiance ! Paiement dû dans les délais indiqués." }),
  logos: () => ({ ideas: [] }),
};

export function fakeAnswer(kind: FakeKind, prompt: string) {
  const name = pick(prompt, /Client: (.+)/, "the client");
  return FAKES[kind](prompt, name);
}
