import { APPS } from "@/lib/apps";
import type { Role } from "@/lib/auth";

// What Magik OS says about itself to the people using it: the questions people ask most (the Help
// window) and the guide Motchi answers from. Only what a user needs to know: nothing about how the
// app is built or run. Clients' answers never mention how the studio works inside.

export type QA = [string, string];

export const FAQ: Record<Role, QA[]> = {
  client: [
    ["Where do I see my videos?", "Open Your videos in the Dock. Each video shows its latest cut; click it to watch, comment on the exact moment you'd like changed, then approve it or ask for changes."],
    ["How do I follow where each video is?", "Open Pipeline: every video is in a column, from the script to the shoot, the edit, your review and posting. Anything waiting for you is marked."],
    ["How do I approve a script?", "In Pipeline or Your videos, open the video: its script is at the top. Read it, then approve it or ask for changes in a few words."],
    ["When will my videos be posted?", "Open Calendar: posting dates are in gold, shoots in orange. You can also add your own events and share them with the studio."],
    ["Where are my invoices and my contract?", "In Settings, under Documents."],
    ["How do referrals work?", "Open Referrals: share your link with a business that needs videos. When they sign with Magik, you earn credits."],
  ],
  admin: [
    ["How do I start a new client?", "Onboarding, then New client: their details, the pack, the invoice, the contract, then send them their link. They finish their setup on their own."],
    ["A client can't get in. Why?", "Clients use Magik OS once their onboarding is finished. In their client folder you can open their setup, or mark them onboarded if they started before onboarding existed."],
    ["How do I pause or remove someone?", "Team, then Manage on their row: pause stops them signing in until you resume them; delete removes their account for good (their work stays)."],
    ["How do posting dates reach clients?", "Set the posting date on a video's page, or drag it in Calendar. The client sees it in their calendar."],
    ["Where do referral credits come from?", "Referrals: when you mark a referral signed, its referrer gets the credits set in Settings, Studio."],
  ],
  editor: [
    ["Where do I start my day?", "Pipeline shows every video by phase and what it's waiting on; your videos have your initials."],
    ["How do posting dates reach clients?", "Set the posting date on a video's page, or drag it in Calendar. The client sees it in their calendar."],
    ["How do I invite someone to a meeting?", "Calendar, Create: add a title and a time, then Invite the team."],
  ],
  videographer: [
    ["Where are my shoots?", "Shoots lists them with their shot lists; Calendar shows them in orange."],
    ["How do I send the footage?", "Open the shoot, then upload the files or link the Drive folder, and mark the footage complete."],
  ],
  seller: [
    ["How do I start a new client?", "Onboarding, then New client: details, pack, invoice, contract, then send the link."],
    ["Where do referrals come in?", "Referrals: every business referred to Magik, with who referred it. Follow them up and mark them signed."],
  ],
};

export const TIPS = {
  windows: "Every app opens in its own window. Drag a window by its top bar, resize it from any edge, double-click the bar to fill the screen. Drag it to the left or right edge to fill half.",
  mission: "The grid button in the menu bar (or F3) shows every open window side by side; click one to bring it forward. Yellow puts a window in the Dock, red closes it.",
  search: "⌘K finds an app, a client, a video or an event. ⌘-click a link to open it in a new window.",
};

// More about each app than its one-line hint, for Motchi.
const DETAILS: Record<string, string> = {
  pipeline: "The board groups every video by phase and shows its next step and who it's waiting on. Open a video for its page: the script, the shoot, the footage, every version and its comments, the review and the posting date.",
  "client-pipeline": "Each of your videos sits in a column, from the script to the shoot, the edit, your review and posting; anything waiting for you is marked. Open one to read its script, watch its cuts, approve or ask for changes.",
  videos: "Watch each cut, comment right on the moment you want changed, approve it, or download it.",
  clients: "One folder per client: their videos, scripts, footage, every version and their brand kit. A client's folder also holds their access, their website and the production panel: plan the month, create the videos and their scripts, send the scripts to the client, make the client's changes, plan a shoot day.",
  onboarding: "New client: their details, the pack, the invoice and the contract, then send them their link; they finish their setup on their own. The packs the studio sells are listed here; a pack sets the price on the invoice and the client's revision rounds.",
  sales: "The sales workspace. Its tools are coming soon.",
  calendar: "Month, week and day views. Create an event with a title and a time, choose its colour or make it all-day, invite people, drag it to move it. Posting dates are gold and shoots orange. Settings, Calendar gives you a private link to see it in Google Calendar or on your iPhone.",
  agents: "What each of the studio's agents is working on and what it produced.",
  library: "The reference videos clients can pick from.",
  sounds: "The studio's music and sound-effect libraries.",
  prompts: "The team's library of motion prompts.",
  shoots: "Every shoot with its date, place and shot list. Open a shoot to upload the footage or link its Drive folder, then mark the footage complete.",
  brand: "Your logo, your colours and fonts, and your answers to the brand questions.",
  website: "Your website made with Magik opens right here when it's live. While it's being built you'll see that; if you don't have one with Magik yet, ask the studio from Help.",
  team: "Everyone who uses Magik OS, with their role. Manage on a row lets you set a new password, pause the account (they can't sign in until you resume it) or delete it for good (their work stays).",
  referrals: "Your referral link and your credits: share the link with a business that needs videos; when they sign with Magik, you earn credits.",
  notifications: "The bell in the menu bar: new versions, comments, approvals and answers from the studio. Click one to open it, or mark everything as read.",
  help: "The question mark in the menu bar: how Magik OS works, the questions people ask most, and a message to the studio (they answer in your notifications, usually the same day).",
};

const DESKTOP = `- Every app opens in its own window, and several can be open at once. Drag a window by its top bar, resize it from any edge or corner, double-click the top bar to fill the screen, or drag it to the left or right edge of the screen to fill half (two windows side by side).
- The three buttons at the top left of a window: red closes it, yellow puts it in the Dock (click it there to bring it back), green fills the screen. The arrows next to them go back and forward inside the window.
- Mission Control (the grid button in the menu bar, F3, or Control and the up arrow) shows every open window side by side; click one to bring it forward.
- Search (⌘K, or the search field at the top right of the menu bar) finds an app, a client, a video or an event.
- ⌘-click a link to open it in a new window. Option-W closes the window in front, Option-M puts it in the Dock.
- Right-click an app in the Dock to see its windows, open a new one, or close them all.
- Home (the first icon in the Dock, or the Magik OS name at the top left) shows the desktop: your day, your numbers and what needs you.
- Open windows come back where you left them the next time you sign in.`;

const SETTINGS: { label: string; text: string; roles?: Role[] }[] = [
  { label: "General", text: "your name (how you appear on comments, assignments and the calendar), your account, and what you can do in Magik OS" },
  { label: "Appearance", text: "your wallpaper (including Dynamic, which follows the time of day, and a live Matrix), the Dock's size, the app names under the icons, and solid windows; saved to your account, so they follow you to any computer" },
  { label: "Notifications", text: "choose what Magik OS tells you about, and mark everything as read" },
  { label: "Calendar", text: "how your calendar looks, and a private link to see it in Google Calendar or on your iPhone" },
  { label: "Password & security", text: "change your password (at least 8 characters), or sign out everywhere if you used a computer that isn't yours" },
  { label: "Documents", text: "your invoices and your contract", roles: ["client"] },
  { label: "Referrals & credits", text: "your referral link and your credits" },
  { label: "Studio", text: "the studio's invoice details, its packs and the credits a signed referral gives", roles: ["admin"] },
  { label: "About Magik OS", text: "what Magik OS is, Motchi, and every keyboard shortcut" },
];

const ROLE_NAMES: Record<Role, string> = {
  admin: "a studio manager (admin)",
  editor: "an editor at the studio",
  videographer: "a videographer at the studio",
  seller: "a seller for the studio",
  client: "a client of the studio",
};

export const roleName = (role: Role) => ROLE_NAMES[role];

// Everything Motchi knows, for one role: only that role's apps and answers.
export function guideFor(role: Role): string {
  const apps = APPS.filter((a) => a.id !== "home" && a.roles.includes(role));
  return [
    "# Magik OS",
    "Magik OS is the workspace of Magik Studio, the content studio of Magik Management. Clients follow their videos from the script to the day they're posted, review and approve them; the studio team plans, shoots, edits and delivers them. It looks and works like a Mac desktop: a menu bar at the top, a Dock at the bottom, and every app in its own window.",
    `## The apps this person has (as ${ROLE_NAMES[role]})`,
    apps.map((a) => `- ${a.name}: ${a.hint}.${DETAILS[a.id] ? ` ${DETAILS[a.id]}` : ""}`).join("\n"),
    "## Using the desktop",
    DESKTOP,
    "## Settings (the last icon in the Dock, or the person menu at the top right)",
    SETTINGS.filter((s) => !s.roles || s.roles.includes(role))
      .map((s) => `- ${s.label}: ${s.text}.`)
      .join("\n"),
    "## Questions people ask",
    FAQ[role].map(([q, a]) => `Q: ${q}\nA: ${a}`).join("\n\n"),
  ].join("\n\n");
}

// When Motchi's model can't answer (no key, no credits, an outage), he still answers from this
// guide: the passages that share the most words with the question, in English or French.
const SAME: Record<string, string> = {
  fenetre: "window", ecran: "screen", fond: "wallpaper", wallpapers: "wallpaper", video: "video", calendrier: "calendar", agenda: "calendar",
  publication: "posting", publier: "posting", publiee: "posting", publie: "posting", poste: "posting", post: "posting", posted: "posting", quand: "when", passe: "password", facture: "invoice",
  contrat: "contract", parrainage: "referral", parrain: "referral", referrals: "referral", credits: "credit", equipe: "team", supprimer: "delete",
  effacer: "delete", approuver: "approve", valider: "approve", modification: "change", changement: "change", changer: "change", modifier: "change",
  tournage: "shoot", tournages: "shoot", rechercher: "search", recherche: "search", chercher: "search", aide: "help", reglage: "settings",
  reglages: "settings", parametre: "settings", parametres: "settings", apparence: "appearance", notification: "notification", mettre: "",
  pause: "pause", suspendre: "pause", nouveau: "new", nouvelle: "new", demarrer: "start", commencer: "start", lien: "link", logo: "logo",
  couleur: "color", couleurs: "color", colours: "color", colour: "color", marque: "brand", site: "website", web: "website", telecharger: "download",
  commentaire: "comment", commenter: "comment", fermer: "close", ouvrir: "open", reduire: "minimize", raccourci: "shortcut", clavier: "shortcut",
};
const STOP = new Set(
  "the and are can does how what when where which who why with you your for from into have has this that there their them then than about over just like want need get make use using please also some any all one two".split(" ").concat(
    "les des une est pour que qui quoi comment mon mes mes ton tes votre vos nos dans sur avec sans par pas plus moins tout tous faire peux peut veux voudrais svp merci bonjour salut ".split(" "),
  ),
);
const terms = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .map((w) => SAME[w] ?? SAME[w.replace(/s$/, "")] ?? w.replace(/(ies)$/, "y").replace(/(?<=[a-z]{3})s$/, ""))
    .filter((w) => w.length > 2 && !STOP.has(w));

// What Motchi never talks about, whatever the guide says.
const PRIVATE = /\b(api|secrets?|tokens?|database|bases? de donn\w*|env|environment|environnement|supabase|vercel|anthropic|claude|apify|servers?|serveurs?|source code|code source|cl[eé]s?)\b/i;

export function answerFromGuide(role: Role, question: string): string {
  if (PRIVATE.test(question)) return "That's private to the studio, so I can't share it. I'm here to help with how Magik OS works: ask me about your apps, your windows or your settings.";
  const asked = new Set(terms(question));
  const passages = [
    ...FAQ[role].map(([q, a]) => ({ text: a, words: new Set(terms(`${q} ${a}`)), boost: new Set(terms(q)) })),
    ...APPS.filter((a) => a.id !== "home" && a.roles.includes(role)).map((a) => {
      const text = `**${a.name}**: ${a.hint}.${DETAILS[a.id] ? ` ${DETAILS[a.id]}` : ""}`;
      return { text, words: new Set(terms(`${a.name} ${text}`)), boost: new Set(terms(a.name)) };
    }),
    ...DESKTOP.split("\n").map((line) => ({ text: line.replace(/^- /, ""), words: new Set(terms(line)), boost: new Set<string>() })),
    ...SETTINGS.filter((s) => !s.roles || s.roles.includes(role)).map((s) => ({ text: `**Settings, ${s.label}**: ${s.text}.`, words: new Set(terms(`settings ${s.label} ${s.text}`)), boost: new Set(terms(s.label)) })),
  ];
  const scored = passages
    .map((p) => ({ text: p.text, score: [...asked].reduce((n, w) => n + (p.words.has(w) ? 1 + (p.boost.has(w) ? 0.6 : 0) + (w.length > 6 ? 0.3 : 0) : 0), 0) }))
    .filter((p) => p.score >= 1)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return "I'm not sure about that one. Help (the question mark in the menu bar) has the questions people ask most, and you can write to the studio from there.";
  const best = scored.slice(0, scored[1] && scored[1].score >= scored[0].score * 0.8 ? 2 : 1).map((p) => p.text);
  return `${best.join("\n\n")}\n\nFor anything else, Help (the question mark in the menu bar) reaches the studio.`;
}
