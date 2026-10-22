import { redirect } from "next/navigation";

// Documents moved into Settings.
export default function DocumentsMoved() {
  redirect("/account/documents");
}
