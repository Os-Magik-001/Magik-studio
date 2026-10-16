import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";

const variantClass: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:opacity-90 border border-transparent",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 border border-transparent",
  danger: "bg-danger text-white hover:opacity-90 border border-transparent",
  success: "bg-success text-white hover:opacity-90 border border-transparent",
};

export function buttonClass(variant: Variant = "secondary", size: "sm" | "md" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
    size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3.5 text-sm",
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

const fieldClass =
  "w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(fieldClass, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(fieldClass, "py-2 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(fieldClass, "h-9 pr-8", className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cx("rounded-xl border border-line bg-surface", className)}
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
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  accent: "bg-accent-soft text-accent",
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
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[13px] text-muted">{eyebrow}</div>}
        <h1 className="font-serif text-3xl leading-tight text-ink">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
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
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-medium text-ink-2"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
