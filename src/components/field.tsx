"use client";

import { cloneElement, isValidElement, useEffect, useId, useRef, type ReactElement, type ReactNode } from "react";
import { cx } from "@/components/ui";

type Control = ReactElement<{ id?: string; "aria-describedby"?: string }>;

// Labels its single control by id, so the accessible name is just the label.
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children as Control, { id, "aria-describedby": hintId })
    : children;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

// A form's tzOffset: the browser's offset from UTC at the time picked in its startsAt field
// (daylight saving time changes it), so a datetime-local value is stored as the moment meant.
export function TzOffset() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = ref.current;
    const form = input?.form;
    if (!input || !form) return;
    const sync = () => {
      const picked = new Date((form.elements.namedItem("startsAt") as HTMLInputElement | null)?.value ?? "");
      input.value = String((Number.isFinite(picked.getTime()) ? picked : new Date()).getTimezoneOffset());
    };
    sync();
    form.addEventListener("input", sync);
    return () => form.removeEventListener("input", sync);
  }, []);
  return <input ref={ref} type="hidden" name="tzOffset" defaultValue="0" />;
}
