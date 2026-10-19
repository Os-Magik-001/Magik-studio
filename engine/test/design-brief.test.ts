import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDesignBrief, type DirectorBrief } from "../src/design.ts";
import { bareOf } from "../src/job.ts";
import type { EditPlan } from "../src/plan.ts";
import { CUT, EXTRAS, shot } from "./fixtures.ts";

const direction: DirectorBrief = {
  concept: "A gold thread draws through every scene",
  system: "Unbounded 800 and Inter; accent #D4AF37; expo-out 0.5 s",
  scenes: [
    { moment: "Hook: 'In twelve months'", template: "kinetic-fields", prompt: "Two words per screen on black, landing on the bars", needs: "" },
    { moment: "The website", template: "website-tour", prompt: "A browser window scrolls the site and zooms on the services", needs: "the website screen recording" },
  ],
  captions: "Bold white phrases in the lower third",
  end_card: "The thread closes into the logo",
  editor_notes: "Hold 3 s on the laptop shot",
  directions: [{ id: "kinetic-fields", title: "Kinetic type on colour fields", direction: "Full-frame flat colour fields..." }],
};

test("the motion designer's brief carries the motion director's design, the music bars and what the engine kept", () => {
  const text = buildDesignBrief({
    clientName: "Magik Management", title: "Launch", format: "social short", aspect: "9:16", brief: "Launch reel", script: "1. Hook...", instructions: null,
    direction, templates: [], summary: "A 30 s launch reel", suggestions: { captions: { mode: "auto" } },
    kept: [{ template: "character_intro", start: 3.2, end: 6, title: "CINEN" }],
    music: { title: "Night Drive", bpm: 120, bars: [0.4, 2.4, 4.4] },
    brand: { colors: ["#000000", "#D4AF37"], fonts: ["Unbounded"], styleRules: "Gold accent only" },
    assets: [{ name: "logo", kind: "image", description: "The brand's logo" }],
  });
  assert.match(text, /The motion director's design for this video \(build it\):\nConcept: A gold thread/);
  assert.match(text, /2\. The website \(template: website-tour\): A browser window scrolls the site and zooms on the services \[needs: the website screen recording\]/);
  assert.match(text, /<template id="kinetic-fields" title="Kinetic type on colour fields">/);
  assert.match(text, /character_intro "CINEN" 3\.2s–6\.0s\. Leave those moments clear\./);
  assert.match(text, /Bars \(downbeats\) on the timeline: 0\.40, 2\.40, 4\.40\./);
  assert.match(text, /Style rules: Gold accent only/);
  assert.match(text, /Assets: logo \(image\): The brand's logo/);
});

test("without a brief, the designer works from the script and the editor's ideas", () => {
  const text = buildDesignBrief({
    clientName: "C", title: "T", format: "ad", aspect: "9:16", brief: null, script: "The script", instructions: "Faster",
    direction: null, templates: [], summary: "S", suggestions: {}, kept: [], music: null, brand: { colors: [], fonts: [], styleRules: null }, assets: [],
  });
  assert.doesNotMatch(text, /motion director/);
  assert.match(text, /Script:\nThe script/);
  assert.match(text, /Notes for this edit:\nFaster/);
});

test("a bare cut keeps only the engine's cut-out intros", () => {
  const motion = (template: EditPlan["motion"][number]["template"]) => ({ template, start: 1, end: 3, title: "X", subtitle: "", lines: [], people: [], screen: null, accent: null, position: "center" as const });
  const plan: EditPlan = {
    ...EXTRAS, summary: "", look: "natural", segments: [shot("C1", 0, 4, "hook")], on_screen_text: [], open_questions: [],
    motion: [motion("character_intro"), motion("title_3d"), motion("cast_lineup"), motion("phone_3d")],
    end_card: { include: true, headline: null, seconds: 2, transition: CUT },
  };
  const bare = bareOf(plan);
  assert.deepEqual(bare.motion.map((m) => m.template), ["character_intro", "cast_lineup"]);
  assert.equal(bare.end_card.include, false);
  assert.equal(bare.captions.mode, "off");
});
