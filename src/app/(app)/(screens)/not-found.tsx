import { WindowPage } from "@/components/desktop/window-page";
import { EmptyState, PageHeader } from "@/components/ui";

// A page that isn't there (or isn't for this person), shown in its window.
export default function NotFound() {
  return (
    <WindowPage>
      <PageHeader title="Not here" />
      <EmptyState title="This page doesn't exist, or it isn't shared with you.">Close this window, or open another app from the Dock.</EmptyState>
    </WindowPage>
  );
}
