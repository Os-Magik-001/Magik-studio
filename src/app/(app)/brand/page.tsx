import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readAnswers } from "@/lib/questionnaire";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { QuestionnaireForm } from "@/components/agents/forms";

export const metadata: Metadata = { title: "Your brand" };

// The client's side of the questionnaire: what the studio needs to know to make their videos.
export default async function YourBrand() {
  const viewer = await requireRole("client");
  if (!viewer.clientId) {
    return (
      <>
        <PageHeader title="Your brand" />
        <EmptyState title="Your account isn't linked to a brand yet">Ask the studio to link it.</EmptyState>
      </>
    );
  }
  const supabase = await createClient();
  const { data: form } = await supabase.from("brand_questionnaires").select("answers").eq("client_id", viewer.clientId).maybeSingle();

  return (
    <>
      <PageHeader
        title="Your brand"
        description="Tell us about your business. We use your answers to define your niche and visual identity, study what goes viral in your field, and write your videos."
      />
      <Card>
        <CardHeader title="Questionnaire" description="Answer what you can. You can come back and change it any time." />
        <div className="p-5">
          <QuestionnaireForm answers={readAnswers(form?.answers)} submitLabel={form ? "Update my answers" : "Send my answers"} />
        </div>
      </Card>
    </>
  );
}
