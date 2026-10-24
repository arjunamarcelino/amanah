"use client";

import { CharityPoolAbi, ADDRESSES, CHAIN_ID } from "@amanah/shared";
import { Button } from "@amanah/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@amanah/ui/card";
import { CONSOLE_CARD } from "@/lib/console/ui";
import { Badge } from "@amanah/ui/badge";
import { TxStatus } from "@/components/TxStatus";
import { useOwnerWrite } from "@/lib/console/useOwnerWrite";
import { useConsoleSession } from "@/lib/console/session";

const POOL = ADDRESSES[CHAIN_ID].CharityPool;

// setMode divests from one adapter and reinvests in the other — slow and principal-moving,
// so it is a deliberate owner action with a pending state, LOCKED while a payout is mid-flight
// (release→route). The 🌙 badge reflects the halalMode() chain read (parent-provided), flipping
// only after the tx confirms and the read refetches — never optimistically.
export function HalalToggle({
  halalMode,
  onSuccess,
}: {
  halalMode: boolean | undefined;
  onSuccess?: () => void;
}) {
  const { run, writeContractAsync, phase, error, txHash, pending } = useOwnerWrite();
  const { locked } = useConsoleSession();

  async function onToggle() {
    if (halalMode === undefined) return;
    const res = await run(
      () =>
        writeContractAsync({
          address: POOL,
          abi: CharityPoolAbi,
          functionName: "setMode",
          args: [!halalMode],
          chainId: CHAIN_ID,
        }),
      "Switch mode failed",
    );
    if (res) onSuccess?.();
  }

  return (
    <Card className={CONSOLE_CARD}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-lg">
          Treasury mode
          {halalMode ? (
            <Badge variant="secondary" className="gap-1.5">
              <span aria-hidden>🌙</span> Halal
            </Badge>
          ) : (
            <Badge variant="secondary">Standard</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-foreground-soft">
          {halalMode
            ? "Yield is routed to sukuk-style, interest-free instruments."
            : "Switch to halal mode to route yield to interest-free instruments."}
        </p>
        <Button
          variant="outline"
          className="w-fit"
          disabled={pending || locked || halalMode === undefined}
          onClick={onToggle}
        >
          {pending ? "Rebalancing…" : halalMode ? "Switch to standard" : "Switch to halal"}
        </Button>
        {locked && (
          <p className="text-xs text-muted-foreground">
            Locked while a payout is in flight — complete or route the released tranche first.
          </p>
        )}
        <TxStatus phase={phase} error={error} txHash={txHash} pendingLabel="Rebalancing…" />
      </CardContent>
    </Card>
  );
}
