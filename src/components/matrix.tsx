"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/components/ui";

// Vertical "matrix" glyph streams in Magik Gold.
//  - tunnel: a 3D corridor of falling columns rushing toward the viewer (login)
//  - rain:   flat vertical rain for narrow surfaces (sidebar)
// Glyphs are pre-rendered into a sprite atlas and drawn with drawImage, capped
// at 30 fps, paused in background tabs, and frozen for reduced-motion users.

const GLYPHS = "0123456789MAGIKOS0123456789";
const GOLD = "246,212,58";
const CELL = 48;

type Atlas = { canvas: HTMLCanvasElement; count: number };

function buildAtlas(): Atlas {
  const chars = [...new Set(GLYPHS)];
  const canvas = document.createElement("canvas");
  canvas.width = CELL * chars.length;
  canvas.height = CELL * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `500 ${CELL * 0.78}px ui-monospace, "Geist Mono", Menlo, monospace`;
  chars.forEach((ch, i) => {
    // Row 0: bright head glyph (white-gold). Row 1: trail glyph (gold).
    ctx.fillStyle = "rgb(255,246,200)";
    ctx.fillText(ch, i * CELL + CELL / 2, CELL / 2);
    ctx.fillStyle = `rgb(${GOLD})`;
    ctx.fillText(ch, i * CELL + CELL / 2, CELL * 1.5);
  });
  return { canvas, count: chars.length };
}

const rand = (n: number) => Math.floor(Math.random() * n);

type Column = { glyphs: number[]; head: number; speed: number; trail: number };

function makeColumn(length: number, atlas: Atlas): Column {
  return {
    glyphs: Array.from({ length }, () => rand(atlas.count)),
    head: Math.random() * length * 2 - length,
    speed: 0.25 + Math.random() * 0.55,
    trail: 6 + rand(14),
  };
}

function stepColumn(c: Column, length: number, atlas: Atlas, dt: number) {
  c.head += c.speed * dt * 30;
  if (c.head - c.trail > length) {
    c.head = -rand(length);
    c.speed = 0.25 + Math.random() * 0.55;
    c.trail = 6 + rand(14);
  }
  if (Math.random() < 0.08) c.glyphs[rand(length)] = rand(atlas.count);
}

// Brightness of glyph i in a column: bright head, fading trail, faint rest.
function glow(c: Column, i: number) {
  const d = c.head - i;
  if (d < 0 || d > c.trail) return { a: 0.14, head: false };
  return { a: 0.12 + 0.88 * (1 - d / c.trail), head: d < 1 };
}

export function Matrix({ variant = "tunnel", className }: { variant?: "tunnel" | "rain"; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const atlas = buildAtlas();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let W = 0;
    let H = 0;

    // ---- tunnel world
    let WALL_ROWS = 36; // glyphs per wall column, from above the frame down to the floor
    let WALL_TOP = -1.15;
    let WALL_BOTTOM = 0.74;
    let Y_FLOOR = 0.8;
    let WALL_DEPTH = 56; // columns per wall along z (fewer on small screens)
    let FLOOR_LANES = 25;
    const FLOOR_LEN = 70;
    const Z_NEAR = 0.9;
    const Z_FAR = 19;
    let walls: Column[] = [];
    let floor: { x: number; offset: number; speed: number; glyphs: number[] }[] = [];

    // ---- rain world
    let rain: Column[] = [];
    let rainRows = 0;
    // The corridor needs width; on portrait screens a tunnel falls back to full-screen rain.
    let mode: "tunnel" | "rain" = variant;
    let RAIN_SIZE = 13;
    let rainAlpha = 0.55;

    const setup = () => {
      const rect = canvas.getBoundingClientRect();
      W = Math.max(1, rect.width);
      H = Math.max(1, rect.height);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mode = variant === "tunnel" && H > W * 1.1 ? "rain" : variant;
      RAIN_SIZE = variant === "rain" ? 13 : 17;
      rainAlpha = variant === "rain" ? 0.55 : 0.75;
      if (mode === "tunnel") {
        const small = W < 700;
        WALL_DEPTH = small ? 30 : 56;
        FLOOR_LANES = small ? 13 : 25;
        // Portrait screens: stretch the corridor vertically so it fills the height.
        const stretch = H > W ? (H / W) * 0.9 : 1;
        WALL_TOP = -1.15 * stretch;
        WALL_BOTTOM = 0.74 * stretch;
        Y_FLOOR = 0.8 * stretch;
        WALL_ROWS = Math.round(36 * stretch);
        walls = Array.from({ length: WALL_DEPTH * 2 }, () => makeColumn(WALL_ROWS, atlas));
        floor = Array.from({ length: FLOOR_LANES }, (_, i) => ({
          x: -0.95 + (1.9 * i) / (FLOOR_LANES - 1),
          offset: Math.random() * 10,
          speed: 0.6 + Math.random() * 0.9,
          glyphs: Array.from({ length: FLOOR_LEN }, () => rand(atlas.count)),
        }));
      } else {
        rainRows = Math.ceil(H / RAIN_SIZE) + 2;
        rain = Array.from({ length: Math.ceil(W / RAIN_SIZE) }, () => makeColumn(rainRows, atlas));
      }
    };

    const sprite = (g: number, head: boolean, x: number, y: number, size: number, alpha: number) => {
      if (alpha <= 0.01) return;
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.drawImage(atlas.canvas, g * CELL, head ? 0 : CELL, CELL, CELL, x - size / 2, y - size / 2, size, size);
    };

    const drawTunnel = (dt: number, t: number) => {
      const cx0 = W / 2;
      const cy0 = H * 0.46;
      // Landscape: classic corridor. Portrait: narrower so both walls stay on screen.
      const f = H > W ? W * 0.44 : Math.min(W, H) * 0.95;
      const fade = (z: number) => Math.max(0, 1 - (z - Z_NEAR) / (Z_FAR - Z_NEAR)) ** 1.35;

      // Walls: vertical columns at x = ±1, spread along z.
      for (let side = 0; side < 2; side++) {
        const x = side === 0 ? -1 : 1;
        for (let k = 0; k < WALL_DEPTH; k++) {
          const col = walls[side * WALL_DEPTH + k];
          stepColumn(col, WALL_ROWS, atlas, dt);
          const z = Z_NEAR + 0.25 + k * ((Z_FAR - Z_NEAR) / WALL_DEPTH);
          const depth = fade(z);
          const sx = cx0 + (x * f) / z;
          const size = (0.052 * f) / z;
          if (size < 2.5) continue;
          for (let i = 0; i < WALL_ROWS; i++) {
            const y = WALL_TOP + ((WALL_BOTTOM - WALL_TOP) * i) / (WALL_ROWS - 1);
            const { a, head } = glow(col, i);
            sprite(col.glyphs[i], head, sx, cy0 + (y * f) / z, size, a * depth * 0.95);
          }
        }
      }

      // Floor: streams flowing toward the viewer.
      const yFloor = Y_FLOOR;
      for (const lane of floor) {
        lane.offset = (lane.offset + lane.speed * dt) % 1000;
        for (let j = 0; j < FLOOR_LEN; j++) {
          let z = Z_FAR - (((j * 0.32 + lane.offset) % (Z_FAR - Z_NEAR)) + 0);
          if (z < Z_NEAR) z += Z_FAR - Z_NEAR;
          const size = (0.045 * f) / z;
          if (size < 2) continue;
          const sx = cx0 + (lane.x * f) / z;
          const sy = cy0 + (yFloor * f) / z;
          if (sy > H + size) continue;
          const pulse = 0.5 + 0.5 * Math.sin(t * 1.7 + j * 0.9 + lane.x * 7);
          sprite(lane.glyphs[j], pulse > 0.97, sx, sy, size, (0.08 + 0.3 * pulse ** 6) * fade(z));
        }
      }
    };

    const drawRain = (dt: number) => {
      rain.forEach((col, c) => {
        stepColumn(col, rainRows, atlas, dt * 0.6);
        for (let i = 0; i < rainRows; i++) {
          const { a, head } = glow(col, i);
          sprite(col.glyphs[i], head, c * RAIN_SIZE + RAIN_SIZE / 2, i * RAIN_SIZE, RAIN_SIZE, a * rainAlpha);
        }
      });
    };

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt;
      if (acc < 1 / 30) return; // cap at ~30 fps
      const step = acc;
      acc = 0;
      if (document.hidden) return;
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);
      if (mode === "tunnel") drawTunnel(step, now / 1000);
      else drawRain(step);
    };

    // Reduced motion: one still frame, taken mid-animation, redrawn on resize.
    const still = () => {
      for (let i = 0; i < 40; i++) {
        if (mode === "tunnel") walls.forEach((c) => stepColumn(c, WALL_ROWS, atlas, 0.1));
        else rain.forEach((c) => stepColumn(c, rainRows, atlas, 0.1));
      }
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);
      if (mode === "tunnel") drawTunnel(0, 0);
      else drawRain(0);
    };

    setup();
    const ro = new ResizeObserver(() => {
      setup();
      if (reduced) still();
    });
    ro.observe(canvas);
    if (reduced) still();
    else raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [variant]);

  return <canvas ref={ref} aria-hidden className={cx("pointer-events-none block h-full w-full", className)} />;
}
