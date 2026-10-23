"use client";

import { useId, type ReactNode } from "react";
import type { AppIconName } from "@/lib/apps";
import { cx } from "@/components/ui";
import { useNow } from "@/components/use-now";

// The apps' icons, in Apple's manner: a rounded square in one soft gradient and one simple
// white symbol. Drawn as SVG on a 48 x 48 grid, so they stay sharp at every size. A symbol's
// cut-outs are painted with the tile's own gradient (`cut`), so they read as holes.

type Icon = { from: string; to: string; glyph: (cut: string) => ReactNode };

const W = "#ffffff";

// The tile: a square with Apple's "continuous" corners, where the curve eases into the sides
// instead of meeting them at once (radius 22.5%, smoothing 0.6).
const TILE = (() => {
  const s = 48;
  const r = 10.8;
  const smoothing = 0.6;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const p = (1 + smoothing) * r;
  const arc = 90 * (1 - smoothing);
  const arcLength = Math.sin(rad(arc / 2)) * r * Math.SQRT2;
  const beta = 45 * smoothing;
  const c = r * Math.tan(rad((90 - arc) / 4)) * Math.cos(rad(beta));
  const d = c * Math.tan(rad(beta));
  const b = (p - arcLength - c - d) / 3;
  const a = 2 * b;
  // The top right corner, from the top side to the right one; the other three are it, turned.
  const corner = [
    [s - p, 0],
    [s - p + a, 0],
    [s - p + a + b, 0],
    [s - p + a + b + c, d],
    [s - d, p - a - b - c],
    [s, p - a - b],
    [s, p - a],
    [s, p],
  ];
  const at = (x: number, y: number, turns: number): string => (turns ? at(s - y, x, turns - 1) : `${+x.toFixed(2)} ${+y.toFixed(2)}`);
  let path = "";
  for (let k = 0; k < 4; k++) {
    const q = corner.map(([x, y]) => at(x, y, k));
    path += `${k ? "L" : "M"}${q[0]}C${q[1]} ${q[2]} ${q[3]}A${r} ${r} 0 0 1 ${q[4]}C${q[5]} ${q[6]} ${q[7]}`;
  }
  return `${path}Z`;
})();

// A sparkle: four points, curved sides.
const sparkle = (x: number, y: number, r: number) =>
  `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;

// A gear: `teeth` teeth around a ring, the hole cut out (even-odd).
function gear(x: number, y: number, outer: number, inner: number, hole: number, teeth: number) {
  const step = (Math.PI * 2) / teeth;
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    const at = (r: number, t: number) => `${(x + r * Math.cos(a + t * step)).toFixed(2)} ${(y + r * Math.sin(a + t * step)).toFixed(2)}`;
    pts.push(at(inner, -0.5), at(inner, -0.3), at(outer, -0.18), at(outer, 0.18), at(inner, 0.3));
  }
  return `M${pts.join("L")}ZM${x + hole} ${y}A${hole} ${hole} 0 1 0 ${x - hole} ${y}A${hole} ${hole} 0 1 0 ${x + hole} ${y}Z`;
}

// A clapperboard: the board, and its arm lifted, striped.
const clapper = (cut: string) => (
  <>
    <rect x={9} y={23} width={30} height={15.5} rx={3.2} fill={W} />
    <g transform="rotate(-12 10 21)">
      <rect x={9} y={15} width={30} height={6} rx={1.6} fill={W} />
      <path d="M15.5 15h4.2l-3.2 6h-4.2ZM23.5 15h4.2l-3.2 6h-4.2ZM31.5 15h4.2l-3.2 6h-4.2Z" fill={cut} />
    </g>
  </>
);

const ICONS: Record<AppIconName, Icon> = {
  home: {
    from: "#2f2c27",
    to: "#0b0a09",
    glyph: () => <image href="/brand/magik-monogram.svg" x={9} y={9} width={30} height={30} />,
  },
  pipeline: {
    from: "#7a7cff",
    to: "#3b37d4",
    glyph: () => (
      <>
        {[10, 19.7, 29.4].map((x) => (
          <rect key={x} x={x} y={10} width={8.6} height={28} rx={2.6} fill={W} opacity={0.26} />
        ))}
        <rect x={11.2} y={11.2} width={6.2} height={9} rx={1.6} fill={W} />
        <rect x={11.2} y={21.8} width={6.2} height={6.5} rx={1.6} fill={W} />
        <rect x={20.9} y={11.2} width={6.2} height={6.5} rx={1.6} fill={W} />
        <rect x={20.9} y={19.3} width={6.2} height={9} rx={1.6} fill={W} />
        <rect x={20.9} y={29.9} width={6.2} height={6.9} rx={1.6} fill={W} />
        <rect x={30.6} y={11.2} width={6.2} height={11.5} rx={1.6} fill={W} />
      </>
    ),
  },
  clients: {
    from: "#5cc0ff",
    to: "#0a72e6",
    glyph: () => (
      <>
        <path d="M8.5 15.5a3 3 0 0 1 3-3h8.2a3 3 0 0 1 2.1.9l2.4 2.6H36.5a3 3 0 0 1 3 3V34a3 3 0 0 1-3 3h-25a3 3 0 0 1-3-3Z" fill={W} opacity={0.55} />
        <path d="M8.5 20.5a3 3 0 0 1 3-3h25a3 3 0 0 1 3 3V34a3 3 0 0 1-3 3h-25a3 3 0 0 1-3-3Z" fill={W} />
      </>
    ),
  },
  onboarding: {
    from: "#5fe07d",
    to: "#1f9e44",
    glyph: (cut) => (
      <>
        <rect x={12.5} y={11.5} width={23} height={27} rx={4} fill={W} />
        <rect x={18.5} y={8.5} width={11} height={6.5} rx={2.4} fill={W} stroke={cut} strokeWidth={1.6} />
        <path d="M18 25.5l4 4 8.5-9" fill="none" stroke={cut} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  sales: {
    from: "#3ddbb0",
    to: "#0b9a74",
    glyph: () => (
      <>
        <rect x={10.5} y={28} width={6.5} height={9.5} rx={1.8} fill={W} opacity={0.8} />
        <rect x={20.7} y={23} width={6.5} height={14.5} rx={1.8} fill={W} opacity={0.9} />
        <rect x={30.9} y={17.5} width={6.5} height={20} rx={1.8} fill={W} />
        <path d="M10.5 21.5l9-7.5 5.5 4 11-8.5" fill="none" stroke={W} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M31 9.5h5.5V15" fill="none" stroke={W} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  // White, as on the Mac; the date is drawn over it (CalendarFace).
  calendar: { from: "#ffffff", to: "#ececf0", glyph: () => null },
  agents: {
    from: "#c77dff",
    to: "#6a2fe0",
    glyph: () => (
      <>
        <path d={sparkle(20.5, 26, 11.5)} fill={W} />
        <path d={sparkle(33.5, 14.5, 5.5)} fill={W} opacity={0.9} />
        <path d={sparkle(34, 33, 3.6)} fill={W} opacity={0.8} />
      </>
    ),
  },
  library: {
    from: "#62dcfb",
    to: "#0c8ccc",
    glyph: (cut) => (
      <>
        <rect x={15} y={9.5} width={18} height={6} rx={2.4} fill={W} opacity={0.5} />
        <rect x={12.5} y={13.5} width={23} height={6} rx={2.6} fill={W} opacity={0.75} />
        <rect x={9.5} y={17.5} width={29} height={20.5} rx={3.8} fill={W} />
        <path d="M21 22.6 29.4 27.75 21 32.9Z" fill={cut} />
      </>
    ),
  },
  sound: {
    from: "#ff6f8d",
    to: "#ee1f4b",
    glyph: () => (
      <>
        <path d="M18.6 14.2 35.4 10.2v4.3L18.6 18.5Z" fill={W} />
        <rect x={16.8} y={14.6} width={2.9} height={17.5} rx={1.2} fill={W} />
        <rect x={32.6} y={10.6} width={2.9} height={17.5} rx={1.2} fill={W} />
        <ellipse cx={14.6} cy={32.6} rx={4.6} ry={3.6} transform="rotate(-18 14.6 32.6)" fill={W} />
        <ellipse cx={30.4} cy={28.6} rx={4.6} ry={3.6} transform="rotate(-18 30.4 28.6)" fill={W} />
      </>
    ),
  },
  prompts: {
    from: "#ffb446",
    to: "#f2680b",
    glyph: () => (
      <>
        <path d="M12 35C25 35 23 13 36 13" fill="none" stroke={W} strokeWidth={3.2} strokeLinecap="round" />
        <path d="M12 35h9.5M36 13h-9.5" fill="none" stroke={W} strokeWidth={1.5} strokeLinecap="round" opacity={0.75} />
        <circle cx={22.5} cy={35} r={1.9} fill={W} opacity={0.85} />
        <circle cx={25.5} cy={13} r={1.9} fill={W} opacity={0.85} />
        <rect x={9} y={32} width={6} height={6} rx={1.2} transform="rotate(45 12 35)" fill={W} />
        <rect x={33} y={10} width={6} height={6} rx={1.2} transform="rotate(45 36 13)" fill={W} />
      </>
    ),
  },
  shoots: {
    from: "#6c6c73",
    to: "#2a2a2e",
    glyph: () => (
      <>
        <rect x={8.5} y={15.5} width={22} height={17} rx={4.2} fill={W} />
        <path d="M31.5 21.6 39.5 17v14l-8-4.6Z" fill={W} />
        <circle cx={14.5} cy={21} r={2.2} fill="#ff3b30" />
      </>
    ),
  },
  team: {
    from: "#8fa3c4",
    to: "#4a5a78",
    glyph: () => (
      <>
        <circle cx={30.5} cy={17} r={4.6} fill={W} opacity={0.7} />
        <path d="M22 33.5a8.5 7.6 0 0 1 17 0v1.5H22Z" fill={W} opacity={0.7} />
        <circle cx={19} cy={18.5} r={5.6} fill={W} />
        <path d="M8.5 36a10.5 9 0 0 1 21 0v1.5h-21Z" fill={W} />
      </>
    ),
  },
  videos: { from: "#ff8a5c", to: "#ec3046", glyph: clapper },
  video: { from: "#ff8a5c", to: "#ec3046", glyph: clapper },
  brand: {
    from: "#ff82c8",
    to: "#a33ff0",
    glyph: () => (
      <>
        <path d="M24 9.5C15.4 9.5 9 15.8 9 23.6 9 31.4 15.2 38.5 22.8 38.5c2.6 0 3.2-2 2.2-3.8-.9-1.6-.2-3.7 2-3.7h4.6c4.3 0 8.4-3.1 8.4-8.4C40 15.4 32.6 9.5 24 9.5Z" fill={W} />
        <circle cx={16.6} cy={20} r={2.7} fill="#ff375f" />
        <circle cx={23.3} cy={15.4} r={2.7} fill="#ffcc00" />
        <circle cx={31} cy={17.2} r={2.7} fill="#0a84ff" />
        <circle cx={15.8} cy={27.6} r={2.7} fill="#30d158" />
      </>
    ),
  },
  website: {
    from: "#4fb0ff",
    to: "#1361ea",
    glyph: () => (
      <g fill="none" stroke={W} strokeWidth={2.6} strokeLinecap="round">
        <circle cx={24} cy={24} r={13.5} />
        <ellipse cx={24} cy={24} rx={5.8} ry={13.5} />
        <path d="M10.5 24h27M13 17.3h22M13 30.7h22" strokeWidth={2.1} />
      </g>
    ),
  },
  referral: {
    from: "#ffd84a",
    to: "#f59a0b",
    glyph: (cut) => (
      <>
        <rect x={11} y={24} width={26} height={14} rx={2.6} fill={W} />
        <rect x={9.5} y={17.5} width={29} height={7.5} rx={2.6} fill={W} />
        <rect x={22.4} y={17.5} width={3.2} height={20.5} fill={cut} />
        <path d="M24 17.5c-2.6-6.5-9.6-7.4-9.6-3.6 0 2.4 4.4 3.6 9.6 3.6Z" fill={W} />
        <path d="M24 17.5c2.6-6.5 9.6-7.4 9.6-3.6 0 2.4-4.4 3.6-9.6 3.6Z" fill={W} />
      </>
    ),
  },
  help: {
    from: "#64d2ff",
    to: "#1a86f5",
    glyph: (cut) => (
      <>
        <circle cx={24} cy={24} r={14} fill={W} />
        <path d="M19.6 19.6c0-2.9 2-4.8 4.6-4.8 2.8 0 4.7 1.8 4.7 4.2 0 2-1.2 3.1-2.7 4-1.3.8-1.9 1.5-1.9 3.1v.8" fill="none" stroke={cut} strokeWidth={3.1} strokeLinecap="round" />
        <circle cx={24.3} cy={32.3} r={2} fill={cut} />
      </>
    ),
  },
  settings: {
    from: "#a3a3a9",
    to: "#55555b",
    glyph: () => <path d={gear(24, 24, 15, 11.6, 5, 10)} fill={W} fillRule="evenodd" />,
  },
  bell: {
    from: "#ff665d",
    to: "#e1231b",
    glyph: () => (
      <>
        <path d="M24 9.5c-5.4 0-8.7 4-8.7 9.4v5.8L12 30.2h24l-3.3-5.5v-5.8c0-5.4-3.3-9.4-8.7-9.4Z" fill={W} />
        <circle cx={24} cy={33.6} r={3} fill={W} />
      </>
    ),
  },
  documents: {
    from: "#7cc8ff",
    to: "#2f6cf0",
    glyph: (cut) => (
      <>
        <path d="M15.5 9h11.7L35 16.8V36.5a2.5 2.5 0 0 1-2.5 2.5h-17a2.5 2.5 0 0 1-2.5-2.5v-25A2.5 2.5 0 0 1 15.5 9Z" fill={W} />
        <path d="M27.2 9v5.8a2 2 0 0 0 2 2H35" fill="none" stroke={cut} strokeWidth={1.2} strokeLinejoin="round" />
        <rect x={17} y={22} width={13.5} height={2.3} rx={1.15} fill={cut} />
        <rect x={17} y={27} width={13.5} height={2.3} rx={1.15} fill={cut} />
        <rect x={17} y={32} width={9} height={2.3} rx={1.15} fill={cut} />
      </>
    ),
  },
  finance: {
    from: "#ffd84a",
    to: "#d99a0b",
    glyph: (cut) => (
      <>
        <circle cx={24} cy={24} r={13.5} fill={W} />
        <path d="M28.6 18.6c-.9-1.5-2.6-2.4-4.6-2.4-2.6 0-4.4 1.4-4.4 3.4 0 4.6 9.2 2.5 9.2 7.6 0 2-1.9 3.6-4.8 3.6-2.2 0-4-1-4.9-2.6M24 13.5v21" fill="none" stroke={cut} strokeWidth={2.6} strokeLinecap="round" />
      </>
    ),
  },
};

export function AppIcon({
  icon,
  size = 56,
  className,
}: {
  icon: AppIconName;
  // Pixels, or "fill" to fill the parent (the Dock sizes its icons itself).
  size?: number | "fill";
  className?: string;
}) {
  const { from, to, glyph } = ICONS[icon];
  const tint = `tile${useId().replace(/[^\w-]/g, "")}`;
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden
      className={cx("mac-icon", className)}
      style={size === "fill" ? { width: "100%", height: "100%" } : { width: size, height: size }}
    >
      <defs>
        <linearGradient id={tint} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={48}>
          <stop stopColor={from} />
          <stop offset={1} stopColor={to} />
        </linearGradient>
      </defs>
      <path d={TILE} fill={`url(#${tint})`} />
      {icon === "calendar" ? <CalendarFace /> : glyph(`url(#${tint})`)}
      <path d={TILE} fill="none" stroke={W} strokeOpacity={0.16} strokeWidth={0.8} />
    </svg>
  );
}

// Today, as on the Mac's Calendar icon: the weekday in red, the date big. Blank until the page
// knows the viewer's own day.
function CalendarFace() {
  const now = useNow(60_000);
  if (!now) return null;
  return (
    <g style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif" }}>
      <text x={24} y={15.5} textAnchor="middle" fontSize={8.2} fontWeight={600} letterSpacing={0.4} fill="#ff3b30">
        {now.toLocaleDateString(undefined, { weekday: "short" }).replace(/\.$/, "").toUpperCase()}
      </text>
      <text x={24} y={38.5} textAnchor="middle" fontSize={23} fontWeight={400} fill="#1c1c1e">
        {now.getDate()}
      </text>
    </g>
  );
}
