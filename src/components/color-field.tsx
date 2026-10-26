"use client";

import { useId, useState } from "react";

// A color: the system picker on a swatch, and its hex code to type or paste.

const HEX = /^#?[0-9a-f]{6}$/i;

export function ColorField({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (hex: string) => void }) {
  const id = useId();
  const [text, setText] = useState(value);
  const [shown, setShown] = useState(value);
  // A new colour from outside (a palette chip): show it in the hex field.
  if (shown !== value) {
    setShown(value);
    setText(value);
  }
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      <div className="flex h-9 items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.055] pr-2 pl-1.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)] focus-within:border-accent/70 focus-within:shadow-[0_0_0_3px_rgba(246,212,58,0.22)]">
        <input
          id={id}
          type="color"
          value={value.toLowerCase()}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="size-6 shrink-0 cursor-pointer rounded-[6px] border-0 bg-transparent p-0 [&::-moz-color-swatch]:rounded-[6px] [&::-webkit-color-swatch]:rounded-[6px] [&::-webkit-color-swatch]:border-white/20 [&::-webkit-color-swatch-wrapper]:p-0"
        />
        <input
          type="text"
          aria-label={`${label}, hex code`}
          value={text}
          spellCheck={false}
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value.trim();
            setText(v);
            if (HEX.test(v)) onChange(`#${v.replace("#", "")}`.toUpperCase());
          }}
          onBlur={() => setText(value)}
          className="w-full min-w-0 bg-transparent font-mono text-[12.5px] text-ink uppercase outline-none"
        />
      </div>
      {hint && <p className="text-[11.5px] leading-snug text-muted">{hint}</p>}
    </div>
  );
}
