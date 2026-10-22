"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Mail, MessageSquare, Share2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button, Input, Select, Textarea, cx } from "@/components/ui";
import { Field } from "@/components/field";
import { formatMoney } from "@/lib/onboarding";
import {
  choosePack,
  createInviteLink,
  createOnboardingClient,
  generateInvoice,
  markInviteSent,
  saveClientInfos,
  savePack,
  saveStudioSettings,
  uploadContract,
} from "@/app/actions/onboarding";

type ClientInfos = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  instagram: string | null;
  language: string;
  notes: string | null;
};

// ---------------------------------------------------------------- 1. client infos

export function ClientInfosForm({ client }: { client?: ClientInfos }) {
  const [language, setLanguage] = useState(client?.language ?? "fr");
  return (
    <ActionForm action={client ? saveClientInfos : createOnboardingClient} className="grid gap-4 @min-[40rem]:grid-cols-2">
      {client && <input type="hidden" name="clientId" value={client.id} />}
      <Field label="Business name" className="@min-[40rem]:col-span-2">
        <Input name="name" required defaultValue={client?.name} placeholder="Kapsalon MTL" autoFocus={!client} />
      </Field>
      <Field label="Contact person">
        <Input name="contactName" required defaultValue={client?.contact_name ?? ""} placeholder="Karim Salon" autoComplete="off" />
      </Field>
      <Field label="Email" hint="The link to open their account goes here.">
        <Input name="email" type="email" required defaultValue={client?.email ?? ""} placeholder="karim@kapsalon.ca" autoComplete="off" />
      </Field>
      <Field label="Phone">
        <Input name="phone" type="tel" defaultValue={client?.phone ?? ""} placeholder="514 555 0123" autoComplete="off" />
      </Field>
      <Field label="Instagram">
        <Input name="instagram" defaultValue={client?.instagram ? `@${client.instagram}` : ""} placeholder="@kapsalon.mtl" autoComplete="off" />
      </Field>
      <Field label="Website">
        <Input name="website" defaultValue={client?.website ?? ""} placeholder="kapsalon.ca" autoComplete="off" />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink-2">Language</span>
        <input type="hidden" name="language" value={language} />
        <div role="radiogroup" aria-label="Language" className="inline-flex h-9 w-fit rounded-full bg-white/[0.07] p-[3px]">
          {[
            ["fr", "Français"],
            ["en", "English"],
          ].map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={language === v}
              onClick={() => setLanguage(v)}
              className={cx("rounded-full px-4 text-[13px] font-medium", language === v ? "bg-white/[0.16] text-ink" : "text-muted hover:text-ink")}
            >
              {l}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">Their invoice and messages use it.</p>
      </div>
      <Field label="Billing address" className="@min-[40rem]:col-span-2">
        <Textarea name="address" rows={2} defaultValue={client?.address ?? ""} placeholder={"1234 rue Saint-Denis\nMontréal, QC  H2X 3K8"} />
      </Field>
      <Field label="Notes for the studio" className="@min-[40rem]:col-span-2">
        <Textarea name="notes" rows={2} defaultValue={client?.notes ?? ""} placeholder="What they want, how they found us, anything to know." />
      </Field>
      <div className="flex justify-end @min-[40rem]:col-span-2">
        <SubmitButton pendingText={client ? "Saving…" : "Creating…"}>{client ? "Save details" : "Create client and continue"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

// ---------------------------------------------------------------- 2. pack

type Pack = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  billing: string;
  videos_per_month: number | null;
  revision_rounds: number;
  features: string[];
  active: boolean;
};

export function PackChooser({ clientId, packs, currentPackId, currency }: { clientId: string; packs: Pack[]; currentPackId: string | null; currency: string }) {
  return (
    <div className="grid gap-4 @min-[48rem]:grid-cols-2 @min-[80rem]:grid-cols-3">
      {packs.map((p) => {
        const chosen = p.id === currentPackId;
        return (
          <ActionForm key={p.id} action={choosePack} className="contents">
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="packId" value={p.id} />
            <div
              className={cx(
                "flex flex-col rounded-[20px] p-5 transition-shadow",
                chosen ? "bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--accent)]" : "frost",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[16px] font-semibold text-ink">{p.name}</h3>
                {chosen && (
                  <span className="flex items-center gap-1 text-[12px] font-semibold text-accent">
                    <Check size={14} strokeWidth={3} aria-hidden /> Chosen
                  </span>
                )}
              </div>
              <p className="mt-2 font-display text-[28px] leading-none font-bold text-ink tabular-nums">
                {formatMoney(p.price_cents, currency)}
                <span className="ml-1 text-[13px] font-medium text-muted">{p.billing === "monthly" ? "/ month" : "one time"}</span>
              </p>
              {p.description && <p className="mt-2 text-[13px] text-muted">{p.description}</p>}
              <ul className="mt-3 flex flex-1 flex-col gap-1.5 text-[13px] text-ink-2">
                {p.videos_per_month ? (
                  <li className="flex gap-2">
                    <Check size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden /> {p.videos_per_month} videos a month
                  </li>
                ) : null}
                <li className="flex gap-2">
                  <Check size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden /> {p.revision_rounds} revision round{p.revision_rounds === 1 ? "" : "s"}
                </li>
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden /> {f}
                  </li>
                ))}
              </ul>
              <SubmitButton variant={chosen ? "secondary" : "primary"} className="mt-5 w-full" pendingText="Saving…">
                {chosen ? "Keep this pack" : "Choose this pack"}
              </SubmitButton>
            </div>
          </ActionForm>
        );
      })}
    </div>
  );
}

export function PackForm({ pack, onDone }: { pack?: Pack; onDone?: () => void }) {
  return (
    <ActionForm action={savePack} resetOnSuccess={!pack} onSuccess={onDone} className="grid gap-4 @min-[40rem]:grid-cols-2">
      {pack && <input type="hidden" name="packId" value={pack.id} />}
      <Field label="Name">
        <Input name="name" required defaultValue={pack?.name} placeholder="Growth" />
      </Field>
      <Field label="Price (before taxes)">
        <Input name="price" required inputMode="decimal" defaultValue={pack ? (pack.price_cents / 100).toString() : ""} placeholder="1500" />
      </Field>
      <Field label="Billing">
        <Select name="billing" defaultValue={pack?.billing ?? "monthly"}>
          <option value="monthly">Every month</option>
          <option value="one_time">One time</option>
        </Select>
      </Field>
      <Field label="Videos per month" hint="Leave empty if it doesn't apply.">
        <Input name="videosPerMonth" inputMode="numeric" defaultValue={pack?.videos_per_month ?? ""} placeholder="4" />
      </Field>
      <Field label="Revision rounds" hint="Becomes the client's limit; more are billable.">
        <Input name="revisionRounds" inputMode="numeric" defaultValue={pack?.revision_rounds ?? 2} />
      </Field>
      <Field label="Short description">
        <Input name="description" defaultValue={pack?.description ?? ""} placeholder="For brands posting every week" />
      </Field>
      <Field label="What's included" hint="One per line." className="@min-[40rem]:col-span-2">
        <Textarea name="features" rows={4} defaultValue={pack?.features.join("\n") ?? ""} placeholder={"Script writing\nOne shoot a month\nCaptions and motion design"} />
      </Field>
      <div className="flex justify-end @min-[40rem]:col-span-2">
        <SubmitButton pendingText="Saving…">{pack ? "Save pack" : "Add pack"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

// ---------------------------------------------------------------- 3. invoice

export function GenerateInvoiceForm({ clientId, again }: { clientId: string; again?: boolean }) {
  return (
    <ActionForm action={generateInvoice} className="flex flex-col items-start gap-1">
      <input type="hidden" name="clientId" value={clientId} />
      <SubmitButton variant={again ? "secondary" : "primary"} pendingText="Generating…">
        {again ? "Generate a new invoice" : "Generate the invoice"}
      </SubmitButton>
    </ActionForm>
  );
}

// ---------------------------------------------------------------- 4. contract

export function ContractUploadForm({ clientId }: { clientId: string }) {
  const [file, setFile] = useState<string | null>(null);
  return (
    <ActionForm action={uploadContract} className="flex flex-col gap-4">
      <input type="hidden" name="clientId" value={clientId} />
      <label
        className={cx(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[16px] border border-dashed px-6 py-8 text-center transition-colors",
          file ? "border-accent/60 bg-accent-soft" : "border-white/20 hover:bg-white/[0.04]",
        )}
      >
        <span className="text-[14px] font-medium text-ink">{file ?? "Choose the contract"}</span>
        <span className="text-[12px] text-muted">{file ? "Click to choose another file" : "A PDF, up to 4 MB"}</span>
        <input
          type="file"
          name="file"
          accept="application/pdf,.pdf"
          required
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)}
        />
      </label>
      <label className="flex items-start gap-2.5 text-[13px] text-ink-2">
        <input type="checkbox" name="signedOutside" value="1" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
        <span>
          Already signed (on paper, or before the link)
          <span className="block text-[12px] text-muted">Otherwise the client reads and signs it in the app, right after opening their account.</span>
        </span>
      </label>
      <div>
        <SubmitButton pendingText="Uploading…">Add the contract</SubmitButton>
      </div>
    </ActionForm>
  );
}

// ---------------------------------------------------------------- 5. the link

export function LinkPanel({
  clientId,
  contactName,
  email,
  language,
  sellerName,
  hasActiveLink,
}: {
  clientId: string;
  contactName: string;
  email: string | null;
  language: string;
  sellerName: string;
  hasActiveLink: boolean;
}) {
  const [link, setLink] = useState<{ url: string; days: number } | null>(null);
  const [days, setDays] = useState(14);
  const [sentVia, setSentVia] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();
  const first = contactName.split(/\s+/)[0] || contactName;

  const message = (url: string) =>
    language === "en"
      ? `Hi ${first},\n\nWelcome to Magik! Here is your personal link to open your account and finish setting up (your brand and the videos you like):\n${url}\n\nThe link works for ${days} days.\n\nTalk soon,\n${sellerName}`
      : `Bonjour ${first},\n\nBienvenue chez Magik ! Voici votre lien personnel pour ouvrir votre compte et compléter votre intégration (votre marque et les vidéos que vous aimez) :\n${url}\n\nLe lien est valide ${days} jours.\n\nÀ très vite,\n${sellerName}`;
  const subject = language === "en" ? "Your Magik account" : "Votre compte Magik";

  const sent = (via: "copy" | "email" | "sms" | "share") => {
    setSentVia(via);
    startTransition(async () => {
      await markInviteSent({ clientId, via });
    });
  };

  if (!link) {
    return (
      <ActionForm
        action={createInviteLink}
        onSuccess={(r) => r.data?.link && setLink({ url: r.data.link, days })}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="clientId" value={clientId} />
        <Field label="The link works for" hint="Single use: it opens one account, then stops working.">
          <Select name="days" value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-48">
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </Select>
        </Field>
        {hasActiveLink && (
          <p className="rounded-[12px] bg-warning-soft px-3.5 py-2.5 text-[13px] text-warning">
            A link is already out. A new one replaces it: the old link stops working.
          </p>
        )}
        <div>
          <SubmitButton pendingText="Creating…">{hasActiveLink ? "Create a new link" : "Create the link"}</SubmitButton>
        </div>
      </ActionForm>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[16px] bg-white/[0.05] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
        <p className="text-[12px] font-semibold tracking-wide text-muted uppercase">{contactName}&apos;s link</p>
        <div className="mt-2 flex gap-2">
          <Input readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-[12.5px]" aria-label="The link" />
          <Button
            type="button"
            variant="primary"
            onClick={async () => {
              await navigator.clipboard.writeText(link.url).catch(() => {});
              setCopied(true);
              sent("copy");
            }}
          >
            {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <p className="mt-2 text-[12px] text-muted">For security, the link is shown only now. If it&apos;s lost, create a new one.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.08] px-4 text-[13.5px] font-medium text-ink hover:bg-white/[0.13]"
          href={`mailto:${email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message(link.url))}`}
          onClick={() => sent("email")}
        >
          <Mail size={15} aria-hidden /> Email it
        </a>
        <a
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.08] px-4 text-[13.5px] font-medium text-ink hover:bg-white/[0.13]"
          href={`sms:?&body=${encodeURIComponent(message(link.url))}`}
          onClick={() => sent("sms")}
        >
          <MessageSquare size={15} aria-hidden /> Text it
        </a>
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            if (navigator.share) {
              try {
                await navigator.share({ title: subject, text: message(link.url) });
                sent("share");
              } catch {}
            } else {
              await navigator.clipboard.writeText(message(link.url)).catch(() => {});
              sent("copy");
            }
          }}
        >
          <Share2 size={15} aria-hidden /> {typeof navigator !== "undefined" && "share" in navigator ? "Share…" : "Copy the message"}
        </Button>
      </div>
      {sentVia && (
        <p role="status" className="text-[13px] text-success">
          Sent. The client takes it from here: their progress shows up in the client steps.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- the studio's invoice details

type Settings = {
  business_name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  currency: string;
  taxes: { name: string; rate: number; number: string }[];
  payment_terms_days: number;
  payment_instructions: string | null;
  invoice_prefix: string;
};

export function StudioSettingsForm({ settings }: { settings: Settings }) {
  const taxes = [...settings.taxes, { name: "", rate: 0, number: "" }, { name: "", rate: 0, number: "" }].slice(0, 3);
  return (
    <ActionForm action={saveStudioSettings} className="grid gap-4 @min-[40rem]:grid-cols-2">
      <Field label="Business name">
        <Input name="businessName" defaultValue={settings.business_name} />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" defaultValue={settings.email ?? ""} placeholder="factures@magik.studio" />
      </Field>
      <Field label="Phone">
        <Input name="phone" defaultValue={settings.phone ?? ""} />
      </Field>
      <Field label="Website">
        <Input name="website" defaultValue={settings.website ?? ""} />
      </Field>
      <Field label="Address" className="@min-[40rem]:col-span-2">
        <Textarea name="address" rows={2} defaultValue={settings.address ?? ""} />
      </Field>
      <div className="@min-[40rem]:col-span-2">
        <p className="mb-1.5 text-[13px] font-medium text-ink-2">Taxes</p>
        <div className="flex flex-col gap-2">
          {taxes.map((t, i) => (
            <div key={i} className="grid grid-cols-[1fr_0.8fr_2fr] gap-2">
              <Input name={`taxName${i}`} defaultValue={t.name} placeholder="Name (TPS)" aria-label={`Tax ${i + 1} name`} />
              <Input name={`taxRate${i}`} defaultValue={t.name ? String(t.rate) : ""} placeholder="Rate %" inputMode="decimal" aria-label={`Tax ${i + 1} rate`} />
              <Input name={`taxNumber${i}`} defaultValue={t.number} placeholder="Registration number" aria-label={`Tax ${i + 1} number`} />
            </div>
          ))}
        </div>
      </div>
      <Field label="Currency">
        <Select name="currency" defaultValue={settings.currency}>
          <option value="CAD">CAD</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </Select>
      </Field>
      <Field label="Payment terms (days)">
        <Input name="paymentTerms" inputMode="numeric" defaultValue={settings.payment_terms_days} />
      </Field>
      <Field label="Invoice number prefix">
        <Input name="invoicePrefix" defaultValue={settings.invoice_prefix} />
      </Field>
      <Field label="How to pay" hint="Printed on every invoice (Interac e-transfer, bank details…)." className="@min-[40rem]:col-span-2">
        <Textarea name="paymentInstructions" rows={3} defaultValue={settings.payment_instructions ?? ""} />
      </Field>
      <div className="flex justify-end @min-[40rem]:col-span-2">
        <SubmitButton pendingText="Saving…">Save invoice details</SubmitButton>
      </div>
    </ActionForm>
  );
}
