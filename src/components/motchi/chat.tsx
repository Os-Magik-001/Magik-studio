"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, X } from "lucide-react";
import { cx } from "@/components/ui";

// Talking with Motchi: a glass panel over the Dock's corner. His answers stream in from
// /api/motchi as he writes them. The conversation lasts as long as the page.

type Line = { role: "user" | "assistant"; content: string };

// His answers are plain text with **bold** names and simple lists.
function bold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>));
}
function Answer({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={cx("my-1 space-y-1 pl-5", list.ordered ? "list-decimal" : "list-disc")}>
        {list.items.map((item, i) => <li key={i}>{bold(item)}</li>)}
      </Tag>,
    );
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const item = line.match(/^(\d+[.)]|[-•*])\s+(.*)$/);
    if (item) {
      const ordered = /\d/.test(item[1]);
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push(item[2]);
    } else {
      flush();
      if (line) blocks.push(<p key={blocks.length}>{bold(line)}</p>);
    }
  }
  flush();
  return <div className="space-y-1.5">{blocks}</div>;
}

// Motchi's portrait (a still of his 3D self), for the panel's header and where WebGL is missing.
export function MotchiFace({ size = 30 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/motchi/motchi.webp" alt="" width={size} height={Math.round(size * 1.12)} draggable={false} className="shrink-0 select-none" />;
}

export function MotchiChat({
  firstName,
  suggestions,
  onClose,
  onThinking,
  onQuiet,
}: {
  firstName: string | null;
  suggestions: string[];
  onClose: () => void;
  onThinking: (on: boolean) => void;
  onQuiet: () => void;
}) {
  const [lines, setLines] = useState<Line[]>([{ role: "assistant", content: `Hi${firstName ? ` ${firstName}` : ""}! How can I help you?` }]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => {
    input.current?.focus();
    return () => pending.current?.abort();
  }, []);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  const setAnswer = (content: string) => setLines((ls) => [...ls.slice(0, -1), { role: "assistant", content }]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const asked: Line[] = [...lines, { role: "user", content: q }];
    setLines([...asked, { role: "assistant", content: "" }]);
    setDraft("");
    setBusy(true);
    onThinking(true);
    const ctrl = new AbortController();
    pending.current = ctrl;
    try {
      const res = await fetch("/api/motchi", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: asked.slice(-16) }),
        signal: ctrl.signal,
      });
      if (!res.body) throw new Error("no answer");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setAnswer(text);
      }
      if (!text.trim()) setAnswer("Sorry, I lost my train of thought. Ask me again?");
    } catch {
      if (!ctrl.signal.aborted) setAnswer("I can't reach the studio right now. Try again in a moment.");
    } finally {
      setBusy(false);
      onThinking(false);
      input.current?.focus();
    }
  }

  const waiting = busy && lines.at(-1)?.content === "";
  return (
    <div
      role="dialog"
      aria-label="Motchi"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
      className="glass-pop motchi-chat fixed right-3 z-[8960] flex w-[min(370px,calc(100vw-24px))] flex-col overflow-hidden rounded-[22px] sm:right-4"
    >
      <header className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
        <MotchiFace />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink">Motchi</p>
          <p className="truncate text-[11.5px] text-muted">Your Magik OS assistant</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-ink">
          <X size={15} aria-hidden />
        </button>
      </header>

      <div ref={list} className="flex min-h-[120px] flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3 text-[13.5px] leading-[1.45]" aria-live="polite">
        {lines.map((line, i) =>
          line.role === "user" ? (
            <p key={i} className="max-w-[85%] self-end rounded-[16px] rounded-br-[6px] bg-accent px-3 py-2 whitespace-pre-wrap text-[#1c1400]">
              {line.content}
            </p>
          ) : (
            <div key={i} className="max-w-[90%] self-start rounded-[16px] rounded-bl-[6px] bg-white/[0.09] px-3 py-2 text-ink-2 shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.12)]">
              {line.content ? (
                <Answer text={line.content} />
              ) : waiting && i === lines.length - 1 ? (
                <span className="flex gap-1 py-1" aria-label="Motchi is thinking">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60" style={{ animationDelay: `${d * 0.15}s` }} />
                  ))}
                </span>
              ) : null}
            </div>
          ),
        )}
        {lines.length === 1 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5 text-left text-[12.5px] text-ink-2 hover:border-accent/50 hover:bg-white/[0.09]">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
        className="flex items-end gap-2 border-t border-white/10 px-3 py-3"
      >
        <textarea
          ref={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              ask(draft);
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder="Ask Motchi about Magik OS"
          aria-label="Your question for Motchi"
          className="max-h-[96px] min-h-[38px] flex-1 resize-none rounded-[14px] bg-white/[0.07] px-3 py-2 text-[13.5px] text-ink shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.14)] [field-sizing:content] placeholder:text-muted/80 focus:outline-none focus-visible:shadow-[inset_0_0_0_1px_rgba(246,212,58,0.6)]"
        />
        <button type="submit" disabled={busy || !draft.trim()} aria-label="Send" className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-accent text-[#1c1400] transition-opacity disabled:opacity-40">
          <ArrowUp size={17} strokeWidth={2.4} aria-hidden />
        </button>
      </form>
      <p className="flex items-center justify-between gap-2 px-4 pb-3 text-[11px] text-muted">
        <span>Motchi knows how Magik OS works. For anything else, use Help.</span>
        <button type="button" onClick={onQuiet} className="shrink-0 underline-offset-2 hover:text-ink hover:underline">
          Quiet today
        </button>
      </p>
    </div>
  );
}
