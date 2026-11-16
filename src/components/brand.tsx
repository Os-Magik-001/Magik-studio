"use client";

import { createContext, useContext, type ReactNode } from "react";
import { MAGIK, brandInitials, type Brand } from "@/lib/brand";

// The studio's brand for client components. The root layout provides the one resolved for the
// request (@/lib/brand-server).
const BrandContext = createContext<Brand>(MAGIK);

export function BrandProvider({ brand, children }: { brand: Brand; children: ReactNode }) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

export const useBrand = () => useContext(BrandContext);

// The studio's mark: its logo file, or its initials in the accent colour until it has one.
export function BrandMark({ brand: given, className }: { brand?: Brand; className?: string }) {
  const mine = useBrand();
  const brand = given ?? mine;
  if (brand.logos.mark) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={brand.logos.mark} alt="" className={className} />;
  }
  return (
    <svg viewBox="0 0 40 28" className={className} aria-hidden>
      <text x="20" y="21" textAnchor="middle" fontSize="20" fontWeight="700" letterSpacing="0.5" fill="var(--accent)" fontFamily="var(--font-display)">
        {brandInitials(brand)}
      </text>
    </svg>
  );
}

// The studio's name with its logo, for a page's header: the horizontal logo, or the mark and name.
export function BrandLockup({ brand: given, dark, className }: { brand?: Brand; dark?: boolean; className?: string }) {
  const mine = useBrand();
  const brand = given ?? mine;
  const src = dark ? brand.logos.horizontalDark : brand.logos.horizontal;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={brand.studio} className={className} />;
  }
  return (
    <span className={`inline-flex items-center gap-2 font-display text-[17px] font-bold tracking-tight ${dark ? "text-black" : "text-white"}`}>
      {brand.studio}
    </span>
  );
}

// The app's name inside a sentence or a label.
export function ProductName() {
  return <>{useBrand().product}</>;
}

// The studio's name as people say it.
export function ShortName() {
  return <>{useBrand().short}</>;
}
