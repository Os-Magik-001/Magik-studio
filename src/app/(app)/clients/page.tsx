import Link from "next/link";
import type { Metadata } from "next";
import { FolderOpen } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { NewClientForm } from "./new-client-form";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  const viewer = await requireRole("admin", "editor");
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, videos(id, status)")
    .order("name");

  return (
    <>
      <PageHeader
        title="Clients"
        description="Each client has a folder: their videos, scripts, footage, every version and their brand kit."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {!clients?.length ? (
            <EmptyState title="No clients yet">
              {viewer.role === "admin" ? "Add your first client to get started." : "You haven't been assigned to a client yet."}
            </EmptyState>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {clients.map((c) => {
                const open = c.videos.filter((v) => v.status !== "delivered").length;
                const review = c.videos.filter((v) => v.status === "client_review").length;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/clients/${c.id}`}
                      className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong"
                    >
                      <FolderOpen size={18} strokeWidth={1.5} className="mt-0.5 text-muted" aria-hidden />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-ink">{c.name}</div>
                        <div className="mt-0.5 text-[13px] text-muted">
                          {open} in progress
                          {review > 0 && ` · ${review} with client`}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {viewer.role === "admin" && (
          <Card className="h-fit">
            <CardHeader title="New client" />
            <div className="p-5">
              <NewClientForm />
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
