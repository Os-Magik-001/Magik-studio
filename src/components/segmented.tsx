import Link from "next/link";
import { cx } from "@/components/ui";

// A segmented control (macOS / iOS) whose segments are links: tabs inside an app.
export function SegmentedNav({ items, active }: { items: { href: string; label: string; key: string; count?: number }[]; active: string }) {
  return (
    <nav className="inline-flex rounded-full bg-white/[0.07] p-[3px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === active ? "page" : undefined}
          className={cx(
            "flex h-[30px] items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-colors",
            item.key === active ? "bg-white/[0.16] text-ink shadow-[0_1px_3px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.12)]" : "text-muted hover:text-ink",
          )}
        >
          {item.label}
          {item.count !== undefined && <span className="text-[11.5px] text-muted tabular-nums">{item.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
