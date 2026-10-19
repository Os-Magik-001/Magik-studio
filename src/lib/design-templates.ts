// The motion director's library: the studio's own design templates. Each is a direction the
// engine's motion designer builds as code (HTML, CSS and three.js rendered frame by frame over
// the cut), on top of its house rules (engine/design/brief.md). A video can follow one or more.

export type DesignTemplate = {
  id: string;
  title: string;
  category: string;
  summary: string;
  // What it needs from the studio, if anything.
  needs: string;
  direction: string;
};

export const DESIGN_TEMPLATES: DesignTemplate[] = [
  {
    id: "phone-reveal",
    title: "3D phone reveal",
    category: "Phone",
    summary: "A real 3D phone tumbles in with the profile or app on screen; posts lift off as cards.",
    needs: "A screen recording or screenshot of the profile, site or app (otherwise the profile is drawn).",
    direction: `A real-scale 3D phone built in three.js (rounded swept body, camera plateau, glass screen; studio lighting from a PMREM environment of soft panels, no point lights) tumbles up out of darkness and settles almost flat, 10-15 degrees off-axis, filling 65-75% of the frame height. The screen plays the profile, site or app. After a 1.5 s hold, 2 to 4 posts or cards lift off the screen towards the camera with parallax and settle around the phone, staggered by 120 ms. Background: a deep gradient in the brand's darkest colour with fine grain. Timing: tumble 0.9-1.2 s with expo-out, cards 0.5 s with a small spring. Out: the camera pushes into the screen until it fills the frame and becomes the next scene, or the phone glides out on a curve.`,
  },
  {
    id: "kinetic-fields",
    title: "Kinetic type on colour fields",
    category: "Kinetic type",
    summary: "One or two huge words per screen on flat brand colours, changing on the music's bars.",
    needs: "",
    direction: `Full-frame flat colour fields from the brand palette, one or two words per screen in a heavy condensed display face (Archivo Black, Bebas Neue or Unbounded) at 220-420 px, filling 80-90% of the width. A new field colour and word lands on every bar of the music (the bar times are in the brief); for the climax, on every beat. Words land with a three-frame scale from 112% to 100% and motion blur; one accent word per screen in an italic serif (Instrument Serif or Cormorant) in the accent colour. Variety without noise: alternate a straight cut, a field wiping across behind the word, and a word sliding in from the side. 4 to 8 screens. No captions over these screens, and nothing in the platform UI zones.`,
  },
  {
    id: "liquid-glass",
    title: "Liquid Glass cards",
    category: "Product UI",
    summary: "Apple-style frosted glass cards and capsules for stats, features, quotes and the call to action.",
    needs: "",
    direction: `Apple's Liquid Glass: frosted, refracting cards and capsules (three.js MeshPhysicalMaterial with transmission, about 0.03 roughness, a clear coat and a little dispersion; or CSS backdrop blur with an inner highlight, a thin bright rim and a soft shadow) floating over the picture or a dark brand gradient. Thick, fully rounded edges, and each card larger than what it covers. Labels, numbers and simple SVG icons sit on top of the glass, never inside it. Cards rise 60-90 px into place with a spring (4% overshoot), 70 ms apart; at most two on screen at once. Use them for a stat, a feature, a short quote, and a capsule button for the call to action at the end.`,
  },
  {
    id: "website-tour",
    title: "Website tour in a browser",
    category: "Product UI",
    summary: "A big 3D browser window scrolls the site, zooms into sections, with a cursor and callouts.",
    needs: "A screen recording or screenshots of the website.",
    direction: `A large browser window (90-96% of the width, rotated 6-10 degrees on Y, a soft 3D shadow) plays the website scrolling, with the domain in its address bar. On the words that name a feature, the view zooms into that section (scale 1.5-1.8 over 0.6 s, expo-out) while a cursor glides in and clicks with a ripple, and a short label slides in beside it. Two or three zooms at most, each held 1.2-2 s. Background: the brand's darkest colour with a faint grid. Out: the window flies back and shrinks into the logo or the call to action.`,
  },
  {
    id: "app-flow",
    title: "App flow on a phone",
    category: "Phone",
    summary: "App screens change with taps on a phone, with floating labels pointing at features.",
    needs: "Screenshots or a screen recording of the app.",
    direction: `A phone centred (flat, or turned 8-12 degrees in 3D) with the app's screens. Each step is a tap: a finger dot appears and ripples, and the next screen pushes in from the right in 0.35 s like iOS. A floating label (heavy sans, 36-44 px, on a small rounded plate) points at the feature being said and leaves before the next tap. At most three screens per 6 s. A second phone, blurred and smaller, can sit behind for depth. Background: a soft brand gradient.`,
  },
  {
    id: "data-story",
    title: "Data story",
    category: "Charts",
    summary: "A hero number counts up, then a clean chart draws itself to prove the point.",
    needs: "The numbers to show (from the script).",
    direction: `A hero number counts up over 1.2-1.8 s with expo-out, in a heavy face at 260-380 px with tabular figures, and a short label under it (40-48 px). Then a bar or line chart draws itself: bars grow 80 ms apart, a line draws with a dot leading it. Minimal axes, no gridlines or only faint ones, one bar or point in the accent colour and the rest neutral. A before/after can split the frame in two. A source or footnote stays small (32 px) at the bottom of the safe area. End on the hero number, held 1.5 s.`,
  },
  {
    id: "process-diagram",
    title: "Process diagram",
    category: "Diagrams",
    summary: "Steps as nodes joined by lines that draw themselves, following the narration.",
    needs: "",
    direction: `Three to five nodes (rounded rectangles or circles with a simple SVG icon and one or two words) on a hidden grid. Each connector draws itself in 0.5 s as its step is named, and a small pulse travels along it; the node it reaches pops in with a spring. When the diagram is wider than the frame, the camera pans to follow the narration, then pulls back for the full view with the final result node in the accent colour. Thin lines (3-4 px), generous spacing, one typeface.`,
  },
  {
    id: "shape-logo",
    title: "Shapes into the logo",
    category: "Shapes",
    summary: "Simple shapes move in rhythm on a grid and assemble into the logo or wordmark.",
    needs: "The logo (from the brand kit).",
    direction: `Circles, squares, bars and arcs in the brand colours move on a hidden grid in time with the music, pass and orbit each other, then snap together into the logo or the wordmark. Flat colours, no gradients or glows. Moves use a cubic in-out curve; the snaps use a short spring. The name then appears beside or under the mark in the display face, letter by letter 30 ms apart. 3-5 s, ideal for an opener or the ending.`,
  },
  {
    id: "dot-matrix",
    title: "Dot-matrix type",
    category: "Particles",
    summary: "A grid of small dots lights up to form words, numbers or the logo, like an LED board.",
    needs: "",
    direction: `A grid of small dots (6-8 px, 14-18 px apart) covers the frame, dimmed. Dots light up to form a word, a number or the logo, sweeping across in 0.4 s, hold, then ripple out from the centre into the next word. White and one accent colour only; no glow, no burst, no flying particles. 2-4 s per word, 2 to 4 words. It suits tech, events and launches.`,
  },
  {
    id: "name-cards",
    title: "Name cards",
    category: "Characters",
    summary: "3D name cards with role and stats for the people on screen; a grid of faces for a team.",
    needs: "",
    direction: `For a person speaking: a 3D card swings in beside them (never over the face), with the name in a heavy sans (90-130 px), the role in wide-spaced small capitals and up to three short stat bars that fill as it lands; it leaves before they finish. For a team: a grid or fan of freeze-frame tiles taken from the cut (the frame when each person is on screen), each with a name plate, building one tile at a time 100 ms apart. The background behind cards takes a tint of the brand colour. The engine's own cut-out character intros stay as they are where the editor placed them: design around them.`,
  },
  {
    id: "photo-stack",
    title: "Photo stack",
    category: "Photos",
    summary: "Photos fly in as bordered prints and pile up, or turn in a 3D carousel, with captions.",
    needs: "Photos (assets) or frames from the cut.",
    direction: `Photos as prints with a thin white border, flying in one by one with a slight rotation (-8 to 8 degrees) and landing on a loose pile with a soft shadow, then drifting slowly for parallax. Alternative: a 3D carousel turning around the vertical axis with depth of field on the cards at the back. Each photo can carry a short caption in an italic serif. 0.6-0.9 s per photo; the last one is held 1.5 s.`,
  },
  {
    id: "beat-pulse",
    title: "Beat-locked graphics",
    category: "Music",
    summary: "Titles, meters and colour changes locked to the music's beats and bars.",
    needs: "",
    direction: `Everything moves with the music, using the beat and bar times in the brief. The title breathes from 102% to 100% on every downbeat; a thin meter of 5 to 9 vertical bars beside it pulses on the beats; the background colour flips every fourth bar; at the drop, words cut on every beat for one bar. Never more than one pulsing element besides the title. Keep the motion small: this is rhythm, not shaking.`,
  },
  {
    id: "code-terminal",
    title: "Code and terminal",
    category: "Code",
    summary: "A dark editor types a few lines with syntax colours, the result appears, then it zooms out.",
    needs: "",
    direction: `A dark editor or terminal window (rounded corners, three window dots, Space Mono at 34-40 px) types three to six lines at a human pace, with syntax colours (keywords in the accent, strings in a soft neutral) and a blinking cursor. The output or the product appears below or beside it. Then the camera pulls out to show the window on a laptop or inside the product UI. For tech, developer and AI products.`,
  },
  {
    id: "editorial",
    title: "Editorial magazine",
    category: "Brand",
    summary: "Serif headlines with an italic accent word, thin rules and numbered sections, calm and premium.",
    needs: "",
    direction: `A magazine page in motion: a serif headline (Playfair Display, Instrument Serif or Cormorant, 120-180 px) with one italic accent word in the accent colour, thin 2 px rules drawing across the frame, small capital labels with wide tracking, and section numbers like 01 / 03. Generous margins and plenty of space. Calm motion: 0.6-0.8 s slides and fades with expo-out, nothing bouncy. For premium, luxury, real estate, fashion and personal brands.`,
  },
  {
    id: "brand-end-card",
    title: "Brand end card",
    category: "Brand",
    summary: "The video's last element turns into the logo, with the handle and the call to action.",
    needs: "The logo (from the brand kit).",
    direction: `The end card grows out of the video's own motif: the last word, card or shape turns into the logo. The handle and the call to action follow in the text face; a small pill says follow or the call to action. The background is the brand's primary colour or its darkest. Everything settles and is held still for 1.5-2 s at the end. No glow and no shine sweep.`,
  },
  {
    id: "series-opener",
    title: "Series opener",
    category: "Characters",
    summary: "A cold open freeze, the series title card with the episode number, then name plates.",
    needs: "The series logo, if it has one.",
    direction: `For an episode of a series: the cold open freezes on its last frame and cuts hard to the series title card (the title in the series face, EP 05 in small capitals, the episode title under it), then a quick montage of three or four shots with each character's name plate. 4-6 s in all. It must look the same in every episode, so follow the earlier episodes' design when the brief describes it.`,
  },
];

export const templateById = (id: string) => DESIGN_TEMPLATES.find((t) => t.id === id);
