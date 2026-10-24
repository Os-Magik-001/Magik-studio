"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ExternalLink, FileText, ImageUp, Link2, Plus, Sparkles, X } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button, Input, cx } from "@/components/ui";
import { Field } from "@/components/field";
import { LogoCreator } from "@/components/logo/logo-creator";
import { PLATFORM_LABEL, type ReferencePlatform } from "@/lib/reference-links";
import type { LogoSpec } from "@/lib/logo-templates";
import {
  addSetupReference,
  completeSetup,
  finishQuestions,
  finishReferences,
  logoSuggestions,
  removeSetupReference,
  saveCreatedLogo,
  saveSetupAnswer,
  signContract,
  uploadBrandLogo,
} from "@/app/actions/setup";

// ---------------------------------------------------------------- the contract

export function ContractStep({ contract, name }: { contract: { id: string; fileName: string; url: string | null }; name: string }) {
  return (
    <div className="grid flex-1 gap-8 lg:grid-cols-[1.3fr_1fr]">
      <div className="flex min-h-[420px] flex-col overflow-hidden rounded-[18px] bg-white/[0.04] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
        {contract.url ? (
          <iframe src={`${contract.url}#view=FitH`} title="Your contract" className="min-h-[420px] w-full flex-1 bg-white" />
        ) : (
          <p className="m-auto text-[13px] text-muted">The contract couldn&apos;t be loaded. Reload the page.</p>
        )}
      </div>
      <div className="flex flex-col justify-center">
        <p className="kicker">Before we start</p>
        <h1 className="mt-2 font-display text-[28px] leading-tight font-bold tracking-tight text-ink">Your contract</h1>
        <p className="mt-3 text-[14px] text-ink-2">Read the agreement with Magik, then sign it by typing your name.</p>
        {contract.url && (
          <a href={contract.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] text-accent hover:underline">
            <FileText size={14} aria-hidden /> {contract.fileName} <ExternalLink size={12} aria-hidden />
          </a>
        )}
        <ActionForm action={signContract} className="mt-6 flex flex-col gap-4">
          <input type="hidden" name="contractId" value={contract.id} />
          <label className="flex items-start gap-3 text-[13.5px] text-ink-2">
            <input type="checkbox" name="agree" value="1" required className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
            I have read the contract and I accept it.
          </label>
          <Field label="Type your full name to sign">
            <Input name="signature" required defaultValue="" placeholder={name} autoComplete="name" className="h-11 font-serif text-[20px] italic" />
          </Field>
          <SubmitButton pendingText="Signing…" className="h-11">
            Sign and continue <ArrowRight size={16} aria-hidden />
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the questions, one at a time

type Question = { key: string; label: string; hint: string; rows: number };

export function QuestionsStep({ questions, initial, required }: { questions: Question[]; initial: Record<string, string>; required: number }) {
  const router = useRouter();
  const firstOpen = Math.max(0, questions.findIndex((q) => !initial[q.key]));
  const [index, setIndex] = useState(firstOpen);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const field = useRef<HTMLTextAreaElement>(null);
  const q = questions[index];
  const value = values[q.key] ?? "";
  const isRequired = index < required;
  const last = index === questions.length - 1;

  useEffect(() => {
    field.current?.focus();
    const el = field.current;
    if (el) el.selectionStart = el.selectionEnd = el.value.length;
  }, [index]);

  const go = (to: number | "finish", save = true) => {
    setError(null);
    startTransition(async () => {
      if (save) {
        const res = await saveSetupAnswer({ key: q.key, value });
        if (res.error) return setError(res.error);
      }
      if (to === "finish") {
        const res = await finishQuestions();
        if (res.error) return setError(res.error);
        router.refresh();
      } else {
        setIndex(to);
      }
    });
  };

  const next = () => {
    if (isRequired && !value.trim()) return setError("This one helps us most: a sentence or two is enough.");
    go(last ? "finish" : index + 1);
  };

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col">
      <div className="flex items-center gap-3">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
        </div>
        <span className="text-[12px] text-muted tabular-nums">
          {index + 1} of {questions.length}
        </span>
      </div>

      <div key={q.key} className="animate-rise-in flex flex-1 flex-col justify-center py-10">
        <label htmlFor="answer" className="font-display text-[30px] leading-tight font-bold tracking-tight text-ink sm:text-[34px]">
          {q.label}
        </label>
        <p className="mt-2 text-[15px] text-ink-2">{q.hint}</p>
        <textarea
          id="answer"
          ref={field}
          rows={Math.max(2, q.rows + 1)}
          value={value}
          onChange={(e) => setValues((v) => ({ ...v, [q.key]: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              next();
            }
          }}
          placeholder="Type your answer…"
          className="mt-6 w-full resize-none rounded-[16px] border border-white/12 bg-white/[0.06] px-5 py-4 text-[17px] leading-relaxed text-ink shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] placeholder:text-muted/60 focus:border-accent/70 focus:shadow-[0_0_0_4px_rgba(246,212,58,0.18)] focus:outline-none"
        />
        <p className="mt-2 text-[12px] text-muted">
          Press <kbd className="rounded bg-white/10 px-1.5 font-sans">Enter</kbd> to continue, <kbd className="rounded bg-white/10 px-1.5 font-sans">Shift</kbd> +{" "}
          <kbd className="rounded bg-white/10 px-1.5 font-sans">Enter</kbd> for a new line.
          {!isRequired && " You can skip this one."}
        </p>
        {error && (
          <p role="alert" className="mt-3 text-[13.5px] text-danger">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => go(index - 1, false)} disabled={index === 0 || pending}>
          <ArrowLeft size={16} aria-hidden /> Back
        </Button>
        <div className="flex items-center gap-2">
          {!isRequired && (
            <Button variant="ghost" disabled={pending} onClick={() => go(last ? "finish" : index + 1)}>
              Skip
            </Button>
          )}
          <Button variant="primary" onClick={next} disabled={pending} className="h-10 px-6">
            {pending ? "Saving…" : last ? "Finish" : "Continue"} {!pending && <ArrowRight size={16} aria-hidden />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- references

type LibraryItem = { id: string; url: string; platform: string; title: string; note: string | null; tags: string[]; cover: string | null };
type Added = { id: string; url: string; platform: string; title: string | null; note: string | null; libraryId: string | null };

const youtubeId = (url: string) => url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/)?.[1] ?? null;
const PLATFORM_TINT: Record<string, string> = {
  instagram: "linear-gradient(135deg,#f58529,#dd2a7b 50%,#8134af)",
  tiktok: "linear-gradient(135deg,#25f4ee,#000 45%,#fe2c55)",
  youtube: "linear-gradient(135deg,#ff4e45,#a50000)",
  vimeo: "linear-gradient(135deg,#1ab7ea,#0d5f80)",
};

export function ReferencesStep({ library, added }: { library: LibraryItem[]; added: Added[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Added[]>(added);
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (item: LibraryItem) => {
    const chosen = items.find((a) => a.libraryId === item.id);
    setBusy(item.id);
    setError(null);
    startTransition(async () => {
      if (chosen) {
        await removeSetupReference(chosen.id);
        setItems((xs) => xs.filter((x) => x.id !== chosen.id));
      } else {
        const res = await addSetupReference({ libraryId: item.id });
        if (res.error) setError(res.error);
        else if (res.data?.id) setItems((xs) => [...xs, { id: res.data!.id, url: item.url, platform: item.platform, title: item.title, note: null, libraryId: item.id }]);
      }
      setBusy(null);
    });
  };

  const add = () => {
    if (!link.trim()) return setError("Paste a link to a video first.");
    setError(null);
    startTransition(async () => {
      const res = await addSetupReference({ link, note });
      if (res.error) return setError(res.error);
      setItems((xs) => [...xs, { id: res.data!.id, url: link.trim(), platform: "other", title: null, note: note.trim() || null, libraryId: null }]);
      setLink("");
      setNote("");
    });
  };

  const own = items.filter((i) => !i.libraryId);
  const finish = () =>
    startTransition(async () => {
      await finishReferences();
      router.refresh();
    });

  return (
    <div className="flex flex-1 flex-col">
      <p className="kicker">Videos to match</p>
      <h1 className="mt-2 font-display text-[30px] leading-tight font-bold tracking-tight text-ink">Show us the videos you love</h1>
      <p className="mt-2 max-w-2xl text-[14.5px] text-ink-2">
        Pick a few from our library and add your own links: reels or videos whose style, rhythm or look you&apos;d like for your brand.
      </p>

      {library.length > 0 && (
        <section className="mt-7">
          <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">From our library</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {library.map((item) => {
              const chosen = items.some((a) => a.libraryId === item.id);
              const yt = item.platform === "youtube" ? youtubeId(item.url) : null;
              const cover = item.cover ?? (yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={chosen}
                    disabled={busy === item.id}
                    onClick={() => toggle(item)}
                    className={cx(
                      "group relative block w-full overflow-hidden rounded-[18px] text-left transition-[box-shadow,transform] active:scale-[0.98]",
                      chosen ? "shadow-[0_0_0_3px_var(--accent)]" : "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] hover:shadow-[0_0_0_2px_rgba(255,255,255,0.35)]",
                    )}
                  >
                    <div
                      className="aspect-[4/5] w-full bg-cover bg-center"
                      style={{ backgroundImage: cover ? `url("${cover}")` : (PLATFORM_TINT[item.platform] ?? "linear-gradient(135deg,#3a3a3c,#1c1c1e)") }}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-10">
                      <p className="line-clamp-2 text-[13px] font-semibold text-white">{item.title}</p>
                      {item.tags.length > 0 && <p className="mt-0.5 truncate text-[11px] text-white/70">{item.tags.join(" · ")}</p>}
                    </div>
                    <span
                      className={cx(
                        "absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                        chosen ? "bg-accent text-black" : "bg-black/45 text-white/80 backdrop-blur",
                      )}
                    >
                      {chosen ? <Check size={15} strokeWidth={3} aria-hidden /> : <Plus size={15} aria-hidden />}
                    </span>
                  </button>
                  <a href={item.url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 px-1 text-[12px] text-muted hover:text-ink">
                    Watch on {PLATFORM_LABEL[item.platform as ReferencePlatform] ?? "the web"} <ExternalLink size={11} aria-hidden />
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">Your own links</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Link2 size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" aria-hidden />
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
              placeholder="Paste an Instagram, TikTok or YouTube link"
              aria-label="Video link"
              className="h-11 pl-10"
            />
          </div>
          <Input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} placeholder="What do you like about it? (optional)" aria-label="What you like about it" className="h-11 sm:max-w-xs" />
          <Button variant="secondary" onClick={add} disabled={pending} className="h-11">
            <Plus size={16} aria-hidden /> Add
          </Button>
        </div>
        {own.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {own.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-[14px] bg-white/[0.05] px-4 py-2.5">
                <Link2 size={15} className="shrink-0 text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] text-ink">{a.url}</p>
                  {a.note && <p className="truncate text-[12px] text-muted">“{a.note}”</p>}
                </div>
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() =>
                    startTransition(async () => {
                      await removeSetupReference(a.id);
                      setItems((xs) => xs.filter((x) => x.id !== a.id));
                    })
                  }
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-ink"
                >
                  <X size={15} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && (
        <p role="alert" className="mt-4 text-[13.5px] text-danger">
          {error}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-8">
        <span className="text-[13px] text-muted">{items.length ? `${items.length} video${items.length === 1 ? "" : "s"} chosen` : "Choose at least one"}</span>
        <div className="flex items-center gap-2">
          {!items.length && (
            <Button variant="ghost" onClick={finish} disabled={pending}>
              Skip for now
            </Button>
          )}
          <Button variant="primary" onClick={finish} disabled={pending || !items.length} className="h-10 px-6">
            Continue <ArrowRight size={16} aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the brand

export function BrandStep({ brandName, initial }: { brandName: string; initial: LogoSpec | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "upload" | "create">("choose");
  const [suggestions, setSuggestions] = useState<LogoSpec[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (mode !== "create" || suggestions) return;
    logoSuggestions()
      .then(setSuggestions)
      .catch(() => setLoadError(true));
  }, [mode, suggestions]);

  if (mode === "choose") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-4 text-center">
        <p className="kicker">Last step</p>
        <h1 className="mt-2 font-display text-[32px] leading-tight font-bold tracking-tight text-ink">Do you already have a brand?</h1>
        <p className="mt-2 max-w-lg text-[14.5px] text-ink-2">Your logo goes on every video we make for you.</p>
        <div className="mt-9 grid w-full max-w-[720px] gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("upload")}
            className="group flex flex-col items-center rounded-[24px] bg-white/[0.05] px-6 py-9 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] transition-[background-color,transform] hover:bg-white/[0.09] active:scale-[0.98]"
          >
            <span className="app-icon h-16 w-16" style={{ background: "linear-gradient(180deg,#7cc4ff,#2f6bf0)" }}>
              <ImageUp size={30} aria-hidden />
            </span>
            <span className="mt-5 text-[18px] font-semibold text-ink">Yes, I have a logo</span>
            <span className="mt-1 text-[13.5px] text-muted">Upload it, with your colors and fonts</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("create")}
            className="group flex flex-col items-center rounded-[24px] bg-white/[0.05] px-6 py-9 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] transition-[background-color,transform] hover:bg-white/[0.09] active:scale-[0.98]"
          >
            <span className="app-icon h-16 w-16" style={{ background: "linear-gradient(180deg,#ffe36e,#d9a60c)" }}>
              <Sparkles size={30} color="#1c1400" aria-hidden />
            </span>
            <span className="mt-5 text-[18px] font-semibold text-ink">No, let&apos;s create one</span>
            <span className="mt-1 text-[13.5px] text-muted">Start from ready-made designs and make it yours</span>
          </button>
        </div>
      </div>
    );
  }

  if (mode === "upload") return <UploadLogo onBack={() => setMode("choose")} />;

  if (!suggestions) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        {loadError ? (
          <>
            <p className="text-[14px] text-ink-2">We couldn&apos;t load the designs.</p>
            <Button variant="secondary" onClick={() => (setLoadError(false), setSuggestions(null), setMode("create"))}>
              Try again
            </Button>
          </>
        ) : (
          <>
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-accent" aria-hidden />
            <p className="text-[14px] text-ink-2">Preparing designs for {brandName}…</p>
          </>
        )}
      </div>
    );
  }

  return (
    <LogoCreator
      brandName={brandName}
      suggestions={suggestions}
      initial={initial}
      onBack={() => setMode("choose")}
      onSave={async (png, spec) => {
        const data = new FormData();
        data.set("logo", new File([png], "logo.png", { type: "image/png" }));
        data.set("spec", JSON.stringify(spec));
        const res = await saveCreatedLogo(data);
        if (res.error) return { error: res.error };
        router.replace("/setup?step=done");
        return {};
      }}
    />
  );
}

function UploadLogo({ onBack }: { onBack: () => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [colors, setColors] = useState<string[]>([]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col">
      <button type="button" onClick={onBack} className="flex w-fit items-center gap-1 text-[13.5px] text-muted hover:text-ink">
        <ArrowLeft size={15} aria-hidden /> Back
      </button>
      <h1 className="mt-3 font-display text-[28px] font-bold tracking-tight text-ink">Upload your logo</h1>
      <p className="mt-1.5 text-[14px] text-ink-2">A PNG with a transparent background works best. SVG, JPG and WebP are fine too.</p>
      <ActionForm action={uploadBrandLogo} className="mt-6 grid gap-6 sm:grid-cols-[1fr_1fr]">
        <label
          className={cx(
            "flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed p-5 text-center transition-colors",
            preview ? "border-white/20 bg-[repeating-conic-gradient(#2a2a2e_0_25%,#202024_0_50%)] bg-[length:22px_22px]" : "border-white/25 hover:bg-white/[0.04]",
          )}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Your logo" className="max-h-[180px] max-w-full object-contain" />
          ) : (
            <>
              <ImageUp size={26} className="text-muted" aria-hidden />
              <span className="text-[14px] font-medium text-ink">Choose your logo</span>
              <span className="text-[12px] text-muted">Up to 4 MB</span>
            </>
          )}
          <input
            type="file"
            name="logo"
            required
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPreview(f ? URL.createObjectURL(f) : null);
            }}
          />
        </label>
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-[13px] font-medium text-ink-2">Your brand colors (optional)</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {colors.map((c, i) => (
                <span key={i} className="relative">
                  <input
                    type="color"
                    name="colors"
                    value={c}
                    onChange={(e) => setColors((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))}
                    aria-label={`Color ${i + 1}`}
                    className="h-11 w-11 cursor-pointer rounded-full border border-white/20 bg-transparent p-0.5 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
                  />
                  {colors.length > 0 && (
                    <button
                      type="button"
                      aria-label={`Remove color ${i + 1}`}
                      onClick={() => setColors((xs) => xs.filter((_, j) => j !== i))}
                      className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-black/80 text-white"
                    >
                      <X size={10} aria-hidden />
                    </button>
                  )}
                </span>
              ))}
              {colors.length < 5 && (
                <button
                  type="button"
                  onClick={() => setColors((xs) => [...xs, xs.length ? "#F6D43A" : "#111111"])}
                  aria-label="Add a color"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-white/25 text-muted hover:text-ink"
                >
                  <Plus size={16} aria-hidden />
                </button>
              )}
            </div>
          </div>
          <Field label="Your fonts (optional)" hint="If you know them, e.g. Montserrat, Playfair Display.">
            <Input name="fonts" placeholder="Montserrat" />
          </Field>
          <SubmitButton pendingText="Uploading…" className="mt-auto h-11">
            Save my brand <ArrowRight size={16} aria-hidden />
          </SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}

// ---------------------------------------------------------------- done

export function DoneStep({ name, clientName, logo }: { name: string; clientName: string; logo: string | null }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={`${clientName} logo`} className="animate-rise-in h-32 w-72 rounded-[22px] bg-white object-contain p-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]" />
      ) : (
        <span className="app-icon h-20 w-20" style={{ background: "linear-gradient(180deg,#5fe38f,#17a347)" }}>
          <Check size={40} strokeWidth={2.5} aria-hidden />
        </span>
      )}
      <h1 className="animate-rise-in mt-8 font-display text-[34px] leading-tight font-bold tracking-tight text-ink [animation-delay:0.15s]">
        You&apos;re all set, {name.split(/\s+/)[0]}.
      </h1>
      <p className="animate-rise-in mt-3 max-w-lg text-[15px] text-ink-2 [animation-delay:0.25s]">
        The studio has everything it needs to start on {clientName}&apos;s videos. You&apos;ll find them, your brand and your documents on your Magik desktop.
      </p>
      <form action={completeSetup} className="animate-rise-in mt-9 [animation-delay:0.35s]">
        <Button variant="primary" className="h-11 px-7 text-[15px]">
          Go to my desktop <ArrowRight size={16} aria-hidden />
        </Button>
      </form>
    </div>
  );
}
