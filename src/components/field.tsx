"use client";

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
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
