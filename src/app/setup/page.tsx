import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer, displayName } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedUrls } from "@/lib/storage";
import { QUESTIONS, readAnswers } from "@/lib/questionnaire";
import { REQUIRED_SETUP_QUESTIONS, SETUP_QUESTION_KEYS } from "@/lib/onboarding";
import { cleanSpec } from "@/lib/logo-templates";
import { SetupFrame } from "@/components/setup/setup-frame";
import { BrandStep, ContractStep, DoneStep, QuestionsStep, ReferencesStep } from "./steps";

export const instant = false;

export const metadata: Metadata = { title: "Set up your space" };

type Step = "contract" | "questions" | "references" | "brand" | "done";

// The client's setup assistant, after they opened their account from the seller's link. It
// resumes at the first step not done; earlier steps can be reopened with ?step=.
export default async function SetupPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const viewer = await getViewer();
  if (viewer.role !== "client" || !viewer.clientId) redirect("/");
  const clientId = viewer.clientId;
  const supabase = await createClient();
  const admin = createAdminClient();
  const [{ step: asked }, { data: progress }, { data: client }, { data: contracts }, { data: form }, { data: library }, { data: refs }, { data: kit }] = await Promise.all([
    searchParams,
    supabase.from("onboardings").select("*").eq("client_id", clientId).maybeSingle(),
    supabase.from("clients").select("name, language, packs(name)").eq("id", clientId).maybeSingle(),
    supabase.from("contracts").select("id, file_name, storage_path, status").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1),
    supabase.from("brand_questionnaires").select("answers").eq("client_id", clientId).maybeSingle(),
    supabase.from("reference_library").select("id, url, platform, title, note, tags, cover_path").eq("active", true).order("sort").order("created_at", { ascending: false }),
    // Clients don't read reference_videos through RLS; these are their own, by client id.
    admin.from("reference_videos").select("id, url, platform, title, note, library_id").eq("client_id", clientId).is("video_id", null).order("created_at"),
    supabase.from("brand_kits").select("logo_path, logo_spec").eq("client_id", clientId).maybeSingle(),
  ]);
  if (!progress || !client) redirect("/");

  const contract = contracts?.[0] ?? null;
  const steps: { key: Step; label: string; done: boolean }[] = [
    ...(contract ? [{ key: "contract" as const, label: "Contract", done: contract.status === "signed" }] : []),
    { key: "questions", label: "Questions", done: !!progress.questions_done_at },
    { key: "references", label: "References", done: !!progress.references_done_at },
    { key: "brand", label: "Brand", done: !!progress.brand_done_at },
  ];
  const first = steps.find((s) => !s.done)?.key ?? "done";
  // Reopen a step already done, never skip ahead.
  const order = steps.map((s) => s.key);
  const step: Step =
    asked && order.includes(asked as Step) && (first === "done" || order.indexOf(asked as Step) <= order.indexOf(first)) && asked !== "contract"
      ? (asked as Step)
      : first;

  const covers = await signedUrls(
    "references",
    (library ?? []).map((l) => l.cover_path).filter((p): p is string => !!p),
  );
  const logo = kit?.logo_path ? (await signedUrls("brand", [kit.logo_path])).get(kit.logo_path) ?? null : null;
  const contractUrl =
    step === "contract" && contract ? (await admin.storage.from("contracts").createSignedUrl(contract.storage_path, 60 * 60)).data?.signedUrl ?? null : null;
  const answers = readAnswers(form?.answers);
  const questions = SETUP_QUESTION_KEYS.map((key) => QUESTIONS.find((q) => q.key === key)!).map((q) => ({ key: q.key, label: q.label, hint: q.hint, rows: q.rows }));

  return (
    <SetupFrame steps={step === "done" ? undefined : steps} current={step} wide={step === "brand" || step === "references"}>
      {step === "contract" && contract && <ContractStep contract={{ id: contract.id, fileName: contract.file_name, url: contractUrl }} name={displayName(viewer)} />}
      {step === "questions" && <QuestionsStep questions={questions} initial={answers} required={REQUIRED_SETUP_QUESTIONS} />}
      {step === "references" && (
        <ReferencesStep
          library={(library ?? []).map((l) => ({ id: l.id, url: l.url, platform: l.platform, title: l.title, note: l.note, tags: l.tags, cover: l.cover_path ? covers.get(l.cover_path) ?? null : null }))}
          added={(refs ?? []).map((r) => ({ id: r.id, url: r.url, platform: r.platform, title: r.title, note: r.note, libraryId: r.library_id }))}
        />
      )}
      {step === "brand" && <BrandStep brandName={client.name} initial={kit?.logo_spec ? cleanSpec(kit.logo_spec as never, client.name) : null} />}
      {step === "done" && <DoneStep name={displayName(viewer)} clientName={client.name} logo={logo} />}
    </SetupFrame>
  );
}
