"use client";

import { useState } from "react";
import {
  Bell,
  BrainCircuit,
  CalendarDays,
  Clapperboard,
  Coins,
  FileText,
  Film,
  FolderOpen,
  Handshake,
  House,
  KanbanSquare,
  Music,
  Palette,
  Settings,
  Users,
  WandSparkles,
} from "lucide-react";
import type { AppIconName } from "@/lib/apps";
import { cx } from "@/components/ui";

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
  shoots: CalendarDays,
  team: Users,
  bell: Bell,
  settings: Settings,
  videos: Clapperboard,
  brand: Palette,
  documents: FileText,
  video: Clapperboard,
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
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/icons/${icon === "video" ? "videos" : icon}.webp`}
        alt=""
        aria-hidden
        draggable={false}
        decoding="async"
        onError={() => setMissing(true)}
        className={cx("app-icon-3d shrink-0 object-contain select-none", fill && "h-full w-full", className)}
        style={box}
      />
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
