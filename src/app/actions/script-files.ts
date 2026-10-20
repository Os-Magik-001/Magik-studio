"use server";

import { requireRole } from "@/lib/auth";
import { done, fail, type ActionResult } from "@/lib/action-result";
import { readScript, ScriptFileError } from "@/lib/script-files";
import { SCRIPT_FILE_MAX_BYTES } from "@/lib/workflow";

// Reads a script the studio already has (a PDF, a Word document or a text file) and sends its
// text back to the script field, to check before saving. The file itself isn't kept.
export async function readScriptFile(formData: FormData): Promise<ActionResult> {
  await requireRole("admin", "editor");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a file first.");
  if (file.size > SCRIPT_FILE_MAX_BYTES) return fail("This file is over 4 MB. Export the script without pictures, or paste the text.");
  try {
    return done(undefined, { text: await readScript(file.name, new Uint8Array(await file.arrayBuffer())) });
  } catch (e) {
    return fail(e instanceof ScriptFileError ? e.message : "This file couldn't be read. Export it again as a PDF or a Word document, or paste the text.");
  }
}
