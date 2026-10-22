"use client";

import { WindowPage } from "@/components/desktop/window-page";
import { Button, PageHeader } from "@/components/ui";

// A page that failed on the server, shown in its window; the other windows keep working.
export default function ScreenError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <WindowPage>
      <PageHeader title="Something went wrong" description="This page couldn't load. The other windows are fine." />
      <Button variant="secondary" onClick={() => reset()}>
        Try again
      </Button>
    </WindowPage>
  );
}
