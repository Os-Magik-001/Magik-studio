import "server-only";
import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ScriptBeat, ShootPlan } from "@/lib/agent-types";
import { speakerLines } from "@/lib/script-view";
import type { ScriptStatus } from "@/lib/workflow";

// A script as a PDF to download, print or forward: the client's copy has the script and what
// we'll film; the crew's adds the shoot plan. It is a client document, so it names the studio and
// nothing else, metadata included. The fonts ship with the app (src/assets/fonts, next.config.ts).

const FONTS = path.join(process.cwd(), "src", "assets", "fonts");
let registered = false;
function registerFonts() {
  if (registered) return;
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(FONTS, "Inter-Regular.ttf") },
      { src: path.join(FONTS, "Inter-Italic.ttf"), fontStyle: "italic" },
      { src: path.join(FONTS, "Inter-Medium.ttf"), fontWeight: 500 },
      { src: path.join(FONTS, "Inter-SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(FONTS, "Inter-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({ family: "DM Serif Display", src: path.join(FONTS, "DMSerifDisplay-Regular.ttf") });
  // Words stay whole: a script is read aloud.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

const GOLD = "#B8920A";
const INK = "#1D1D1F";
const MUTED = "#6E6E73";
const LINE = "#E5E5EA";

const s = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 10.5, color: INK, paddingTop: 46, paddingBottom: 56, paddingHorizontal: 50, lineHeight: 1.45 },
  brand: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 26 },
  brandName: { fontSize: 8.5, fontWeight: 700, letterSpacing: 2.4, color: GOLD },
  brandClient: { fontSize: 8.5, color: MUTED, letterSpacing: 0.6 },
  title: { fontFamily: "DM Serif Display", fontSize: 27, lineHeight: 1.12, color: INK },
  meta: { marginTop: 7, fontSize: 9, color: MUTED },
  concept: { marginTop: 12, fontSize: 11.5, fontStyle: "italic", color: INK },
  rule: { marginTop: 18, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: LINE },
  beat: { flexDirection: "row", paddingVertical: 11, borderBottomWidth: 0.6, borderBottomColor: LINE },
  num: { width: 38, fontSize: 17, fontWeight: 700, color: GOLD },
  beatBody: { flex: 1 },
  beatHead: { flexDirection: "row", alignItems: "baseline", marginBottom: 5 },
  beatTitle: { fontSize: 11.5, fontWeight: 600 },
  beatTime: { marginLeft: 8, fontSize: 8.5, color: MUTED },
  row: { flexDirection: "row", marginTop: 3 },
  label: { width: 66, fontSize: 7.5, fontWeight: 600, letterSpacing: 1, color: MUTED, paddingTop: 2 },
  value: { flex: 1 },
  who: { fontSize: 8, fontWeight: 700, letterSpacing: 0.8, color: GOLD },
  said: { fontWeight: 500 },
  screen: { alignSelf: "flex-start", backgroundColor: "#F2F2F5", borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1.5, fontWeight: 600 },
  h2: { marginTop: 22, marginBottom: 8, fontSize: 8.5, fontWeight: 700, letterSpacing: 1.6, color: MUTED },
  list: { flexDirection: "row", flexWrap: "wrap" },
  listItem: { width: "50%", paddingRight: 12, marginBottom: 3, flexDirection: "row" },
  bullet: { width: 16, color: MUTED },
  scene: { paddingVertical: 8, borderBottomWidth: 0.6, borderBottomColor: LINE },
  sceneHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  sceneName: { fontWeight: 600 },
  sceneWhere: { fontSize: 8.5, color: MUTED },
  plain: { fontSize: 11, lineHeight: 1.55 },
  footer: { position: "absolute", bottom: 26, left: 50, right: 50, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: MUTED },
});

// The script's words, like the app's: spoken lines and on-screen text in the video's language,
// the rest in English.
const WORDS = {
  script: "Script",
  beats: (n: number) => `${n} beats`,
  about: (n: number) => `about ${n} seconds`,
  updated: "Updated",
  see: "WE SEE",
  said: "SAID",
  screen: "ON SCREEN",
  film: "WHAT WE'LL FILM",
  plan: "SHOOT PLAN",
  camera: "CAMERA",
  action: "ACTION",
  lines: "LINES",
  notes: "NOTES",
  broll: "B-ROLL",
  props: "PROPS & WARDROBE",
  status: { draft: "Draft", client_review: "For your approval", changes_requested: "Changes requested", approved: "Approved" } as Record<ScriptStatus, string>,
};

export type ScriptPdfInput = {
  client: string;
  title: string;
  status: ScriptStatus;
  updatedAt: string;
  beats: ScriptBeat[];
  body: string;
  shots: string[];
  plan: ShootPlan | null;
  // The crew's copy: the shoot plan under the script.
  withPlan: boolean;
};

function ScriptPdf(p: ScriptPdfInput) {
  const w = WORDS;
  const seconds = p.plan?.length_seconds ? Math.round(p.plan.length_seconds) : null;
  const date = new Date(p.updatedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Toronto" });
  const meta = [w.script, w.status[p.status], p.beats.length ? w.beats(p.beats.length) : null, seconds ? w.about(seconds) : null, `${w.updated} ${date}`].filter(Boolean).join("  ·  ");
  return (
    <Document title={`${p.client} · ${p.title} · ${w.script}`} author="Magik Studio" creator="Magik Studio" producer="Magik Studio" subject={w.script} language="en-CA">
      <Page size="LETTER" style={s.page}>
        <View style={s.brand} fixed>
          <Text style={s.brandName}>MAGIK STUDIO</Text>
          <Text style={s.brandClient}>{p.client}</Text>
        </View>
        <Text style={s.title}>{p.title}</Text>
        <Text style={s.meta}>{meta}</Text>
        {p.plan?.concept ? <Text style={s.concept}>{p.plan.concept}</Text> : null}
        <View style={s.rule} />

        {p.beats.length ? (
          p.beats.map((b, i) => (
            <View key={i} style={s.beat} wrap={false}>
              <Text style={s.num}>{String(i + 1).padStart(2, "0")}</Text>
              <View style={s.beatBody}>
                <View style={s.beatHead}>
                  <Text style={s.beatTitle}>{b.title}</Text>
                  {b.time ? <Text style={s.beatTime}>{b.time}</Text> : null}
                </View>
                {b.visual ? (
                  <View style={s.row}>
                    <Text style={s.label}>{w.see}</Text>
                    <Text style={s.value}>{b.visual}</Text>
                  </View>
                ) : null}
                {b.voice ? (
                  <View style={s.row}>
                    <Text style={s.label}>{w.said}</Text>
                    <View style={s.value}>
                      {speakerLines(b.voice).map((l, k) => (
                        <Text key={k}>
                          {l.who ? <Text style={s.who}>{l.who.toUpperCase()}  </Text> : null}
                          <Text style={s.said}>{l.line}</Text>
                        </Text>
                      ))}
                    </View>
                  </View>
                ) : null}
                {b.on_screen ? (
                  <View style={s.row}>
                    <Text style={s.label}>{w.screen}</Text>
                    <View style={s.value}>
                      <Text style={s.screen}>{b.on_screen}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <Text style={s.plain}>{p.body}</Text>
        )}

        {p.shots.length ? (
          <View wrap={false}>
            <Text style={s.h2}>{w.film}</Text>
            <View style={s.list}>
              {p.shots.map((shot, i) => (
                <View key={i} style={s.listItem}>
                  <Text style={s.bullet}>{i + 1}.</Text>
                  <Text style={s.value}>{shot}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {p.withPlan && p.plan?.scenes.length ? (
          <View>
            <Text style={s.h2} minPresenceAhead={60}>
              {w.plan}
            </Text>
            {p.plan.scenes.map((sc, i) => (
              <View key={i} style={s.scene} wrap={false}>
                <View style={s.sceneHead}>
                  <Text style={s.sceneName}>
                    {i + 1}. {sc.name}
                  </Text>
                  <Text style={s.sceneWhere}>
                    {sc.location} · {Math.round(sc.seconds)} s
                  </Text>
                </View>
                {(
                  [
                    [w.camera, sc.setup],
                    [w.action, sc.action],
                    [w.lines, sc.lines],
                    [w.screen, sc.on_screen_text],
                    [w.notes, sc.notes],
                  ] as const
                )
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <View key={k} style={s.row}>
                      <Text style={s.label}>{k}</Text>
                      <Text style={s.value}>{v}</Text>
                    </View>
                  ))}
              </View>
            ))}
            {(
              [
                [w.broll, p.plan.broll],
                [w.props, p.plan.props_wardrobe],
              ] as const
            )
              .filter(([, items]) => items.length)
              .map(([k, items]) => (
                <View key={k} wrap={false}>
                  <Text style={s.h2}>{k}</Text>
                  <View style={s.list}>
                    {items.map((x, i) => (
                      <View key={i} style={s.listItem}>
                        <Text style={s.bullet}>•</Text>
                        <Text style={s.value}>{x}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
          </View>
        ) : null}

        <View style={s.footer} fixed>
          <Text>
            Magik Studio · {p.client} · {p.title}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderScriptPdf(input: ScriptPdfInput) {
  registerFonts();
  return renderToBuffer(<ScriptPdf {...input} />);
}
