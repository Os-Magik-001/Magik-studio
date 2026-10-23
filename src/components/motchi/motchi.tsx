"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Role } from "@/lib/auth";
import { useDesktop } from "@/components/desktop/context";
import type { MotchiMove, MotchiScene } from "./scene";
import { MotchiChat, MotchiFace } from "./chat";

// Motchi, the assistant of Magik OS, in the bottom-right corner: he peeks over the screen's edge,
// follows the pointer with his eyes, and now and then comes up to check on things (a hop, a look
// around, a tip). Click him and he asks how he can help. His 3D scene (./scene) loads on its own,
// after the desktop; without WebGL he's drawn flat.

type Mode = "rest" | "visit" | "chat";

const TIPS: Record<"all" | Role, string[]> = {
  all: [
    "⌘K opens Search: any app, client, video or event.",
    "Drag a window to the left or right edge to fill half the screen.",
    "F3 shows every open window side by side.",
    "Settings, Appearance has more wallpapers, including one that follows the time of day.",
    "⌘-click a link to open it in a new window.",
  ],
  client: ["In Your videos, comment right on the moment you want changed.", "Posting dates are in gold in your Calendar.", "Share your referral link from Referrals and earn credits."],
  admin: ["Right-click an app in the Dock to see all its windows.", "Option-W closes the window in front, Option-M puts it in the Dock."],
  editor: ["Right-click an app in the Dock to see all its windows.", "Option-W closes the window in front, Option-M puts it in the Dock."],
  videographer: ["Your shoots are orange in the Calendar."],
  seller: ["Onboarding, then New client: details, pack, invoice, contract, then send the link."],
};

const ASK: Record<Role, string[]> = {
  client: ["Where are my videos?", "How do I ask for a change?", "When will my videos be posted?"],
  admin: ["How do I start a new client?", "How do I pause someone's account?", "How do windows work?"],
  editor: ["Where do I start my day?", "How do I set a posting date?", "How do windows work?"],
  videographer: ["Where are my shoots?", "How do I send the footage?", "How do windows work?"],
  seller: ["How do I start a new client?", "How do referrals work?", "How do windows work?"],
};

const QUIET_KEY = "magik.motchi.quiet";
const GREETED_KEY = "magik.motchi.greeted";
const today = () => new Date().toDateString();
const read = (store: () => Storage, key: string) => {
  try {
    return store().getItem(key);
  } catch {
    return null;
  }
};
const write = (store: () => Storage, key: string, value: string) => {
  try {
    store().setItem(key, value);
  } catch {}
};

export function Motchi() {
  const { viewer } = useDesktop();
  const firstName = viewer.name.includes("@") ? null : viewer.name.split(" ")[0];
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<MotchiScene | null>(null);
  const [flat, setFlat] = useState(false);
  const [mode, setMode] = useState<Mode>("rest");
  const [hover, setHover] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const modeRef = useRef(mode);
  const lastActive = useRef(0);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const play = useCallback((move: MotchiMove) => scene.current?.play(move), []);

  // The 3D scene, once the desktop has painted.
  useEffect(() => {
    let gone = false;
    const el = canvas.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = window.setTimeout(() => {
      import("./scene")
        .then(({ createMotchi }) => {
          if (gone || !el) return;
          scene.current = createMotchi(el, { reducedMotion: reduced });
        })
        .catch(() => !gone && setFlat(true));
    }, 600);
    const onResize = () => el && scene.current?.resize(el.clientWidth, el.clientHeight);
    window.addEventListener("resize", onResize);
    return () => {
      gone = true;
      window.clearTimeout(start);
      window.removeEventListener("resize", onResize);
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  // A visit: he comes up, hops, looks around and says one thing, then goes back down.
  const visit = useCallback(
    (say: string) => {
      if (modeRef.current !== "rest") return;
      setMode("visit");
      setBubble(say);
      window.setTimeout(() => play("hop"), 450);
      window.setTimeout(() => play("look"), 1300);
      window.setTimeout(() => {
        if (modeRef.current !== "visit") return;
        setBubble(null);
        setMode("rest");
      }, 7500);
    },
    [play],
  );

  // He says hello once per visit to the app, then checks in every few minutes while someone is
  // working, unless he was asked to be quiet today.
  useEffect(() => {
    const onActive = () => {
      lastActive.current = Date.now();
    };
    window.addEventListener("pointermove", onActive, { passive: true });
    window.addEventListener("keydown", onActive);
    const tips = [...TIPS.all, ...TIPS[viewer.role]];
    const quiet = () => read(() => localStorage, QUIET_KEY) === today();
    let timer = 0;
    const next = () => {
      timer = window.setTimeout(() => {
        const busy = Date.now() - lastActive.current > 90_000 || document.visibilityState !== "visible";
        if (!busy && !quiet()) visit(tips[Math.floor(Math.random() * tips.length)]);
        next();
      }, (4 + Math.random() * 3) * 60_000);
    };
    const hello = window.setTimeout(() => {
      if (read(() => sessionStorage, GREETED_KEY) || quiet()) return;
      write(() => sessionStorage, GREETED_KEY, "1");
      visit(`Hi${firstName ? ` ${firstName}` : ""}! I'm Motchi. Click me if you need a hand.`);
    }, 4000);
    next();
    return () => {
      window.removeEventListener("pointermove", onActive);
      window.removeEventListener("keydown", onActive);
      window.clearTimeout(timer);
      window.clearTimeout(hello);
    };
  }, [firstName, viewer.role, visit]);

  const openChat = () => {
    setBubble(null);
    setMode("chat");
    play("happy");
  };
  const closeChat = () => {
    setMode("rest");
    scene.current?.think(false);
  };

  const up = mode !== "rest";
  const lift = up ? "0%" : hover ? "16%" : "27%";
  return (
    <>
      <div
        className="motchi pointer-events-none fixed right-1 bottom-0 h-[140px] w-[124px] sm:right-3 sm:h-[156px] sm:w-[138px]"
        style={{ zIndex: up ? 8955 : 8850, transform: `translateY(${lift})` }}
      >
        <canvas ref={canvas} className={flat ? "hidden" : "h-full w-full"} aria-hidden />
        {flat && (
          <span className="flex h-full w-full items-start justify-center pt-4">
            <MotchiFace size={96} />
          </span>
        )}
        <button
          type="button"
          onClick={mode === "chat" ? closeChat : openChat}
          onPointerEnter={() => {
            setHover(true);
            if (mode === "rest") play("wiggle");
          }}
          onPointerLeave={() => setHover(false)}
          aria-label={mode === "chat" ? "Close Motchi" : "Motchi, the Magik OS assistant: ask a question"}
          aria-expanded={mode === "chat"}
          className="pointer-events-auto absolute top-[14%] left-[16%] h-[62%] w-[68%] cursor-pointer rounded-[45%] focus-visible:outline-2 focus-visible:outline-accent"
        />
      </div>
      {bubble && mode === "visit" && (
        <button
          type="button"
          onClick={openChat}
          className="glass-pop motchi-bubble fixed right-[118px] bottom-[96px] z-[8956] max-w-[240px] rounded-[16px] rounded-br-[6px] px-3.5 py-2.5 text-left text-[13px] leading-snug text-ink sm:right-[136px] sm:bottom-[108px]"
        >
          {bubble}
        </button>
      )}
      {mode === "chat" && (
        <MotchiChat
          firstName={firstName}
          suggestions={ASK[viewer.role]}
          onClose={closeChat}
          onThinking={(on) => scene.current?.think(on)}
          onQuiet={() => {
            write(() => localStorage, QUIET_KEY, today());
            closeChat();
          }}
        />
      )}
    </>
  );
}
