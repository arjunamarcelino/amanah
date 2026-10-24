"use client";

import type { Hex } from "viem";
import { Button } from "@amanah/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@amanah/ui/card";
import { CONSOLE_CARD } from "@/lib/console/ui";
import { TxStatus, type TxPhase } from "@/components/TxStatus";

// Shared shell for the simple single-button owner actions (invest / accrue): title +
// description + a pending-aware Button + TxStatus. Cards with richer bodies (halal toggle,
// release condition/tranche) keep their own layout.
export function ActionCard({
  title,
  description,
  buttonLabel,
  pendingLabel,
  pending,
  phase,
  error,
  txHash,
  onClick,
  disabled,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  pendingLabel: string;
  pending: boolean;
  phase: TxPhase;
  error: string | null;
  txHash: Hex | null;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Card className={CONSOLE_CARD}>
      <CardHeader>
        <CardTitle className="font-serif text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-foreground-soft">{description}</p>
        <Button className="w-fit" disabled={pending || disabled} onClick={onClick}>
          {pending ? pendingLabel : buttonLabel}
        </Button>
        <TxStatus phase={phase} error={error} txHash={txHash} pendingLabel={pendingLabel} />
      </CardContent>
    </Card>
  );
}
