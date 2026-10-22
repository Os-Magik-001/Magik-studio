"use client";

import { cx } from "@/components/ui";

// A macOS switch.
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-[24px] w-[42px] shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-40",
        checked ? "bg-success" : "bg-white/[0.16]",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "absolute top-[2px] left-[2px] h-[20px] w-[20px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.4)] transition-transform duration-200",
          checked && "translate-x-[18px]",
        )}
      />
    </button>
  );
}

// A row of choices, one picked (a macOS segmented control, as buttons).
export function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-white/[0.07] p-[3px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex h-[28px] items-center rounded-full px-3.5 text-[13px] font-medium transition-colors",
            o.value === value ? "bg-white/[0.16] text-ink shadow-[0_1px_3px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.12)]" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
