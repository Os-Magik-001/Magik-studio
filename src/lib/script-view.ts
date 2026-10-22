import { asBeats, type ScriptBeat } from "@/lib/agent-types";

// A script as people read it, on screen and in its PDF: the scriptwriter's beats, or the beats
// read back from the text (a script written or pasted by hand). `beats` is empty when the text
// has no numbered beats: then it reads as it was written.

// "1. Hook (0:00–0:02)", "2) The oven", "Beat 3: The crack".
const HEADING = /^\s*(?:#+\s*)?(?:(?:beat|scene|scène)\s+)?\d{1,2}\s*[.)]\s+(.+?)\s*$|^\s*(?:#+\s*)?(?:beat|scene|scène)\s+\d{1,2}\s*[:–-]\s*(.+?)\s*$/i;
const TIME = /\(?\s*(\d{1,2}:\d{2}\s*[–—-]\s*\d{1,2}:\d{2})\s*\)?/;
const LABEL = /^\s*(we see|on voit|visual|visuel|what we see|on screen|à l'écran|a l'ecran|texte?|text on screen|caption|vo|voix off|voice[- ]over)\s*:\s*(.*)$/i;
// "Léa: Bonjour !" — a speaker's name, then their line.
const SPEAKER = /^\s*([\p{Lu}][\p{L}'’.\- ]{0,22}(?:\s*\((?:vo|off|voix off)\))?)\s*:\s*(.+)$/u;

export function readBeats(beats: unknown, body: string): ScriptBeat[] {
  const own = asBeats(beats);
  if (own.length) return own;
  const out: ScriptBeat[] = [];
  let cur: ScriptBeat | null = null;
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const h = line.match(HEADING);
    if (h && !LABEL.test(line)) {
      const heading = h[1] ?? h[2];
      const time = heading.match(TIME)?.[1] ?? "";
      cur = { time: time.replace(/\s*[—-]\s*/, "–"), title: heading.replace(TIME, "").replace(/[\s·:–-]+$/, "").trim(), visual: "", voice: "", on_screen: "" };
      out.push(cur);
      continue;
    }
    // Text before the first beat (a title, a note) isn't part of any beat.
    if (!cur) continue;
    const l = line.match(LABEL);
    if (l) {
      const kind = l[1].toLowerCase();
      const text = l[2].trim();
      if (/screen|écran|ecran|text|caption/.test(kind)) cur.on_screen = join(cur.on_screen, text);
      else if (/^vo|voix|voice/.test(kind)) cur.voice = join(cur.voice, `VO: ${text}`);
      else cur.visual = join(cur.visual, text);
      continue;
    }
    const s = line.match(SPEAKER);
    if (s) {
      cur.voice = join(cur.voice, `${s[1].trim()}: ${s[2].trim()}`);
      continue;
    }
    cur.visual = join(cur.visual, line);
  }
  // A list with one heading is not a script in beats.
  return out.length >= 2 ? out : [];
}

const join = (a: string, b: string) => (a ? `${a}\n${b}` : b);

// "Léa: Bonjour !" -> who speaks and what they say (lines without a name are the voice-over).
export function speakerLines(voice: string): { who: string; line: string }[] {
  return voice
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(SPEAKER);
      return m ? { who: m[1].trim(), line: m[2].trim() } : { who: "", line: l };
    });
}
