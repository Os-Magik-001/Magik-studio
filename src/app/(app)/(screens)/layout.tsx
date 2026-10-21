import { Screen } from "@/components/shell/screen";

// The apps: each page opens as one big screen above the wallpaper.
export default function ScreensLayout({ children }: { children: React.ReactNode }) {
  return <Screen>{children}</Screen>;
}
