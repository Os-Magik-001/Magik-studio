import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Check, ExternalLink, FileText, Sparkles } from "lucide-react";
import { displayName, requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedUrls } from "@/lib/storage";
import { QUESTIONS, readAnswers } from "@/lib/questionnaire";
import { STEPS, currentStep, formatMoney, linkState, stepByKey, stepsDone, type OnboardingFacts, type StepKey } from "@/lib/onboarding";
import { PLATFORM_LABEL, type ReferencePlatform } from "@/lib/reference-links";
import { Avatar, Badge, Button, Card, EmptyState, LinkButton, PageHeader, cx } from "@/components/ui";
import { LocalDate } from "@/components/local-date";
import { markContractSigned, removeContract, setInvoiceStatus } from "@/app/actions/onboarding";
import { ClientInfosForm, ContractUploadForm, GenerateInvoiceForm, LinkPanel, PackChooser } from "../forms";
import { LaneProgress, StepRail } from "../progress";
import { WindowPage } from "@/components/desktop/window-page";

export async function generateMetadata({ params }: { params: Promise<{ clientId: string }> }): Promise<Metadata> {
  const { clientId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) return { title: "Onboarding" };
  await requireRole("admin", "seller");
  const { data } = await createAdminClient().from("clients").select("name").eq("id", clientId).maybeSingle();
  return { title: data?.name ?? "Onboarding" };
}

export default async function ClientOnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const viewer = await requireRole("admin", "seller");
  const [{ clientId }, { step: askedStep }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) notFound();

  // Sellers don't read production tables through RLS; the role check above is the gate.
  const admin = createAdminClient();
  const [{ data: client }, { data: progress }, { data: packs }, { data: settings }, { data: invoices }, { data: contracts }, { data: invites }, { data: accounts }, { data: form }, { data: refs }, { data: kit }] =
    await Promise.all([
      admin.from("clients").select("id, name, contact_name, email, phone, address, website, instagram, language, notes, pack_id, seller_id, created_at").eq("id", clientId).maybeSingle(),
      admin.from("onboardings").select("*").eq("client_id", clientId).maybeSingle(),
      admin.from("packs").select("*").order("sort").order("price_cents"),
      admin.from("studio_settings").select("currency").maybeSingle(),
      admin.from("invoices").select("id, number, status, total_cents, currency, issued_on, due_on, written_by_claude, created_at").eq("client_id", clientId).order("created_at", { ascending: false }),
      admin.from("contracts").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1),
      admin.from("client_invites").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1),
      admin.from("profiles").select("id, full_name, email, created_at").eq("client_id", clientId).eq("role", "client"),
      admin.from("brand_questionnaires").select("answers, updated_at").eq("client_id", clientId).maybeSingle(),
      admin.from("reference_videos").select("id, url, platform, note, title, library_id, created_at").eq("client_id", clientId).is("video_id", null).order("created_at"),
      admin.from("brand_kits").select("logo_path, logo_source, colors, fonts").eq("client_id", clientId).maybeSingle(),
    ]);
  if (!client) notFound();

  const invoice = invoices?.find((i) => i.status !== "void") ?? null;
  const contract = contracts?.[0] ?? null;
  const invite = invites?.[0] ?? null;
  const facts: OnboardingFacts = {
    hasInfos: !!(client.contact_name && client.email),
    packId: client.pack_id,
    invoice,
    contract,
    invite,
    hasAccount: !!accounts?.length,
    progress,
  };
  const current = currentStep(facts);
  const done = stepsDone(facts);
  const active: StepKey = STEPS.some((s) => s.key === askedStep) ? (askedStep as StepKey) : current === "done" ? "brand" : current;
  const next = STEPS[STEPS.findIndex((s) => s.key === active) + 1];
  const currency = settings?.currency ?? "CAD";
  const pack = packs?.find((p) => p.id === client.pack_id) ?? null;
  const signed = await signedUrls(
    "brand",
    [kit?.logo_path].filter((p): p is string => !!p),
  );
  const contractUrl = contract ? (await createAdminClient().storage.from("contracts").createSignedUrl(contract.storage_path, 60 * 60)).data?.signedUrl : null;
  const answers = readAnswers(form?.answers);
  const link = linkState(invite);

  return (
    <WindowPage>
      <PageHeader
        eyebrow={<Link href="/onboarding">Onboarding</Link>}
        title={client.name}
        description={[client.contact_name, client.email, client.phone].filter(Boolean).join(" · ") || "No contact details yet"}
        actions={
          <div className="flex items-center gap-3">
            <LaneProgress facts={facts} current={current} />
            {current === "done" ? <Badge tone="success">Finished</Badge> : <Badge tone={stepByKey(current).lane === "seller" ? "accent" : "neutral"}>{stepByKey(current).lane === "seller" ? "Your turn" : "With the client"}</Badge>}
          </div>
        }
      />
      {!progress && (
        <p className="mb-5 rounded-[14px] bg-warning-soft px-4 py-3 text-[13px] text-warning">This client isn&apos;t in onboarding: start it from the Onboarding list.</p>
      )}
      <div className="grid gap-6 @min-[64rem]:grid-cols-[250px_1fr]">
        <aside>
          <StepRail clientId={client.id} facts={facts} active={active} current={current} />
        </aside>

        <Card className="min-w-0 p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold tracking-wide text-muted uppercase">
                {stepByKey(active).lane === "seller" ? "Seller" : "Client"} · Step {STEPS.findIndex((s) => s.key === active) + 1} of 10
              </p>
              <h2 className="mt-1 text-[20px] font-bold tracking-tight text-ink">{stepByKey(active).label}</h2>
            </div>
            {done[active] && (
              <span className="flex items-center gap-1 text-[13px] font-semibold text-success">
                <Check size={15} strokeWidth={3} aria-hidden /> Done
              </span>
            )}
          </div>

          {active === "infos" && <ClientInfosForm client={client} />}

          {active === "pack" &&
            (packs?.some((p) => p.active) ? (
              <>
                <PackChooser clientId={client.id} packs={(packs ?? []).filter((p) => p.active || p.id === client.pack_id)} currentPackId={client.pack_id} currency={currency} />
                {viewer.role === "admin" && (
                  <p className="mt-4 text-[13px] text-muted">
                    Packs and prices are set in <Link href="/onboarding/packs" className="text-accent hover:underline">Packs</Link>.
                  </p>
                )}
              </>
            ) : (
              <EmptyState title="No packs yet">
                {viewer.role === "admin" ? (
                  <>
                    Add the studio&apos;s offers in <Link href="/onboarding/packs" className="text-accent hover:underline">Packs</Link> first.
                  </>
                ) : (
                  "Ask the studio manager to add the offers in Packs."
                )}
              </EmptyState>
            ))}

          {active === "invoice" &&
            (!pack ? (
              <EmptyState title="Choose the pack first">The invoice bills the pack&apos;s price.</EmptyState>
            ) : (
              <div className="flex flex-col gap-5">
                {invoice ? (
                  <div className="rounded-[16px] bg-white/[0.05] p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[13px] text-muted">Invoice {invoice.number}</p>
                        <p className="mt-1 font-display text-[30px] leading-none font-bold text-ink tabular-nums">{formatMoney(invoice.total_cents, invoice.currency)}</p>
                        <p className="mt-1.5 text-[12.5px] text-muted">
                          {pack.name} · taxes included · <LocalDate value={invoice.created_at} preset="date" prefix="issued " />
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge tone={invoice.status === "paid" ? "success" : invoice.status === "sent" ? "accent" : "neutral"}>
                          {invoice.status === "paid" ? "Paid" : invoice.status === "sent" ? "Sent" : "Ready to send"}
                        </Badge>
                        {invoice.written_by_claude && (
                          <span className="flex items-center gap-1 text-[11.5px] text-muted">
                            <Sparkles size={12} aria-hidden /> Worded by the agents
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a href={`/invoices/${invoice.id}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.08] px-4 text-[13.5px] font-medium text-ink hover:bg-white/[0.13]">
                        <ExternalLink size={14} aria-hidden /> Open the invoice
                      </a>
                      {invoice.status === "issued" && (
                        <form action={setInvoiceStatus}>
                          <input type="hidden" name="invoiceId" value={invoice.id} />
                          <input type="hidden" name="status" value="sent" />
                          <Button variant="secondary">Mark as sent</Button>
                        </form>
                      )}
                      {invoice.status !== "paid" && (
                        <form action={setInvoiceStatus}>
                          <input type="hidden" name="invoiceId" value={invoice.id} />
                          <input type="hidden" name="status" value="paid" />
                          <Button variant="secondary">Mark as paid</Button>
                        </form>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-[13.5px] text-ink-2">
                    The invoice is generated from the pack ({pack.name}, {formatMoney(pack.price_cents, currency)}) and the studio&apos;s invoice details, with taxes, in{" "}
                    {client.language === "en" ? "English" : "French"}. The client also finds it in their Documents app.
                  </p>
                )}
                <GenerateInvoiceForm clientId={client.id} again={!!invoice} />
                {invoice && <p className="text-[12px] text-muted">A new invoice replaces this one (it&apos;s kept, marked void).</p>}
              </div>
            ))}

          {active === "contract" &&
            (contract ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-4 rounded-[16px] bg-white/[0.05] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#ff453a]/15 text-[#ff6b61]">
                    <FileText size={20} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">{contract.file_name}</p>
                    <p className="text-[12.5px] text-muted">
                      {contract.status === "signed" ? (
                        contract.signed_outside ? (
                          "Marked as signed by the studio"
                        ) : (
                          <>
                            Signed in the app by {contract.signed_name}
                            {contract.signed_at && <LocalDate value={contract.signed_at} preset="datetime" prefix=", " />}
                          </>
                        )
                      ) : (
                        "The client signs it after opening their account"
                      )}
                    </p>
                  </div>
                  <Badge tone={contract.status === "signed" ? "success" : "warning"}>{contract.status === "signed" ? "Signed" : "Awaiting signature"}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {contractUrl && (
                    <a href={contractUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.08] px-4 text-[13.5px] font-medium text-ink hover:bg-white/[0.13]">
                      <ExternalLink size={14} aria-hidden /> Open the PDF
                    </a>
                  )}
                  {contract.status !== "signed" && (
                    <form action={markContractSigned}>
                      <input type="hidden" name="contractId" value={contract.id} />
                      <Button variant="secondary">It&apos;s signed (on paper)</Button>
                    </form>
                  )}
                  {!(contract.status === "signed" && !contract.signed_outside) && (
                    <form action={removeContract}>
                      <input type="hidden" name="contractId" value={contract.id} />
                      <Button variant="ghost">Replace the file</Button>
                    </form>
                  )}
                </div>
              </div>
            ) : (
              <ContractUploadForm clientId={client.id} />
            ))}

          {active === "link" && (
            <div className="flex flex-col gap-5">
              {invite && link !== "none" && (
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-ink-2">
                  <span>
                    Link: <strong className="text-ink">{link === "active" ? "open" : link === "used" ? "used" : link === "expired" ? "expired" : "replaced"}</strong>
                  </span>
                  {invite.sent_at && <LocalDate value={invite.sent_at} preset="datetime" prefix="Sent " />}
                  {link === "active" && <LocalDate value={invite.expires_at} preset="date" prefix="Works until " />}
                  {invite.opened_at && <LocalDate value={invite.opened_at} preset="datetime" prefix="Opened " />}
                </div>
              )}
              {accounts?.length ? (
                <p className="text-[13.5px] text-success">The client has opened their account: the link&apos;s job is done.</p>
              ) : !client.email ? (
                <EmptyState title="Add the client's email first">The link goes to them by email or text.</EmptyState>
              ) : (
                <LinkPanel
                  clientId={client.id}
                  contactName={client.contact_name ?? client.name}
                  email={client.email}
                  language={client.language}
                  sellerName={displayName(viewer)}
                  hasActiveLink={link === "active"}
                />
              )}
            </div>
          )}

          {active === "opened" && (
            <ClientStatus ok={done.opened} yes={invite?.opened_at ? <LocalDate value={invite.opened_at} preset="datetime" prefix="Opened the link " /> : "Opened the link"} no="Waiting for the client to open the link." />
          )}

          {active === "account" &&
            (accounts?.length ? (
              <ul className="flex flex-col gap-2">
                {accounts.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-[14px] bg-white/[0.05] px-4 py-3">
                    <Avatar name={a.full_name ?? a.email} size={34} />
                    <div>
                      <p className="text-[14px] font-medium text-ink">{a.full_name ?? a.email}</p>
                      <p className="text-[12.5px] text-muted">
                        {a.email} · <LocalDate value={a.created_at} preset="date" prefix="since " />
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <ClientStatus ok={false} yes="" no="Waiting for the client to open their account from the link." />
            ))}

          {active === "questions" &&
            (Object.keys(answers).length ? (
              <dl className="flex flex-col divide-y divide-white/[0.07]">
                {QUESTIONS.filter((q) => answers[q.key]).map((q) => (
                  <div key={q.key} className="py-3">
                    <dt className="text-[12px] font-semibold tracking-wide text-muted uppercase">{q.label}</dt>
                    <dd className="mt-1 text-[13.5px] whitespace-pre-line text-ink">{answers[q.key]}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <ClientStatus ok={false} yes="" no="The client answers the questions one at a time after opening their account." />
            ))}

          {active === "references" &&
            (refs?.length ? (
              <ul className="flex flex-col gap-2">
                {refs.map((r) => (
                  <li key={r.id} className="flex items-start gap-3 rounded-[14px] bg-white/[0.05] px-4 py-3">
                    <Badge>{PLATFORM_LABEL[r.platform as ReferencePlatform] ?? "Link"}</Badge>
                    <div className="min-w-0 flex-1">
                      <a href={r.url} target="_blank" rel="noreferrer" className="block truncate text-[13.5px] font-medium text-ink hover:text-accent">
                        {r.title ?? r.url}
                      </a>
                      {r.note && <p className="mt-0.5 text-[12.5px] text-muted">“{r.note}”</p>}
                      {r.library_id && <p className="mt-0.5 text-[11.5px] text-muted">From the studio&apos;s library</p>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <ClientStatus ok={false} yes="" no="The client picks videos from the library or pastes their own links." />
            ))}

          {active === "brand" &&
            (progress?.brand_done_at ? (
              <div className="flex flex-wrap items-center gap-6">
                {kit?.logo_path && signed.get(kit.logo_path) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={signed.get(kit.logo_path)} alt={`${client.name} logo`} className="h-36 w-64 rounded-[16px] bg-white object-contain p-5" />
                ) : null}
                <div className="flex flex-col gap-2">
                  <Badge tone="success">{kit?.logo_source === "created" ? "Logo created in the setup" : "Logo uploaded"}</Badge>
                  {!!kit?.colors?.length && (
                    <div className="flex gap-1.5">
                      {kit.colors.map((c) => (
                        <span key={c} title={c} className="h-6 w-6 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)]" style={{ background: c }} />
                      ))}
                    </div>
                  )}
                  {!!kit?.fonts?.length && <p className="text-[13px] text-muted">{kit.fonts.join(", ")}</p>}
                  {viewer.role === "admin" && (
                    <Link href={`/clients/${client.id}`} className="text-[13px] text-accent hover:underline">
                      Open the client folder
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <ClientStatus ok={false} yes="" no="Last step for the client: they upload their logo, or create one from templates if they don't have a brand." />
            ))}

          {next && done[active] && (
            <div className="mt-7 flex justify-end border-t border-white/[0.07] pt-5">
              <LinkButton href={`/onboarding/${client.id}?step=${next.key}`} variant="secondary">
                {next.lane === "client" && stepByKey(active).lane === "seller" ? "See the client's steps" : `Next: ${next.label}`} <ArrowRight size={15} aria-hidden />
              </LinkButton>
            </div>
          )}
        </Card>
      </div>
    </WindowPage>
  );
}

function ClientStatus({ ok, yes, no }: { ok: boolean; yes: React.ReactNode; no: string }) {
  return (
    <p className={cx("flex items-center gap-2 text-[14px]", ok ? "text-success" : "text-muted")}>
      {ok ? <Check size={16} strokeWidth={3} aria-hidden /> : <span className="h-2 w-2 rounded-full bg-white/25" aria-hidden />}
      {ok ? yes : no}
    </p>
  );
}
