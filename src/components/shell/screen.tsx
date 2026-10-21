"use client";

import { ViewTransition, useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, Maximize2, Minimize2, Minus, RotateCw, X } from "lucide-react";
import { appForPath } from "@/lib/apps";
import { cx } from "@/components/ui";
import { AppIcon } from "@/components/shell/app-icon";
import { useShell } from "@/components/shell/context";

// An app on screen: one big glass window between the menu bar and the bottom of the screen,
// the Dock floating over its lower edge. Red and yellow go back to Home; green fills the
// whole screen. It zooms up from the Dock when an app opens, and its content crossfades when
// another app takes its place (the animations are in globals.css, "Screens").
export function Screen({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { viewer, full, setFull } = useShell();
  const app = appForPath(pathname, viewer.role);
  const scroller = useRef<HTMLDivElement>(null);
  const appRoot = app ? app.href : "/";
  const inside = pathname !== appRoot;

  // Each page starts at the top.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <ViewTransition enter="screen-open" exit="screen-close" default="none">
      <div className={cx("screen-frame fixed z-10", full ? "inset-x-0 top-[46px] bottom-0" : "inset-x-0 top-[46px] bottom-0 sm:inset-x-5 sm:top-[54px] sm:bottom-3")}>
        <section
          aria-label={app?.name ?? "App"}
          className={cx(
            "material-window flex h-full flex-col overflow-hidden",
            full ? "rounded-none" : "rounded-t-[22px] sm:rounded-[26px]",
            "shadow-[0_0_0_0.5px_rgba(255,255,255,0.2)_inset,0_0_0_1px_rgba(0,0,0,0.6),0_40px_100px_-20px_rgba(0,0,0,0.8)]",
          )}
        >
          <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-white/[0.07] bg-white/[0.03] px-4 sm:px-5">
            <div className="traffic-group hidden items-center gap-2 sm:flex">
              <Link href="/" aria-label={`Close ${app?.name ?? "app"}`} className="traffic bg-[#ff5f57]">
                <X size={8} strokeWidth={3} aria-hidden />
              </Link>
              <Link href="/" aria-label="Back to Home" className="traffic bg-[#febc2e]">
                <Minus size={8} strokeWidth={3} aria-hidden />
              </Link>
              <button type="button" aria-label={full ? "Leave full screen" : "Full screen"} onClick={() => setFull(!full)} className="traffic bg-[#28c840]">
                <Maximize2 size={7} strokeWidth={3} aria-hidden />
              </button>
            </div>
            {inside ? (
              <Link href={appRoot} aria-label={`Back to ${app?.name ?? "the app"}`} className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-white/10 sm:ml-1">
                <ChevronLeft size={19} aria-hidden />
              </Link>
            ) : (
              <Link href="/" aria-label="Home" className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-white/10 sm:hidden">
                <ChevronLeft size={19} aria-hidden />
              </Link>
            )}
            {app && (
              <Link href={appRoot} className="flex min-w-0 items-center gap-2.5 rounded-lg pr-2">
                <AppIcon icon={app.icon} tint={app.tint} glyph={app.glyph} size={28} />
                <span className="truncate text-[14.5px] font-semibold text-ink">{app.name}</span>
              </Link>
            )}
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                aria-label="Reload"
                onClick={() => router.refresh()}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-ink"
              >
                <RotateCw size={15} aria-hidden />
              </button>
              <button
                type="button"
                aria-label={full ? "Leave full screen" : "Full screen"}
                onClick={() => setFull(!full)}
                className="hidden h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-ink sm:flex"
              >
                {full ? <Minimize2 size={15} aria-hidden /> : <Maximize2 size={15} aria-hidden />}
              </button>
            </div>
          </header>
          <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <ViewTransition key={app?.id ?? "app"} enter="app-in" exit="app-out" default="none">
              <div className="mx-auto w-full max-w-[1440px] px-4 pt-6 pb-[150px] sm:px-10 sm:pt-8">{children}</div>
            </ViewTransition>
          </div>
        </section>
      </div>
    </ViewTransition>
  );
}
