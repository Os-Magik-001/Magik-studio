"use client";

import { Mrs_Saint_Delafield } from "next/font/google";
import { useNow } from "@/components/use-now";

const script = Mrs_Saint_Delafield({ weight: "400", subsets: ["latin"] });

// Home's greeting: the time of day, the person's name set big, what Magik is for them.
export function Greeting({ name, line, signature }: { name: string; line: [string, string]; signature: string }) {
  const now = useNow(60_000);
  const hour = now?.getHours() ?? 12;
  const part = hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = name.split(/\s+/)[0];
  return (
    <section className="on-wallpaper relative animate-rise-in select-none">
      <p className="inline-flex rounded-full border border-accent/45 bg-black/35 px-3.5 py-1 text-[14px] font-medium text-accent backdrop-blur-md">
        {now ? `${part},` : " "}
      </p>
      <h1 className="mt-3 font-serif text-[64px] leading-[0.95] font-semibold tracking-[-0.01em] text-white sm:text-[96px] xl:text-[118px]">
        {first}
        <span className="text-accent">.</span>
      </h1>
      <p className="mt-3 text-[17px] text-white/90 sm:text-[20px]">
        {line[0]} <span className="text-white/60">{line[1]}</span>
      </p>
      <p className={`${script.className} mt-1 -rotate-3 text-[34px] leading-none text-white/75 sm:text-[42px]`}>{signature}</p>
    </section>
  );
}
