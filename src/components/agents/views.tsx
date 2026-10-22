import type { ReactNode } from "react";
import type { Charte, DesignBrief, Pillar, ShootPlan, SoundReport, TrendAudio, TrendFindings, TrendReel } from "@/lib/agent-types";
import { templateById } from "@/lib/design-templates";
import { Badge } from "@/components/ui";
import { LocalDate } from "@/components/local-date";

// Read-only views of what the agents wrote.

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="kicker">{title}</h3>
      {children}
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-sm text-muted">None.</p>;
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-2">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

export function StrategyView({
  niche,
  keywords,
  accounts,
  business,
  audience,
  needs,
  pillars,
  charte,
}: {
  niche: string | null;
  keywords: string[];
  accounts: string[];
  business: string | null;
  audience: string | null;
  needs: string[];
  pillars: Pillar[];
  charte: Charte | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Section title="Niche">
        <p className="font-serif text-2xl text-ink">{niche}</p>
        <div className="flex flex-wrap gap-1.5 text-xs text-muted">
          {keywords.map((k) => (
            <span key={k} className="rounded-full bg-white/8 px-2 py-0.5">#{k}</span>
          ))}
          {accounts.map((a) => (
            <span key={a} className="rounded-full bg-white/8 px-2 py-0.5">@{a}</span>
          ))}
        </div>
      </Section>
      <div className="grid gap-6 @min-[48rem]:grid-cols-2">
        <Section title="The business">
          <p className="text-sm leading-relaxed text-ink-2">{business}</p>
        </Section>
        <Section title="Audience">
          <p className="text-sm leading-relaxed text-ink-2">{audience}</p>
        </Section>
      </div>
      <Section title="What the videos must achieve">
        <Bullets items={needs} />
      </Section>
      {charte && (
        <Section title="Charte graphique">
          <div className="flex flex-wrap gap-3">
            {charte.palette.map((c) => (
              <div key={c.hex + c.name} className="flex items-center gap-2 rounded-xl bg-white/[0.04] p-2 pr-3">
                <span className="h-9 w-9 rounded-lg border border-white/15" style={{ background: c.hex }} />
                <span className="text-xs">
                  <span className="block font-medium text-ink">{c.name}</span>
                  <span className="text-muted">
                    {c.hex} · {c.role}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <dl className="mt-2 grid gap-x-6 gap-y-3 text-sm @min-[48rem]:grid-cols-2">
            {[
              ["Fonts", `${charte.fonts.headline} / ${charte.fonts.body}${charte.fonts.notes ? ` · ${charte.fonts.notes}` : ""}`],
              ["Captions", `${charte.captions.preset} · highlight ${charte.captions.highlight}${charte.captions.notes ? ` · ${charte.captions.notes}` : ""}`],
              ["Motion", charte.motion],
              ["Music", charte.music_mood],
              ["Tone of voice", charte.tone_of_voice],
              ["Logo", charte.logo_usage],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-2 grid gap-4 @min-[48rem]:grid-cols-3">
            <div>
              <div className="mb-1 text-xs text-muted">Typography</div>
              <Bullets items={charte.typography} />
            </div>
            <div>
              <div className="mb-1 text-xs text-success">Do</div>
              <Bullets items={charte.dos} />
            </div>
            <div>
              <div className="mb-1 text-xs text-danger">Don&apos;t</div>
              <Bullets items={charte.donts} />
            </div>
          </div>
        </Section>
      )}
      {pillars.length > 0 && (
        <Section title="Content pillars">
          <div className="grid gap-3 @min-[48rem]:grid-cols-2">
            {pillars.map((p) => (
              <div key={p.name} className="rounded-xl bg-white/[0.04] p-3">
                <div className="text-sm font-medium text-ink">{p.name}</div>
                <p className="mt-1 text-[13px] text-muted">{p.description}</p>
                <Bullets items={p.ideas} />
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

const compact = (n: number | null) => (n === null ? "?" : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));

export function FindingsView({ findings, reels, audio = [] }: { findings: TrendFindings; reels: TrendReel[]; audio?: TrendAudio[] }) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm leading-relaxed text-ink">{findings.summary}</p>
      <Section title="Hooks that work">
        <ul className="flex flex-col gap-2">
          {findings.hooks.map((h, i) => (
            <li key={i} className="rounded-xl bg-white/[0.04] p-3 text-sm">
              <div className="font-medium text-ink">{h.pattern}</div>
              <div className="text-ink-2">&ldquo;{h.example}&rdquo;</div>
              <div className="text-[13px] text-muted">{h.why}</div>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Structures">
        <div className="grid gap-3 @min-[48rem]:grid-cols-2">
          {findings.structures.map((s, i) => (
            <div key={i} className="rounded-xl bg-white/[0.04] p-3 text-sm">
              <div className="font-medium text-ink">
                {s.name} <span className="text-xs text-muted">· {s.length}</span>
              </div>
              <ol className="mt-1 list-decimal pl-5 text-ink-2">
                {s.beats.map((b, k) => (
                  <li key={k}>{b}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Section>
      <div className="grid gap-6 @min-[48rem]:grid-cols-2">
        <Section title="Editing">
          <Bullets items={findings.editing} />
        </Section>
        <Section title="Text on screen">
          <Bullets items={findings.on_screen_text} />
        </Section>
        <Section title="Sound">
          <Bullets items={findings.audio} />
        </Section>
        <Section title="For the scripts">
          <Bullets items={findings.scripting} />
        </Section>
      </div>
      {audio.length > 0 && (
        <Section title="Trending sounds">
          <ul className="divide-y divide-line rounded-xl border border-line">
            {audio.map((a, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
                <span className="font-medium text-ink">{a.title}</span>
                <span className="text-ink-2">{a.artist}</span>
                <span className="text-xs text-muted">
                  {a.original ? "original audio" : "licensed song"} · {a.reels} reel{a.reels > 1 ? "s" : ""} by {a.creators} account{a.creators > 1 ? "s" : ""} · {compact(a.plays)} plays
                  {a.bpm ? ` · ${Math.round(a.bpm)} BPM` : ""}
                </span>
                {a.link && (
                  <a href={a.link} target="_blank" rel="noreferrer" className="ml-auto text-[13px] text-accent hover:underline">
                    Open in Instagram
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="Video ideas for this client">
        <div className="grid gap-3 @min-[48rem]:grid-cols-2">
          {findings.ideas.map((x, i) => (
            <div key={i} className="rounded-xl bg-white/[0.04] p-3 text-sm">
              <div className="font-medium text-ink">{x.title}</div>
              <div className="text-ink-2">Hook: {x.hook}</div>
              <div className="text-[13px] text-muted">{x.outline}</div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Avoid">
        <Bullets items={findings.avoid} />
      </Section>
      <Section title={`The ${reels.length} reels studied`}>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {reels.map((r, i) => (
            <li key={i} className="flex flex-col gap-1 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 text-[13px]">
                <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
                  @{r.owner}
                </a>
                <span className="text-muted">
                  {compact(r.plays)} plays · {compact(r.likes)} likes · {r.duration ?? "?"}s{r.cutsPerSecond !== null ? ` · ${r.cutsPerSecond} cuts/s` : ""}
                </span>
              </div>
              {r.hook && <div className="text-ink-2">Hook: {r.hook}</div>}
              {r.audio && <div className="text-[13px] text-ink-2">Sound: {r.audio}</div>}
              {r.why && <div className="text-[13px] text-muted">{r.why}</div>}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

const ALIGN = { start: "starts on a downbeat", hit: "lined up so a drop lands on a key moment", end: "back-timed to end on the last frame" };

// What the sound designer (agent 4) chose for a version.
export function SoundView({ sound }: { sound: SoundReport }) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="leading-relaxed text-ink">{sound.concept}</p>
      <div className="rounded-xl bg-white/[0.04] p-3">
        <div className="kicker mb-1">Music</div>
        {sound.track ? (
          <>
            <div className="text-ink">
              <span className="font-medium">{sound.track.title}</span> <span className="text-ink-2">by {sound.track.artist}</span>
            </div>
            <div className="text-[13px] text-muted">
              {sound.track.library} · {sound.track.license}
              {sound.track.bpm ? ` · ${Math.round(sound.track.bpm)} BPM` : ""} · {ALIGN[sound.align]}
              {sound.at > 0 ? `, comes in at ${sound.at.toFixed(1)}s` : `, from ${sound.start.toFixed(1)}s into the track`}
            </div>
            {sound.track.page && (
              <a href={sound.track.page} target="_blank" rel="noreferrer" className="text-[13px] text-accent hover:underline">
                Source and licence
              </a>
            )}
          </>
        ) : (
          <div className="text-ink-2">No music: the dialogue plays alone.</div>
        )}
      </div>
      {sound.trend && (
        <div className="rounded-xl bg-accent-soft p-3">
          <div className="kicker mb-1">Trending sound to add when posting</div>
          <div className="text-ink">
            <span className="font-medium">{sound.trend.title}</span> <span className="text-ink-2">by {sound.trend.artist}</span>
            {sound.trend.link && (
              <a href={sound.trend.link} target="_blank" rel="noreferrer" className="ml-2 text-[13px] text-accent hover:underline">
                Open in Instagram
              </a>
            )}
          </div>
          <p className="mt-1 text-[13px] text-ink-2">{sound.trend.use}</p>
          <p className="mt-1 text-xs text-muted">Add it in the Instagram app when posting: licensed songs can&apos;t be in the exported file.</p>
        </div>
      )}
      {sound.credits.length > 0 && (
        <div className="rounded-xl border border-warning/40 p-3">
          <div className="kicker mb-1 text-warning">Credit to put in the caption</div>
          {sound.credits.map((c, i) => (
            <p key={i} className="select-all font-mono text-[12.5px] text-ink-2">
              {c}
            </p>
          ))}
        </div>
      )}
      {sound.limits.map((l, i) => (
        <p key={i} className="text-xs text-warning">
          {l}
        </p>
      ))}
      {sound.sfx.length > 0 && (
        <div>
          <div className="kicker mb-1">Sound effects ({sound.sfx.length})</div>
          <ul className="flex flex-col gap-0.5 text-[13px] text-ink-2">
            {sound.sfx.map((x, i) => (
              <li key={i}>
                <span className="font-mono text-muted">{x.at.toFixed(1)}s</span> {x.title} <span className="text-muted">· {x.library}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {sound.notes && <p className="text-[13px] text-muted">{sound.notes}</p>}
    </div>
  );
}

// The motion director's brief: the concept, the system and a design prompt per scene. With
// `chosen`, it says when the templates changed after the brief was written.
export function DesignBriefView({ brief, chosen }: { brief: DesignBrief; chosen?: string[] }) {
  const stale = chosen?.some((id) => !brief.templates.includes(id));
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="kicker">Design brief</span>
        <span className="text-xs text-muted">
          <LocalDate value={brief.written_at} preset="short" prefix="written " />
        </span>
      </div>
      {stale && <p className="text-[13px] text-warning">The templates changed since this brief: design the motion again.</p>}
      <p className="leading-relaxed text-ink">{brief.concept}</p>
      <p className="text-[13px] text-ink-2">{brief.system}</p>
      <ol className="flex flex-col gap-2">
        {brief.scenes.map((s, i) => (
          <li key={i} className="rounded-xl bg-white/[0.04] p-3">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="font-medium text-ink">{s.moment}</span>
              <Badge>{templateById(s.template)?.title ?? (s.template === "custom" ? "Custom" : s.template)}</Badge>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">{s.prompt}</p>
            {s.needs && <p className="mt-1 text-xs text-warning">Needs: {s.needs}</p>}
          </li>
        ))}
      </ol>
      <p className="text-[13px] text-ink-2">
        <span className="font-medium text-ink">Captions: </span>
        {brief.captions}
      </p>
      <p className="text-[13px] text-ink-2">
        <span className="font-medium text-ink">End card: </span>
        {brief.end_card}
      </p>
      {brief.editor_notes && <p className="text-xs text-muted">For the editor: {brief.editor_notes}</p>}
    </div>
  );
}

export function ShootPlanView({ plan }: { plan: ShootPlan }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink">
        {plan.concept} <span className="text-muted">· about {Math.round(plan.length_seconds)}s</span>
      </p>
      <ol className="flex flex-col gap-3">
        {plan.scenes.map((s, i) => (
          <li key={i} className="rounded-xl border border-line p-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-ink">
                {i + 1}. {s.name}
              </span>
              <span className="text-xs text-muted">
                {s.location} · {Math.round(s.seconds)}s
              </span>
            </div>
            <dl className="mt-2 grid gap-x-4 gap-y-1.5 text-[13px] @min-[40rem]:grid-cols-[110px_1fr]">
              <dt className="text-muted">Camera</dt>
              <dd className="text-ink-2">{s.setup}</dd>
              <dt className="text-muted">Action</dt>
              <dd className="text-ink-2">{s.action}</dd>
              {s.lines && (
                <>
                  <dt className="text-muted">Lines</dt>
                  <dd className="whitespace-pre-wrap text-ink">{s.lines}</dd>
                </>
              )}
              {s.on_screen_text && (
                <>
                  <dt className="text-muted">On screen</dt>
                  <dd className="text-ink-2">{s.on_screen_text}</dd>
                </>
              )}
              {s.notes && (
                <>
                  <dt className="text-muted">Notes</dt>
                  <dd className="text-ink-2">{s.notes}</dd>
                </>
              )}
            </dl>
          </li>
        ))}
      </ol>
      <div className="grid gap-4 @min-[40rem]:grid-cols-2">
        <Section title="B-roll">
          <Bullets items={plan.broll} />
        </Section>
        <Section title="Props & wardrobe">
          <Bullets items={plan.props_wardrobe} />
        </Section>
      </div>
    </div>
  );
}
