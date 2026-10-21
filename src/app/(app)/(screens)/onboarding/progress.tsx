import Link from "next/link";
import { Check } from "lucide-react";
import { cx } from "@/components/ui";
import { SegmentedNav } from "@/components/segmented";
import { STEPS, stepsDone, type OnboardingFacts, type StepKey } from "@/lib/onboarding";

// The Onboarding app's three tabs.
export function OnboardingTabs({ active }: { active: "clients" | "packs" | "invoices" }) {
  return (
    <div className="mb-6">
      <SegmentedNav
        active={active}
        items={[
          { key: "clients", label: "Clients", href: "/onboarding" },
          { key: "packs", label: "Packs", href: "/onboarding/packs" },
          { key: "invoices", label: "Invoices", href: "/onboarding/invoices" },
        ]}
      />
    </div>
  );
}

// Ten dots: the seller's five steps, then the client's five.
export function LaneProgress({ facts, current }: { facts: OnboardingFacts; current: StepKey | "done" }) {
  const done = stepsDone(facts);
  return (
    <div className="flex items-center gap-1" aria-label={`${STEPS.filter((s) => done[s.key]).length} of ${STEPS.length} steps done`}>
      {STEPS.map((s, i) => (
        <span key={s.key} className="flex items-center">
          {i === 5 && <span aria-hidden className="mx-1 h-3 w-px bg-white/20" />}
          <span
            title={s.label}
            className={cx(
              "block h-[7px] w-[7px] rounded-full",
              done[s.key] ? (s.lane === "seller" ? "bg-accent" : "bg-success") : current === s.key ? "bg-white/70 ring-2 ring-white/25" : "bg-white/15",
            )}
          />
        </span>
      ))}
    </div>
  );
}

// The client's file: the two lanes as a sidebar, each step a link.
// clientId null: a client not created yet (the first step of a new client).
export function StepRail({ clientId, facts, active, current }: { clientId: string | null; facts: OnboardingFacts; active: StepKey; current: StepKey | "done" }) {
  const done = stepsDone(facts);
  const lane = (key: "seller" | "client", title: string) => (
    <div>
      <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">{title}</p>
      <ol className="flex flex-col gap-0.5">
        {STEPS.filter((s) => s.lane === key).map((s) => {
          const i = STEPS.findIndex((x) => x.key === s.key) + 1;
          return (
            <li key={s.key}>
              <Link
                href={clientId ? `/onboarding/${clientId}?step=${s.key}` : "/onboarding/new"}
                aria-current={active === s.key ? "step" : undefined}
                aria-disabled={!clientId && s.key !== "infos" ? true : undefined}
                className={cx(
                  "flex items-center gap-3 rounded-[12px] px-3 py-2 transition-colors",
                  active === s.key ? "bg-white/[0.12]" : "hover:bg-white/[0.06]",
                  !clientId && s.key !== "infos" && "pointer-events-none opacity-50",
                )}
              >
                <span
                  className={cx(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    done[s.key]
                      ? s.lane === "seller"
                        ? "bg-accent text-black"
                        : "bg-success text-black"
                      : current === s.key
                        ? "text-ink shadow-[inset_0_0_0_1.5px_var(--accent)]"
                        : "text-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]",
                  )}
                >
                  {done[s.key] ? <Check size={13} strokeWidth={3} aria-label="Done" /> : i}
                </span>
                <span className="min-w-0">
                  <span className={cx("block truncate text-[13px] font-medium", active === s.key ? "text-ink" : "text-ink-2")}>{s.label}</span>
                  <span className="block truncate text-[11.5px] text-muted">{s.hint}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
  return (
    <nav aria-label="Onboarding steps" className="flex flex-col gap-4">
      {lane("seller", "Seller")}
      {lane("client", "Client")}
    </nav>
  );
}
