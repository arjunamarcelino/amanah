"use client";

import type { Hex } from "viem";
import { usePublicClient } from "wagmi";
import { CharityPoolAbi, ADDRESSES, CHAIN_ID, parseTrancheReleasedEvent } from "@amanah/shared";
import { Button } from "@amanah/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@amanah/ui/card";
import { TxStatus } from "@/components/TxStatus";
import { useOwnerWrite } from "@/lib/console/useOwnerWrite";
import { useConsoleSession } from "@/lib/console/session";
import { presetForSlug } from "@/lib/console/presets";
import { formatTokenAmount } from "@/lib/amount";

const POOL = ADDRESSES[CHAIN_ID].CharityPool;

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

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
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const session = useConsoleSession();
  const preset = presetForSlug(slug);

  if (!preset) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Release tranche</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No release preset configured for this campaign.</p>
        </CardContent>
      </Card>
    );
  }

  async function onRelease() {
    const hash = await run(
      () =>
        writeContractAsync({
          address: POOL,
          abi: CharityPoolAbi,
          functionName: "releaseTranche",
          args: [campaignId, preset!.trancheAmount, preset!.beneficiary],
          chainId: CHAIN_ID,
        }),
      "Release tranche failed",
    );
    if (!hash || !publicClient) return;
    const receipt = await publicClient.getTransactionReceipt({ hash });
    const ev = parseTrancheReleasedEvent(receipt, POOL, { campaignId });
    if (ev) {
      session.setReleased({
        payoutId: ev.payoutId,
        campaignId: ev.campaignId,
        beneficiary: ev.beneficiary,
        usdcAmount: ev.usdcAmount,
      });
    }
    onReleased?.();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Release tranche</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Beneficiary</dt>
            <dd className="tabular-nums text-foreground">{short(preset.beneficiary)}</dd>
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
        <TxStatus phase={phase} error={error} txHash={txHash} pendingLabel="Releasing…" />
      </CardContent>
    </Card>
  );
}
