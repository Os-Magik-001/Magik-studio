"use client";

import { useRef, useState, useTransition, type ComponentProps, type DragEvent } from "react";
import { FileUp } from "lucide-react";
import { Button, Textarea, cx } from "@/components/ui";
import { readScriptFile } from "@/app/actions/script-files";
import type { ActionResult } from "@/lib/action-result";
import { SCRIPT_FILE_ACCEPT, SCRIPT_FILE_MAX_BYTES } from "@/lib/workflow";

type Note = { tone: "ok" | "error"; text: string; before?: string };

// A script textarea that also takes the file the script is in: a PDF, a Word document or a text
// file, picked with the button or dropped on the field. The server reads it and its text
// replaces the field's, to check before saving; Undo puts the old text back.
export function ScriptField({ className, ...props }: ComponentProps<"textarea">) {
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [reading, startReading] = useTransition();
  const [note, setNote] = useState<Note | null>(null);
  const [dropping, setDropping] = useState(false);

  function read(file: File) {
    if (file.size > SCRIPT_FILE_MAX_BYTES) {
      setNote({ tone: "error", text: "This file is over 4 MB. Export the script without pictures, or paste the text." });
      return;
    }
    const data = new FormData();
    data.set("file", file);
    startReading(async () => {
      let res: ActionResult;
      try {
        res = await readScriptFile(data);
      } catch {
        // The request itself failed (connection, expired session, a file over the limit).
        setNote({ tone: "error", text: "The file couldn't be sent. Reload the page and try again." });
        return;
      }
      const el = area.current;
      if (!el || res.error || !res.data?.text) {
        setNote({ tone: "error", text: res.error ?? "This file couldn't be read." });
        return;
      }
      const before = el.value;
      el.value = res.data.text;
      el.focus();
      el.setSelectionRange(0, 0);
      el.scrollTop = 0;
      setNote({ tone: "ok", text: `Imported from ${file.name}. Check it before saving: tables and columns can come out in a different order.`, before });
    });
  }

  function undo() {
    if (area.current && note?.before !== undefined) area.current.value = note.before;
    setNote(null);
  }

  const carriesFile = (e: DragEvent) => e.dataTransfer.types.includes("Files");

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        ref={area}
        {...props}
        className={cx(className, dropping && "border-accent")}
        onDragOver={(e) => {
          if (!carriesFile(e)) return;
          e.preventDefault();
          setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={(e) => {
          if (!carriesFile(e)) return;
          e.preventDefault();
          setDropping(false);
          const file = e.dataTransfer.files[0];
          if (file) read(file);
        }}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button type="button" size="sm" onClick={() => picker.current?.click()} disabled={reading}>
          <FileUp size={14} aria-hidden /> {reading ? "Reading the file…" : "Import a file"}
        </Button>
        <span className="text-xs text-muted">PDF, Word or text, up to 4 MB. You can also drop it on the field.</span>
        <input
          ref={picker}
          type="file"
          accept={SCRIPT_FILE_ACCEPT}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Cleared, so picking the same file again reads it again.
            e.target.value = "";
            if (file) read(file);
          }}
        />
      </div>
      {note && (
        <p role={note.tone === "error" ? "alert" : "status"} className={cx("text-xs", note.tone === "error" ? "text-danger" : "text-success")}>
          {note.text}
          {note.before !== undefined && (
            <>
              {" "}
              <button type="button" onClick={undo} className="font-medium underline underline-offset-2">
                Undo
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}
