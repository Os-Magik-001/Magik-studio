"use client";

import {
  Bell,
  BrainCircuit,
  CalendarDays,
  Clapperboard,
  FileText,
  Film,
  FolderOpen,
  Handshake,
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
  // Pixels, or "fill" to fill the parent (the dock sizes its icons itself).
  size?: number | "fill";
  className?: string;
}) {
  const Glyph = GLYPHS[icon];
  const fill = size === "fill";
  return (
    <span
      aria-hidden
      className={cx("app-icon shrink-0", fill && "h-full w-full", className)}
      style={{
        ...(fill ? {} : { width: size, height: size }),
        background: `linear-gradient(180deg, ${tint[0]}, ${tint[1]})`,
      }}
    >
      <Glyph size={fill ? "50%" : Math.round(size * 0.5)} strokeWidth={1.9} color={glyph} />
    </span>
  );
}
