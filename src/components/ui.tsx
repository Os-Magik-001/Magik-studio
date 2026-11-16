import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";

const variantClass: Record<Variant, string> = {
  // Liquid Glass: only the primary action is tinted; everything else is clear glass or plain.
  primary: "glass-tint font-semibold hover:brightness-[1.07] hover:-translate-y-px active:translate-y-0 active:scale-[0.97]",
  // Quiet inside a window: a soft fill, no rim of its own.
  secondary: "bg-white/[0.085] text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07),inset_0_1px_0_rgba(255,255,255,0.07)] hover:bg-white/[0.14] active:scale-[0.97]",
  ghost: "text-ink-2 hover:bg-white/8 hover:text-ink",
  danger: "bg-danger text-white font-semibold hover:brightness-110 active:scale-[0.97] shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]",
  success: "bg-success text-success-ink font-semibold hover:brightness-110 active:scale-[0.97] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]",
};

export function buttonClass(variant: Variant = "secondary", size: "sm" | "md" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-[color,background-color,box-shadow,filter,transform] duration-200 ease-out disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap select-none",
    size === "sm" ? "h-8 px-3.5 text-[13px]" : "h-[38px] px-5 text-[14px]",
    variantClass[variant],
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "md" }) {
  return <button className={cx(buttonClass(variant, size), className)} {...props} />;
}

export function LinkButton({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: "sm" | "md" }) {
  return <Link className={cx(buttonClass(variant, size), className)} {...props} />;
}

// macOS text fields: a soft well, a gold focus ring.
const fieldClass =
  "w-full rounded-[12px] border border-white/[0.09] bg-white/[0.06] px-3.5 text-[14px] text-ink shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] placeholder:text-muted/70 transition-[border-color,box-shadow,background-color] duration-200 ease-out hover:border-white/20 hover:bg-white/[0.075] focus:border-accent/70 focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgb(var(--accent-rgb)/0.18)] focus:outline-none";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(fieldClass, className?.includes("h-") ? undefined : "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(fieldClass, "py-2 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(fieldClass, "h-10 pr-8", className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cx("frost rounded-[20px]", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15.5px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const toneClass: Record<Tone, string> = {
  neutral: "bg-white/8 text-ink-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]",
  accent: "bg-accent-soft text-accent shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.22)]",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        toneClass[tone],
      )}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <div className="kicker mb-1.5 [&_a:hover]:text-ink">{eyebrow}</div>}
          <h1 className="font-display text-[30px] leading-[1.1] font-bold tracking-[-0.026em] text-ink">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[20px] border border-dashed border-white/[0.12] bg-white/[0.025] px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-white/[0.09] font-semibold tracking-wide text-white/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.24)]"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
