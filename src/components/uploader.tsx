"use client";

import { useRef, useState } from "react";
import * as tus from "tus-js-client";
import { UploadCloud, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cx } from "@/components/ui";
import { formatBytes } from "@/lib/workflow";

type Item = {
  id: string;
  file: File;
  progress: number;
  state: "uploading" | "saving" | "done" | "error";
  error?: string;
  upload?: tus.Upload;
};

type Props = {
  bucket: "footage" | "versions" | "brand";
  // Storage folder: the video id (footage, versions) or client id (brand).
  folder: string;
  accept?: string;
  multiple?: boolean;
  label: string;
  hint?: string;
  // Called after the bytes are in Storage; records the row server-side.
  onUploaded: (args: { path: string; file: File }) => Promise<{ error?: string }>;
};

const safeName = (name: string) => name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-120);

export function Uploader({ bucket, folder, accept = "video/*", multiple, label, hint, onUploaded }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const patch = (id: string, p: Partial<Item>) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));

  async function start(files: File[]) {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const list = files.slice(0, multiple ? 50 : 1);

    for (const file of list) {
      const id = crypto.randomUUID();
      const path = `${folder}/${id}-${safeName(file.name)}`;
      if (!token) {
        setItems((xs) => [...xs, { id, file, progress: 0, state: "error", error: "Your session expired. Reload the page." }]);
        continue;
      }
      const upload = new tus.Upload(file, {
        endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: { authorization: `Bearer ${token}`, "x-upsert": "false" },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: 6 * 1024 * 1024, // Supabase requires exactly 6 MB chunks.
        metadata: {
          bucketName: bucket,
          objectName: path,
          contentType: file.type || "application/octet-stream",
          cacheControl: "3600",
        },
        onError(err) {
          const body = (err as tus.DetailedError).originalResponse?.getBody?.() ?? "";
          const tooBig = /maximum allowed size|exceeded the maximum/i.test(body) || /413/.test(String(err));
          patch(id, {
            state: "error",
            error: tooBig
              ? "This file is bigger than your Supabase plan allows (50 MB on Free). Upgrade to Pro for large footage."
              : /row-level security|403/i.test(body + String(err))
                ? "You don't have permission to upload to this video."
                : "Upload failed. Check your connection and try again.",
          });
        },
        onProgress(sent, total) {
          patch(id, { progress: total ? sent / total : 0 });
        },
        async onSuccess() {
          patch(id, { state: "saving", progress: 1 });
          const res = await onUploaded({ path, file });
          patch(id, res.error ? { state: "error", error: res.error } : { state: "done" });
        },
      });
      setItems((xs) => [...xs, { id, file, progress: 0, state: "uploading", upload }]);
      upload.findPreviousUploads().then((prev) => {
        if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
        upload.start();
      });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) start(Array.from(e.dataTransfer.files));
        }}
        className={cx(
          "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-6 py-8 text-center transition-colors",
          dragging ? "border-accent bg-accent-soft" : "border-line-strong hover:bg-surface-2",
        )}
      >
        <UploadCloud size={22} strokeWidth={1.5} className="text-muted" aria-hidden />
        <span className="text-sm font-medium text-ink">{label}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          // Copy first: a FileList is live and clearing the input empties it.
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) start(files);
        }}
      />
      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-line px-3 py-2">
              <div className="flex items-center gap-3 text-[13px]">
                <span className="min-w-0 flex-1 truncate text-ink">{item.file.name}</span>
                <span className="shrink-0 text-muted">
                  {item.state === "uploading" && `${Math.round(item.progress * 100)}% of ${formatBytes(item.file.size)}`}
                  {item.state === "saving" && "Finishing…"}
                  {item.state === "done" && <span className="text-success">Uploaded</span>}
                </span>
                {item.state === "uploading" && (
                  <button
                    type="button"
                    aria-label={`Cancel ${item.file.name}`}
                    onClick={() => {
                      item.upload?.abort(true);
                      setItems((xs) => xs.filter((x) => x.id !== item.id));
                    }}
                    className="text-muted hover:text-ink"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {item.state === "uploading" && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full bg-accent transition-[width]" style={{ width: `${item.progress * 100}%` }} />
                </div>
              )}
              {item.error && <p className="mt-1 text-[13px] text-danger">{item.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
