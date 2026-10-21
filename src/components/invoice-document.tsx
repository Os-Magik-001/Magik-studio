import Image from "next/image";
import { INVOICE_LABELS, money, readLines, readTaxLines, type Lang } from "@/lib/invoices";

export type InvoiceRow = {
  number: string;
  status: string;
  issued_on: string;
  due_on: string | null;
  currency: string;
  lines: unknown;
  taxes: unknown;
  subtotal_cents: number;
  total_cents: number;
  notes: string | null;
  language: string;
  bill_to: unknown;
  issuer: unknown;
};

type Party = { name?: string; contact?: string | null; email?: string | null; phone?: string | null; address?: string | null; website?: string | null };

const longDate = (iso: string, lang: Lang) =>
  new Intl.DateTimeFormat(lang === "fr" ? "fr-CA" : "en-CA", { dateStyle: "long", timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));

// The invoice as the client receives it: a white page that prints (or saves as PDF) cleanly.
// The studio's own document: no mention of how it was made.
export function InvoiceDocument({ invoice }: { invoice: InvoiceRow }) {
  const lang: Lang = invoice.language === "en" ? "en" : "fr";
  const L = INVOICE_LABELS[lang];
  const lines = readLines(invoice.lines);
  const taxes = readTaxLines(invoice.taxes);
  const to = (invoice.bill_to ?? {}) as Party;
  const from = (invoice.issuer ?? {}) as Party & { payment_instructions?: string | null; taxes?: { name: string; number: string }[] };
  const m = (c: number) => money(c, invoice.currency, lang);
  const stamp = invoice.status === "paid" ? L.paid : invoice.status === "void" ? L.void : null;

  return (
    <article className="relative mx-auto w-full max-w-[820px] bg-white px-10 py-12 text-[13px] leading-relaxed text-[#1d1d1f] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] print:max-w-none print:px-0 print:py-0 print:shadow-none sm:px-14">
      {stamp && (
        <div
          aria-label={stamp}
          className={`absolute top-28 right-12 rotate-[-12deg] rounded-md border-[3px] px-4 py-1 text-[22px] font-extrabold tracking-[0.2em] uppercase ${invoice.status === "paid" ? "border-[#1f9d55] text-[#1f9d55]" : "border-[#c62828] text-[#c62828]"}`}
        >
          {stamp}
        </div>
      )}
      <header className="flex items-start justify-between gap-6">
        <Image src="/brand/magik-horizontal-dark.svg" alt={from.name ?? "Magik"} width={190} height={41} unoptimized className="h-auto w-[190px]" />
        <div className="text-right">
          <h1 className="font-display text-[30px] leading-none font-bold tracking-tight uppercase">{L.invoice}</h1>
          <p className="mt-2 text-[13px] text-[#6e6e73]">
            {L.number} <span className="font-semibold text-[#1d1d1f]">{invoice.number}</span>
          </p>
        </div>
      </header>
      <div className="mt-3 h-[3px] w-16 bg-[#F6D43A]" />

      <section className="mt-10 grid grid-cols-2 gap-8">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[#6e6e73] uppercase">{L.from}</p>
          <PartyBlock party={from} />
        </div>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[#6e6e73] uppercase">{L.billTo}</p>
          <PartyBlock party={to} />
        </div>
      </section>

      <section className="mt-8 flex gap-10 border-y border-[#e5e5ea] py-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[#6e6e73] uppercase">{L.issued}</p>
          <p className="mt-0.5 font-medium">{longDate(invoice.issued_on, lang)}</p>
        </div>
        {invoice.due_on && (
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-[#6e6e73] uppercase">{L.due}</p>
            <p className="mt-0.5 font-medium">{longDate(invoice.due_on, lang)}</p>
          </div>
        )}
        <div className="ml-auto text-right">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[#6e6e73] uppercase">{L.total}</p>
          <p className="mt-0.5 text-[18px] font-bold tabular-nums">{m(invoice.total_cents)}</p>
        </div>
      </section>

      <table className="mt-8 w-full border-collapse">
        <thead>
          <tr className="text-left text-[11px] font-semibold tracking-[0.12em] text-[#6e6e73] uppercase">
            <th className="pb-2 font-semibold">{L.description}</th>
            <th className="w-14 pb-2 text-right font-semibold">{L.qty}</th>
            <th className="w-32 pb-2 text-right font-semibold">{L.unit}</th>
            <th className="w-32 pb-2 text-right font-semibold">{L.amount}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-t border-[#e5e5ea] align-top">
              <td className="py-3 pr-4">
                <p className="font-semibold">{l.description}</p>
                {l.detail && <p className="mt-0.5 text-[12.5px] text-[#6e6e73]">{l.detail}</p>}
              </td>
              <td className="py-3 text-right tabular-nums">{l.quantity}</td>
              <td className="py-3 text-right tabular-nums">{m(l.unit_cents)}</td>
              <td className="py-3 text-right font-medium tabular-nums">{m(Math.round(l.quantity * l.unit_cents))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-2 ml-auto w-full max-w-[300px] border-t border-[#e5e5ea] pt-3">
        <Row label={L.subtotal} value={m(invoice.subtotal_cents)} />
        {taxes.map((t) => (
          <Row key={t.name} label={`${t.name} (${t.rate.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA")} %)`} value={m(t.amount_cents)} />
        ))}
        <div className="mt-2 flex items-baseline justify-between border-t-2 border-[#1d1d1f] pt-2">
          <span className="text-[14px] font-bold">{L.total}</span>
          <span className="text-[18px] font-bold tabular-nums">{m(invoice.total_cents)}</span>
        </div>
      </section>

      <footer className="mt-12 grid gap-6 text-[12.5px] text-[#3a3a3c] sm:grid-cols-2">
        {invoice.notes && (
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-[#6e6e73] uppercase">{L.notes}</p>
            <p className="mt-1 whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}
        {from.payment_instructions && (
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-[#6e6e73] uppercase">{L.payment}</p>
            <p className="mt-1 whitespace-pre-line">{from.payment_instructions}</p>
          </div>
        )}
        {!!from.taxes?.some((t) => t.number) && (
          <div className="sm:col-span-2">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-[#6e6e73] uppercase">{L.taxNumbers}</p>
            <p className="mt-1">
              {from.taxes
                .filter((t) => t.number)
                .map((t) => `${t.name} ${t.number}`)
                .join(" · ")}
            </p>
          </div>
        )}
      </footer>
    </article>
  );
}

function PartyBlock({ party }: { party: Party }) {
  return (
    <div className="mt-1.5">
      <p className="text-[14px] font-semibold">{party.name}</p>
      {party.contact && <p>{party.contact}</p>}
      {party.address && <p className="whitespace-pre-line text-[#3a3a3c]">{party.address}</p>}
      {party.email && <p className="text-[#3a3a3c]">{party.email}</p>}
      {party.phone && <p className="text-[#3a3a3c]">{party.phone}</p>}
      {party.website && <p className="text-[#3a3a3c]">{party.website}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className="text-[#6e6e73]">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

