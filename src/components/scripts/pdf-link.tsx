import { Download } from "lucide-react";
import { cx } from "@/components/ui";

// The script's PDF (/scripts/<videoId>/pdf), to download, print or forward.
export function ScriptPdfLink({ videoId, label = "Download PDF", className }: { videoId: string; label?: string; className?: string }) {
  return (
    <a
      href={`/scripts/${videoId}/pdf`}
      className={cx("glass inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap text-ink hover:bg-white/[0.13]", className)}
    >
      <Download size={14} aria-hidden /> {label}
    </a>
  );
}
