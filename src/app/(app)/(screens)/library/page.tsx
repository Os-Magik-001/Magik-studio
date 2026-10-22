import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { PLATFORM_LABEL, type ReferencePlatform } from "@/lib/reference-links";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, cx } from "@/components/ui";
import { deleteLibraryItem, setLibraryItemActive } from "@/app/actions/library";
import { AddLibraryItemForm, EditLibraryItemForm } from "./forms";
import { WindowPage } from "@/components/desktop/window-page";

export const metadata: Metadata = { title: "Library" };

const youtubeId = (url: string) => url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/)?.[1] ?? null;
const TINT: Record<string, string> = {
  instagram: "linear-gradient(135deg,#f58529,#dd2a7b 50%,#8134af)",
  tiktok: "linear-gradient(135deg,#25f4ee,#000 45%,#fe2c55)",
  youtube: "linear-gradient(135deg,#ff4e45,#a50000)",
  vimeo: "linear-gradient(135deg,#1ab7ea,#0d5f80)",
};

export default async function LibraryPage() {
  await requireRole("admin", "editor");
  const supabase = await createClient();
  const { data: items } = await supabase.from("reference_library").select("*").order("active", { ascending: false }).order("created_at", { ascending: false });
  const covers = await signedUrls(
    "references",
    (items ?? []).map((i) => i.cover_path).filter((p): p is string => !!p),
  );

  return (
    <WindowPage>
      <PageHeader
        eyebrow="References"
        title="Library"
        description="Videos new clients pick from when they set up their space (“videos to match”). Their picks become references the agents study."
      />
      <div className="grid gap-6 @min-[80rem]:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          {!items?.length ? (
            <EmptyState title="The library is empty">Add a few reels in different styles: clients pick the ones that feel like their brand.</EmptyState>
          ) : (
            <ul className="grid grid-cols-2 gap-4 @min-[48rem]:grid-cols-3">
              {items.map((item) => {
                const yt = item.platform === "youtube" ? youtubeId(item.url) : null;
                const cover = item.cover_path ? covers.get(item.cover_path) : yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null;
                return (
                  <li key={item.id} className={cx("frost overflow-hidden rounded-[18px]", !item.active && "opacity-55")}>
                    <div className="relative aspect-[4/5] bg-cover bg-center" style={{ backgroundImage: cover ? `url("${cover}")` : (TINT[item.platform] ?? "linear-gradient(135deg,#3a3a3c,#1c1c1e)") }}>
                      <div className="absolute top-2.5 left-2.5 flex gap-1.5">
                        <Badge>{PLATFORM_LABEL[item.platform as ReferencePlatform] ?? "Link"}</Badge>
                        {!item.active && <Badge tone="warning">Hidden</Badge>}
                      </div>
                    </div>
                    <div className="p-3.5">
                      <p className="line-clamp-2 text-[14px] font-semibold text-ink">{item.title}</p>
                      {!!item.tags.length && <p className="mt-0.5 truncate text-[12px] text-muted">{item.tags.join(" · ")}</p>}
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[12.5px] text-muted hover:text-ink">Edit</summary>
                        <div className="mt-2">
                          <EditLibraryItemForm item={item} />
                        </div>
                      </details>
                      <div className="mt-2 flex items-center gap-1">
                        <a href={item.url} target="_blank" rel="noreferrer" aria-label="Watch" className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-ink">
                          <ExternalLink size={15} aria-hidden />
                        </a>
                        <form action={setLibraryItemActive}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="active" value={item.active ? "0" : "1"} />
                          <Button variant="ghost" size="sm">
                            {item.active ? "Hide" : "Show"}
                          </Button>
                        </form>
                        <form action={deleteLibraryItem} className="ml-auto">
                          <input type="hidden" name="id" value={item.id} />
                          <Button variant="ghost" size="sm" className="text-danger hover:text-danger">
                            Delete
                          </Button>
                        </form>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <Card className="h-fit">
          <CardHeader title="Add a video" />
          <div className="p-5">
            <AddLibraryItemForm />
          </div>
        </Card>
      </div>
    </WindowPage>
  );
}
