import { frameOf, type Area, type Win } from "@/components/desktop/windows";

// Mission Control: every open window, side by side and scaled down, each keeping its shape.
// Returns, per window, how far to move its centre and how much to scale it.
export type MissionSpot = { dx: number; dy: number; scale: number };

export function missionLayout(wins: Win[], area: Area): Map<string, MissionSpot> {
  const out = new Map<string, MissionSpot>();
  const list = [...wins].sort((a, b) => a.openedAt - b.openedAt || a.z - b.z);
  const n = list.length;
  if (!n) return out;
  const pad = { x: 56, top: 40, bottom: 56 };
  const W = area.w - pad.x * 2;
  const H = area.bottom - area.top - pad.top - pad.bottom;
  const frames = list.map((w) => frameOf(w, area));

  // The grid that lets the windows be biggest.
  let best = { cols: 1, rows: n, scale: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cw = W / cols;
    const ch = H / rows;
    const scale = Math.min(0.72, ...frames.map((f) => Math.min((cw - 36) / f.w, (ch - 44) / f.h)));
    if (scale > best.scale) best = { cols, rows, scale };
  }

  const cw = W / best.cols;
  const ch = H / best.rows;
  list.forEach((w, i) => {
    const f = frames[i];
    const row = Math.floor(i / best.cols);
    const inRow = Math.min(best.cols, n - row * best.cols);
    // Centre a short last row.
    const offset = ((best.cols - inRow) * cw) / 2;
    const col = i % best.cols;
    const cx = pad.x + offset + col * cw + cw / 2;
    const cy = area.top + pad.top + row * ch + ch / 2 - 10;
    out.set(w.id, { dx: Math.round(cx - (f.x + f.w / 2)), dy: Math.round(cy - (f.y + f.h / 2)), scale: Math.max(0.12, best.scale) });
  });
  return out;
}
