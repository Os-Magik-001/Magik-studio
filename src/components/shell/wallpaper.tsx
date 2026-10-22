"use client";

import { useEffect, useState } from "react";
import { Matrix } from "@/components/matrix";
import { LOOK_EVENT, applyLook, readLocalLook } from "@/components/shell/look";

// The desktop picture. The root layout's script applies the look before the first paint, so the
// right picture shows at once; the CSS (.wallpaper) draws it from the variables it set. The live
// Matrix is drawn here, and "Dynamic" changes picture with the hour.
export function Wallpaper() {
  const [live, setLive] = useState(false);
  useEffect(() => {
    const sync = () => setLive(document.documentElement.dataset.wallpaper === "matrix");
    sync();
    window.addEventListener(LOOK_EVENT, sync);
    // Dynamic: look again every ten minutes.
    const id = setInterval(() => {
      const look = readLocalLook();
      if (look?.wallpaper === "dynamic") applyLook(look);
    }, 10 * 60_000);
    return () => {
      window.removeEventListener(LOOK_EVENT, sync);
      clearInterval(id);
    };
  }, []);
  return (
    <div aria-hidden className="wallpaper pointer-events-none fixed inset-0 -z-10">
      {live && (
        <div className="absolute inset-0 opacity-60">
          <Matrix variant="field" />
        </div>
      )}
    </div>
  );
}
