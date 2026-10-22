"use client";

import { useState } from "react";
import {
  Bell,
  BrainCircuit,
  CalendarDays,
  ChartNoAxesCombined,
  Clapperboard,
  Coins,
  FileText,
  Film,
  FolderOpen,
  Gift,
  Globe,
  Handshake,
  House,
  KanbanSquare,
  LifeBuoy,
  Music,
  Palette,
  Settings,
  Users,
  Video,
  WandSparkles,
} from "lucide-react";
import type { AppIconName } from "@/lib/apps";
import { cx } from "@/components/ui";
import { useNow } from "@/components/use-now";

const GLYPHS = {
  home: House,
  finance: Coins,
  pipeline: KanbanSquare,
  clients: FolderOpen,
  onboarding: Handshake,
  agents: BrainCircuit,
  library: Film,
  sound: Music,
  prompts: WandSparkles,
  shoots: Video,
  team: Users,
  bell: Bell,
  settings: Settings,
  videos: Clapperboard,
  brand: Palette,
  documents: FileText,
  video: Clapperboard,
  calendar: CalendarDays,
  website: Globe,
  sales: ChartNoAxesCombined,
  referral: Gift,
  help: LifeBuoy,
} satisfies Record<AppIconName, unknown>;

// An app's icon: its 3D render (public/icons/<icon>.webp), or a gradient squircle with the
// glyph when the render is missing.
export function AppIcon({
  icon,
  tint,
  glyph = "#ffffff",
  size = 56,
  className,
}: {
  icon: AppIconName;
  tint: readonly [string, string];
  glyph?: string;
  // Pixels, or "fill" to fill the parent (the Dock sizes its icons itself).
  size?: number | "fill";
  className?: string;
}) {
  const [missing, setMissing] = useState(false);
  const fill = size === "fill";
  const box = fill ? undefined : { width: size, height: size };

  if (!missing) {
    const img = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/icons/${icon === "video" ? "videos" : icon}.webp`}
        alt=""
        aria-hidden
        draggable={false}
        decoding="async"
        onError={() => setMissing(true)}
        className={cx("app-icon-3d shrink-0 object-contain select-none", (fill || icon === "calendar") && "h-full w-full", icon !== "calendar" && className)}
        style={icon === "calendar" ? undefined : box}
      />
    );
    if (icon !== "calendar") return img;
    return (
      <span aria-hidden className={cx("relative inline-block shrink-0 [container-type:size]", fill && "h-full w-full", className)} style={box}>
        {img}
        <CalendarFace />
      </span>
    );
  }

  const Glyph = GLYPHS[icon];
  return (
    <span
      aria-hidden
      className={cx("app-icon shrink-0", fill && "h-full w-full", className)}
      style={{ ...box, background: `linear-gradient(180deg, ${tint[0]}, ${tint[1]})` }}
    >
      <Glyph size={fill ? "50%" : Math.round(size * 0.5)} strokeWidth={1.9} color={glyph} />
    </span>
  );
}

// Today on the Calendar icon, as on a Mac: the weekday in the band, the date on the page
// (the render leaves both blank; the rectangles are the icon's text-safe areas). Only once the
// page knows the viewer's own day.
function CalendarFace() {
  const now = useNow(60_000);
  if (!now) return null;
  return (
    <>
      <span
        className="absolute flex items-center justify-center leading-none font-semibold tracking-[0.02em] text-[#f6d43a] uppercase"
        style={{ left: "18.2%", top: "19.8%", width: "62.8%", height: "17.1%", fontSize: "11cqh" }}
      >
        {now.toLocaleDateString(undefined, { weekday: "short" }).replace(/\.$/, "")}
      </span>
      <span
        className="absolute flex items-center justify-center leading-none font-semibold tracking-[-0.04em] text-[#17130e] tabular-nums"
        style={{ left: "21.4%", top: "41.8%", width: "56.8%", height: "44.1%", fontSize: "36cqh" }}
      >
        {now.getDate()}
      </span>
    </>
  );
}
