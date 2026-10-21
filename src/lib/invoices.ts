// Invoices: the numbers are always computed here, never written by Claude. Claude (when it's
// connected) only words the line's detail and the note, in the client's language.

export type InvoiceLine = { description: string; detail: string; quantity: number; unit_cents: number };
export type InvoiceTax = { name: string; rate: number; number: string; amount_cents: number };
export type TaxSetting = { name: string; rate: number; number: string };
export type Party = { name: string; contact?: string | null; email?: string | null; phone?: string | null; address?: string | null; website?: string | null };
export type Issuer = Party & { taxes: TaxSetting[]; payment_instructions?: string | null };
export type Lang = "fr" | "en";

export type PackForInvoice = {
  name: string;
  description: string | null;
  price_cents: number;
  billing: string;
  videos_per_month: number | null;
  revision_rounds: number;
  features: string[];
};

export function readTaxes(raw: unknown): TaxSetting[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => ({
      name: typeof t?.name === "string" ? t.name.trim() : "",
      rate: Number(t?.rate),
      number: typeof t?.number === "string" ? t.number.trim() : "",
    }))
    .filter((t) => t.name && Number.isFinite(t.rate) && t.rate >= 0 && t.rate <= 50);
}

export function totals(lines: InvoiceLine[], taxes: TaxSetting[]) {
  const subtotal = lines.reduce((sum, l) => sum + Math.round(l.quantity * l.unit_cents), 0);
  const taxLines: InvoiceTax[] = taxes.map((t) => ({ ...t, amount_cents: Math.round((subtotal * t.rate) / 100) }));
  const total = subtotal + taxLines.reduce((sum, t) => sum + t.amount_cents, 0);
  return { subtotal, taxLines, total };
}

// What the pack includes, in plain words: the line's detail when Claude doesn't write it.
export function packDetail(pack: PackForInvoice, lang: Lang) {
  const parts: string[] = [];
  if (pack.videos_per_month) {
    parts.push(lang === "fr" ? `${pack.videos_per_month} vidéo${pack.videos_per_month > 1 ? "s" : ""} par mois` : `${pack.videos_per_month} video${pack.videos_per_month > 1 ? "s" : ""} a month`);
  }
  parts.push(
    lang === "fr"
      ? `${pack.revision_rounds} ronde${pack.revision_rounds > 1 ? "s" : ""} de modifications`
      : `${pack.revision_rounds} revision round${pack.revision_rounds === 1 ? "" : "s"}`,
  );
  parts.push(...pack.features.slice(0, 6));
  return parts.join(" · ");
}

export function packLine(pack: PackForInvoice, lang: Lang, detail?: string): InvoiceLine {
  const monthly = pack.billing === "monthly";
  return {
    description: monthly ? `${pack.name} — ${lang === "fr" ? "forfait mensuel" : "monthly plan"}` : pack.name,
    detail: detail?.trim() || packDetail(pack, lang),
    quantity: 1,
    unit_cents: pack.price_cents,
  };
}

export function defaultNote(lang: Lang, terms: number) {
  return lang === "fr"
    ? `Merci de votre confiance. Paiement dû dans les ${terms} jours suivant la date de facturation.`
    : `Thank you for your trust. Payment is due within ${terms} days of the invoice date.`;
}

export const INVOICE_LABELS: Record<Lang, Record<string, string>> = {
  fr: {
    invoice: "Facture",
    number: "N° de facture",
    issued: "Date",
    due: "Échéance",
    billTo: "Facturé à",
    from: "De",
    description: "Description",
    qty: "Qté",
    unit: "Prix unitaire",
    amount: "Montant",
    subtotal: "Sous-total",
    total: "Total",
    notes: "Notes",
    payment: "Paiement",
    taxNumbers: "Numéros de taxes",
    paid: "Payée",
    void: "Annulée",
  },
  en: {
    invoice: "Invoice",
    number: "Invoice no.",
    issued: "Date",
    due: "Due",
    billTo: "Bill to",
    from: "From",
    description: "Description",
    qty: "Qty",
    unit: "Unit price",
    amount: "Amount",
    subtotal: "Subtotal",
    total: "Total",
    notes: "Notes",
    payment: "Payment",
    taxNumbers: "Tax numbers",
    paid: "Paid",
    void: "Void",
  },
};

export function money(cents: number, currency: string, lang: Lang) {
  return new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency }).format(cents / 100);
}

export function readLines(raw: unknown): InvoiceLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((l) => ({
    description: String(l?.description ?? ""),
    detail: String(l?.detail ?? ""),
    quantity: Number(l?.quantity) || 1,
    unit_cents: Math.round(Number(l?.unit_cents) || 0),
  }));
}

export function readTaxLines(raw: unknown): InvoiceTax[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => ({
    name: String(t?.name ?? ""),
    rate: Number(t?.rate) || 0,
    number: String(t?.number ?? ""),
    amount_cents: Math.round(Number(t?.amount_cents) || 0),
  }));
}
