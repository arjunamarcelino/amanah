"use client";

import type { Hex } from "viem";
import { ReleaseControllerAbi, ADDRESSES, CHAIN_ID, type ReleaseType } from "@amanah/shared";
import { Button } from "@amanah/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@amanah/ui/card";
import { CONSOLE_CARD } from "@/lib/console/ui";
import { TxStatus } from "@/components/TxStatus";
import { useOwnerWrite } from "@/lib/console/useOwnerWrite";

const CONTROLLER = ADDRESSES[CHAIN_ID].ReleaseController;

// Renders EXACTLY ONE control based on the campaign's on-chain releaseType:
// PARAMETRIC → Fire trigger (fire); MILESTONE → Approve milestone (approveMilestone).
// Showing both would invite firing the wrong condition.
export function ReleaseConditionCard({
  campaignId,
  releaseType,
  canRelease,
  detail,
  onSuccess,
}: {
  campaignId: Hex;
  releaseType: ReleaseType | undefined;
  canRelease: boolean | undefined;
  detail: string;
  onSuccess?: () => void;
}) {
  const { run, writeContractAsync, phase, error, txHash, pending } = useOwnerWrite();

  if (releaseType === undefined) {
    return (
      <Card className={CONSOLE_CARD}>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Release condition</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Campaign is not registered on the release controller.</p>
        </CardContent>
      </Card>
    );
  }

  const isParametric = releaseType === "PARAMETRIC";
  const label = isParametric ? "Fire trigger" : "Approve milestone";
  const title = isParametric ? "Parametric trigger" : "Milestone approval";

  async function onClick() {
    const res = await run(
      () =>
        writeContractAsync({
          address: CONTROLLER,
          abi: ReleaseControllerAbi,
          functionName: isParametric ? "fire" : "approveMilestone",
          args: [campaignId, detail],
          chainId: CHAIN_ID,
        }),
      `${label} failed`,
    );
    if (res) onSuccess?.();
  }

  return (
    <Card className={CONSOLE_CARD}>
      <CardHeader>
        <CardTitle className="font-serif text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-foreground-soft">
          {isParametric ? "Trigger condition" : "Milestone"}: <span className="text-foreground">{detail}</span>
        </p>
        {canRelease ? (
          <p className="text-sm text-primary">Condition already met — ready to release.</p>
        ) : (
          <Button className="w-fit" disabled={pending} onClick={onClick}>
            {pending ? "Submitting…" : label}
          </Button>
        )}
        <TxStatus phase={phase} error={error} txHash={txHash} pendingLabel="Submitting…" />
      </CardContent>
    </Card>
  );
}
