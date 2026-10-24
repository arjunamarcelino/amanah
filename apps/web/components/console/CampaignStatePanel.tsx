"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@amanah/ui/card";
import { CONSOLE_CARD } from "@/lib/console/ui";
import { Badge } from "@amanah/ui/badge";
import { formatTokenAmount } from "@/lib/amount";
import type { OperatorStep } from "@/lib/console/operatorStep";

// Thin read-only reconstruction of "where this campaign is" — renders deriveOperatorStep's
// output plus the headline totals. Enum-keyed label map (never interpolate the step string).
const STEP_LABEL: Record<OperatorStep["step"], string> = {
  awaiting_donations: "Awaiting donations",
  needs_trigger: "Awaiting release condition",
  awaiting_unlock: "Time-locked (T+N)",
  fully_released: "Fully released",
  can_release: "Ready to release",
  can_route: "Ready to route payout",
  paid: "Paid",
};

export function CampaignStatePanel({
  step,
  donated,
  released,
  accruedYield,
  campaignName,
}: {
  step: OperatorStep;
  donated: bigint | undefined;
  released: bigint | undefined;
  accruedYield: bigint | undefined;
  campaignName: string | null | undefined;
}) {
  const fmt = (v: bigint | undefined) => (v === undefined ? "—" : `${formatTokenAmount(v)} USDC`);

  return (
    <Card className={CONSOLE_CARD}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between font-serif text-lg">
          <span>{campaignName ?? "Campaign"}</span>
          <Badge variant="secondary">{STEP_LABEL[step.step]}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Donated</dt>
            <dd className="tabular-nums text-foreground">{fmt(donated)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Released</dt>
            <dd className="tabular-nums text-foreground">{fmt(released)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Yield</dt>
            <dd className="tabular-nums text-primary">{fmt(accruedYield)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
