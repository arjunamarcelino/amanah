"use client";

import { cn } from "@amanah/ui/lib/utils";
import type { OperatorStep, OperatorStepName } from "@/lib/console/operatorStep";

// Visible operator workflow: Donations → Release condition → Unlock (T+N) → Release tranche →
// Route payout. The current OperatorStep maps to one node; earlier nodes are done, later ones
// upcoming. Read-only guidance — the actual actions live in the cards below.
const STEPS: { label: string }[] = [
  { label: "Donations" },
  { label: "Release condition" },
  { label: "Unlock (T+N)" },
  { label: "Release tranche" },
  { label: "Route payout" },
];

// Which node the operator is on (index into STEPS); `paid` is past the last node (all done).
const CURRENT_INDEX: Record<OperatorStepName, number> = {
  awaiting_donations: 0,
  needs_trigger: 1,
  awaiting_unlock: 2,
  can_release: 3,
  // Everything released and nothing pending to route → all nodes done (NOT "Route payout"
  // active, which would imply a routable tranche that doesn't exist in this state).
  fully_released: STEPS.length,
  can_route: 4,
  paid: STEPS.length,
};

export function OperatorStepper({ step }: { step: OperatorStep }) {
  const current = CURRENT_INDEX[step.step];
  return (
    <ol className="flex items-start gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-5 shadow-sm">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const isLast = i === STEPS.length - 1;
        return (
          <li key={s.label} className={cn("flex min-w-[5.5rem] items-start", !isLast && "flex-1")}>
            <div className="flex flex-1 flex-col items-center gap-2 text-center">
              <span
                className={cn(
                  "inline-flex size-9 items-center justify-center rounded-full border text-sm font-semibold",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary ring-4 ring-primary/15",
                  !done && !active && "border-border text-muted-foreground",
                )}
              >
                {done ? <Check /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-xs font-medium leading-tight",
                  active ? "text-foreground" : done ? "text-foreground-soft" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </div>
            {!isLast ? (
              <span className={cn("mt-[1.1rem] h-0.5 w-full flex-1 rounded", done ? "bg-primary" : "bg-border")} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-4">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
