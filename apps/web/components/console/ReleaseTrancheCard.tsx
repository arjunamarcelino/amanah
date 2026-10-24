"use client";

import { useState } from "react";
import type { Hex } from "viem";
import { CharityPoolAbi, ADDRESSES, CHAIN_ID, parseTrancheReleasedEvent } from "@amanah/shared";
import { Button } from "@amanah/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@amanah/ui/card";
import { CONSOLE_CARD } from "@/lib/console/ui";
import { TxStatus } from "@/components/TxStatus";
import { useOwnerWrite } from "@/lib/console/useOwnerWrite";
import { useConsoleSession } from "@/lib/console/session";
import { presetForSlug } from "@/lib/console/presets";
import { formatTokenAmount } from "@/lib/amount";
import { shortAddress } from "@/lib/address";

const POOL = ADDRESSES[CHAIN_ID].CharityPool;


// Releases a tranche to the preset beneficiary, then parses the TrancheReleased event and
// lifts the ACTUAL (possibly cap-limited) {payoutId, beneficiary, usdcAmount} into the
// session — those exact values must drive recordAndPay, not the preset, or it reverts.
export function ReleaseTrancheCard({
  campaignId,
  slug,
  enabled,
  disabledReason,
  remainingCap,
  onReleased,
}: {
  campaignId: Hex;
  slug: string;
  enabled: boolean;
  disabledReason?: string;
  remainingCap?: bigint;
  onReleased?: () => void;
}) {
  const { run, writeContractAsync, phase, error, txHash, pending } = useOwnerWrite();
  const session = useConsoleSession();
  const preset = presetForSlug(slug);
  const [parseError, setParseError] = useState<string | null>(null);

  if (!preset) {
    return (
      <Card className={CONSOLE_CARD}>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Release tranche</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No release preset configured for this campaign.</p>
        </CardContent>
      </Card>
    );
  }

  // Narrowed here (control-flow narrowing doesn't reach into the onRelease closure).
  const { trancheAmount, beneficiary } = preset;

  async function onRelease() {
    setParseError(null);
    const res = await run(
      () =>
        writeContractAsync({
          address: POOL,
          abi: CharityPoolAbi,
          functionName: "releaseTranche",
          args: [campaignId, trancheAmount, beneficiary],
          chainId: CHAIN_ID,
        }),
      "Release tranche failed",
    );
    if (!res) return;
    // Parse the event from the already-confirmed receipt (no second RPC round-trip / race).
    const ev = parseTrancheReleasedEvent(res.receipt, POOL, { campaignId });
    if (!ev) {
      setParseError(
        "Tranche released, but the TrancheReleased event could not be read — refresh and retry routing.",
      );
      return;
    }
    session.setReleased({
      payoutId: ev.payoutId,
      campaignId: ev.campaignId,
      beneficiary: ev.beneficiary,
      usdcAmount: ev.usdcAmount,
    });
    onReleased?.();
  }

  return (
    <Card className={CONSOLE_CARD}>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Release tranche</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Beneficiary</dt>
            <dd className="tabular-nums text-foreground">{shortAddress(preset.beneficiary)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Requested</dt>
            <dd className="tabular-nums text-foreground">{formatTokenAmount(preset.trancheAmount)} USDC</dd>
          </div>
          {remainingCap !== undefined && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Remaining cap</dt>
              <dd className="tabular-nums text-foreground-soft">{formatTokenAmount(remainingCap)} USDC</dd>
            </div>
          )}
        </dl>
        <Button className="mt-2 w-fit" disabled={pending || !enabled} onClick={onRelease}>
          {pending ? "Releasing…" : "Release tranche"}
        </Button>
        {!enabled && disabledReason && (
          <p className="text-xs text-muted-foreground">{disabledReason}</p>
        )}
        {parseError && <p className="text-sm text-destructive">{parseError}</p>}
        <TxStatus phase={phase} error={error} txHash={txHash} pendingLabel="Releasing…" />
      </CardContent>
    </Card>
  );
}
