import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarClock, Check, FileText, Plus, Receipt } from "lucide-react";
import type { ActivityRow, InvoiceRow, OnboardingRow, Overview, TodayItem, VideoRow } from "@/lib/home";
import { cx } from "@/components/ui";
import { formatCalendarDate } from "@/lib/dates";
import { Ago, TodayTime } from "@/components/home/time";
import { PanelLights } from "@/components/home/widget";
import { friendlyError } from "@/lib/errors";

// Home's panels: glass windows like the apps', each a summary that opens its app.

export function Panel({
  id,
  href,
  title,
  icon,
  action,
  children,
  className,
}: {
  // The widget's name for hiding and folding it, and the app its green light opens.
  id: string;
  href?: string;
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("home-panel material-window flex min-h-0 flex-col overflow-hidden rounded-[24px]", className)}>
      <header className="flex h-[48px] shrink-0 items-center gap-3 border-b border-white/[0.06] px-4">
        <PanelLights id={id} href={href} title={title} />
        <h2 className="flex min-w-0 flex-1 items-center gap-2 text-[15px] font-semibold text-ink">
          {icon}
          <span className="truncate">{title}</span>
        </h2>
        {action}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </section>
  );
}

function SeeAll({ href, label = "See all" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="shrink-0 text-[12.5px] font-medium text-accent hover:underline">
      {label}
    </Link>
  );
}

// ------------------------------------------------------------------ Today

export function TodayPanel({ items, href }: { items: TodayItem[]; href: string }) {
  return (
    <Panel id="today" href={href} title="Today" action={<SeeAll href={href} />} className="h-full">
      {items.length === 0 ? (
        <p className="px-5 py-6 text-[13.5px] text-muted">Nothing scheduled this week. Enjoy the calm.</p>
      ) : (
        <ol className="relative px-4 py-3">
          <span aria-hidden className="absolute top-6 bottom-6 left-[88px] w-px bg-white/10" />
          {items.map((it, i) => (
            <li key={i}>
              <Link href={it.href} className="group grid grid-cols-[64px_16px_1fr] items-start gap-2 rounded-[12px] px-1 py-2 hover:bg-white/[0.05]">
                <span className="pt-0.5 text-right text-[12px] text-muted tabular-nums">
                  <TodayTime at={it.at} allDay={it.allDay} />
                </span>
                <span className="flex justify-center pt-1.5">
                  <span
                    className={cx(
                      "relative z-10 h-[9px] w-[9px] rounded-full ring-[3px] ring-[rgba(26,26,29,0.9)]",
                      it.tone === "accent" ? "bg-accent" : it.tone === "danger" ? "bg-danger" : it.tone === "info" ? "bg-info" : "bg-white/50",
                    )}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium text-ink group-hover:text-white">{it.title}</span>
                  <span className="block truncate text-[12px] text-muted">{it.detail}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------ Overview

export function OverviewPanel({ data, href }: { data: Overview; href?: string }) {
  return (
    <Panel id="overview" href={href} title={data.title}>
      <div className="px-5 pt-4">
        <p className="text-[12.5px] text-muted">{data.label}</p>
        <div className="mt-1 flex items-baseline gap-2.5">
          <span className="font-display text-[34px] leading-none font-bold tracking-tight text-ink tabular-nums">{data.value}</span>
          {data.delta !== null && (
            <span className={cx("flex items-center text-[13px] font-semibold", data.delta >= 0 ? "text-success" : "text-danger")}>
              {data.delta >= 0 ? <ArrowUpRight size={14} aria-hidden /> : <ArrowDownRight size={14} aria-hidden />}
              {Math.abs(data.delta)}%
            </span>
          )}
        </div>
        <AreaChart points={data.chart} money={data.money} />
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pt-1 pb-4">
        {data.kpis.map((k) => (
          <Link
            key={k.label}
            href={k.href}
            className="rounded-[14px] bg-white/[0.05] px-3.5 py-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] transition-colors hover:bg-white/[0.09]"
          >
            <span className={cx("block font-display text-[22px] leading-none font-bold tabular-nums", k.tone === "accent" ? "text-accent" : k.tone === "success" ? "text-success" : "text-ink")}>
              {k.value}
            </span>
            <span className="mt-1 block truncate text-[12px] text-muted">{k.label}</span>
          </Link>
        ))}
      </div>
    </Panel>
  );
}

// A smooth gold line over a soft fill: the last 8 weeks.
function AreaChart({ points, money }: { points: { label: string; value: number }[]; money: boolean }) {
  const W = 600;
  const H = 150;
  const pad = { l: 4, r: 44, t: 12, b: 22 };
  const max = Math.max(1, ...points.map((p) => p.value));
  const top = niceCeil(max);
  const x = (i: number) => pad.l + (i / Math.max(1, points.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const pts = points.map((p, i) => [x(i), y(p.value)] as const);
  const line = smooth(pts);
  const area = `${line} L${x(points.length - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`;
  const last = pts[pts.length - 1];
  const fmt = (v: number) => (money ? (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`) : String(Math.round(v)));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="The last 8 weeks">
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f6d43a" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#f6d43a" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.5, 1].map((f) => (
        <g key={f}>
          <line x1={pad.l} x2={W - pad.r} y1={y(top * f)} y2={y(top * f)} stroke="rgba(255,255,255,0.07)" />
          <text x={W - pad.r + 8} y={y(top * f) + 4} fill="rgba(235,235,245,0.45)" fontSize="11">
            {fmt(top * f)}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#chartFill)" />
      <path d={line} fill="none" stroke="#f6d43a" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="9" fill="#f6d43a" opacity="0.18" />
      <circle cx={last[0]} cy={last[1]} r="4.5" fill="#f6d43a" stroke="#1a1a1d" strokeWidth="2" />
      {points.map((p, i) =>
        i % 2 === 1 || i === points.length - 1 ? (
          <text key={i} x={x(i)} y={H - 4} textAnchor="middle" fill="rgba(235,235,245,0.45)" fontSize="11">
            {p.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

function niceCeil(v: number) {
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * exp;
}

// Catmull-Rom through the points, as cubic Béziers.
function smooth(pts: readonly (readonly [number, number])[]) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

// ------------------------------------------------------------------ Production

const STATUS_TONE: Record<string, string> = {
  script: "bg-white/10 text-ink-2",
  shoot: "bg-[#ff9f0a]/15 text-[#ffb547]",
  footage_in: "bg-[#ff9f0a]/15 text-[#ffb547]",
  editing: "bg-accent-soft text-accent",
  editor_check: "bg-accent-soft text-accent",
  client_review: "bg-info-soft text-[#64b5ff]",
  approved: "bg-success-soft text-success",
  delivered: "bg-success-soft text-success",
};

export function VideoList({ rows, empty }: { rows: VideoRow[]; empty: string }) {
  if (!rows.length) return <p className="px-5 py-6 text-[13.5px] text-muted">{empty}</p>;
  return (
    <ul className="flex flex-col gap-1 p-2.5">
      {rows.map((v) => (
        <li key={v.id}>
          <Link href={v.href} className="group flex items-center gap-3 rounded-[14px] px-2.5 py-2.5 hover:bg-white/[0.05]">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-ink">{v.title}</p>
              <p className="truncate text-[12px] text-muted">{v.client}</p>
            </div>
            <div className="flex w-[132px] shrink-0 flex-col items-end gap-1.5">
              <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_TONE[v.status] ?? "bg-white/10 text-ink-2")}>{v.statusLabel}</span>
              <span className="flex w-full items-center gap-2">
                <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full bg-gradient-to-r from-[#d9a60c] to-accent" style={{ width: `${v.progress}%` }} />
                </span>
                <span className="w-8 text-right text-[11px] text-muted tabular-nums">{v.progress}%</span>
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ProductionPanel({ rows, deadlines, href }: { rows: VideoRow[]; deadlines: VideoRow[]; href: string }) {
  return (
    <Panel id="production" href={href} title="Production" action={<SeeAll href={href} />}>
      <VideoList rows={rows} empty="No video in production right now." />
      {deadlines.length > 0 && (
        <div className="border-t border-white/[0.06] px-4 pt-3 pb-3">
          <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-muted uppercase">Upcoming deadlines</p>
          <ul>
            {deadlines.map((d) => (
              <li key={d.id}>
                <Link href={d.href} className="flex items-center gap-3 rounded-[10px] px-1 py-1.5 text-[13px] hover:bg-white/[0.05]">
                  <CalendarClock size={14} className="shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-ink-2">
                    {d.title} <span className="text-muted">· {d.client}</span>
                  </span>
                  <span className="shrink-0 text-[12px] text-muted">{d.due ? formatCalendarDate(d.due) : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------ Onboarding

export function OnboardingPanel({ rows, open, waiting }: { rows: OnboardingRow[]; open: number; waiting: number }) {
  return (
    <Panel
      id="onboarding"
      href="/onboarding"
      title="Onboarding"
      action={
        <Link href="/onboarding/new" className="flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-[12.5px] font-semibold text-black hover:brightness-105">
          <Plus size={14} aria-hidden /> New client
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-2 px-4 pt-4">
        <Stat value={open} label="In progress" tone="accent" />
        <Stat value={waiting} label="Waiting on clients" />
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-5 text-[13.5px] text-muted">No client in onboarding. Start one with New client.</p>
      ) : (
        <ul className="flex flex-col gap-1 p-2.5">
          {rows.map((o) => (
            <li key={o.id}>
              <Link href={o.href} className="flex items-center gap-3 rounded-[14px] px-2.5 py-2.5 hover:bg-white/[0.05]">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-ink">{o.name}</p>
                  <p className="truncate text-[12px] text-muted">{o.waiting === "seller" ? `Your turn: ${o.label}` : `The client: ${o.label}`}</p>
                </div>
                <div className="flex w-[110px] shrink-0 flex-col items-end gap-1.5">
                  <span className="text-[11px] text-muted tabular-nums">{o.done} of 10</span>
                  <span className="h-[5px] w-full overflow-hidden rounded-full bg-white/10">
                    <span className={cx("block h-full rounded-full", o.waiting === "seller" ? "bg-accent" : "bg-success")} style={{ width: `${o.done * 10}%` }} />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Stat({ value, label, tone }: { value: number | string; label: string; tone?: "accent" }) {
  return (
    <div className="rounded-[14px] bg-white/[0.05] px-3.5 py-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
      <span className={cx("block font-display text-[22px] leading-none font-bold tabular-nums", tone === "accent" ? "text-accent" : "text-ink")}>{value}</span>
      <span className="mt-1 block truncate text-[12px] text-muted">{label}</span>
    </div>
  );
}

// ------------------------------------------------------------------ Invoices

const money = (cents: number, currency: string) => new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(cents / 100);

export function InvoicesPanel({ rows, outstanding, currency }: { rows: InvoiceRow[]; outstanding: number; currency: string }) {
  return (
    <Panel id="invoices" href="/onboarding/invoices" title="Invoices" action={<SeeAll href="/onboarding/invoices" />}>
      <div className="px-5 pt-4">
        <p className="text-[12.5px] text-muted">Outstanding</p>
        <p className="mt-1 font-display text-[30px] leading-none font-bold text-ink tabular-nums">{money(outstanding, currency)}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-5 text-[13.5px] text-muted">Everything is paid.</p>
      ) : (
        <ul className="flex flex-col gap-1 p-2.5">
          {rows.map((i) => (
            <li key={i.id}>
              <a href={`/invoices/${i.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-[14px] px-2.5 py-2 hover:bg-white/[0.05]">
                <Receipt size={16} className="shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ink">{i.client}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {i.number}
                    {i.due && ` · due ${formatCalendarDate(i.due)}`}
                  </span>
                </span>
                <span className="text-[13.5px] font-semibold text-ink tabular-nums">{money(i.total, i.currency)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------ Activity

export function ActivityPanel({ rows }: { rows: ActivityRow[] }) {
  return (
    <Panel id="activity" href="/notifications" title="Recent activity" action={<SeeAll href="/notifications" />}>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-[13.5px] text-muted">You&apos;re all caught up.</p>
      ) : (
        <ul className="flex flex-col p-2.5">
          {rows.map((n) => {
            const inner = (
              <>
                <span className={cx("mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full", n.unread ? "bg-accent" : "bg-white/15")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ink">{n.title}</span>
                  {n.body && <span className="block truncate text-[12px] text-muted">{friendlyError(n.body)}</span>}
                </span>
                <span className="shrink-0 pt-0.5 text-[11.5px] text-muted">
                  <Ago at={n.at} />
                </span>
              </>
            );
            return (
              <li key={n.id}>
                {n.href ? (
                  <Link href={n.href} className="flex gap-2.5 rounded-[12px] px-2.5 py-2 hover:bg-white/[0.05]">
                    {inner}
                  </Link>
                ) : (
                  <div className="flex gap-2.5 px-2.5 py-2">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------ for clients

export function ClientBrandPanel({ logo, colors, fonts }: { logo: string | null; colors: string[]; fonts: string[] }) {
  return (
    <Panel id="brand" href="/brand" title="Your brand" action={<SeeAll href="/brand" label="Open" />}>
      <div className="flex flex-col gap-4 p-5">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="Your logo" className="h-32 w-full rounded-[16px] bg-white object-contain p-5" />
        ) : (
          <p className="text-[13.5px] text-muted">No logo yet.</p>
        )}
        {colors.length > 0 && (
          <div className="flex gap-2">
            {colors.map((c) => (
              <span key={c} title={c} className="h-8 w-8 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)]" style={{ background: c }} />
            ))}
          </div>
        )}
        {fonts.length > 0 && <p className="text-[13px] text-muted">{fonts.join(", ")}</p>}
      </div>
    </Panel>
  );
}

export function ClientDocumentsPanel({ invoice, contract }: { invoice: InvoiceRow | null; contract: { name: string; signed: boolean } | null }) {
  return (
    <Panel id="documents" href="/account/documents" title="Documents" action={<SeeAll href="/account/documents" label="Open" />}>
      <ul className="flex flex-col gap-1 p-2.5">
        <li>
          {invoice ? (
            <a href={`/invoices/${invoice.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-[14px] px-2.5 py-2.5 hover:bg-white/[0.05]">
              <Receipt size={18} className="shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-ink">Invoice {invoice.number}</span>
                <span className="block text-[12px] text-muted">{invoice.status === "paid" ? "Paid" : invoice.due ? `To pay by ${formatCalendarDate(invoice.due, "date")}` : "To pay"}</span>
              </span>
              <span className="text-[14px] font-semibold text-ink tabular-nums">{money(invoice.total, invoice.currency)}</span>
            </a>
          ) : (
            <p className="px-2.5 py-2.5 text-[13.5px] text-muted">No invoice yet.</p>
          )}
        </li>
        {contract && (
          <li className="flex items-center gap-3 rounded-[14px] px-2.5 py-2.5">
            <FileText size={18} className="shrink-0 text-muted" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{contract.name}</span>
            <span className={cx("flex items-center gap-1 text-[12px] font-semibold", contract.signed ? "text-success" : "text-warning")}>
              {contract.signed && <Check size={13} strokeWidth={3} aria-hidden />}
              {contract.signed ? "Signed" : "To sign"}
            </span>
          </li>
        )}
      </ul>
    </Panel>
  );
}

