"use client";

import { CharityPoolAbi, ADDRESSES, CHAIN_ID } from "@amanah/shared";
import { Button } from "@amanah/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@amanah/ui/card";
import { TxStatus } from "@/components/TxStatus";
import { useOwnerWrite } from "@/lib/console/useOwnerWrite";

const POOL = ADDRESSES[CHAIN_ID].CharityPool;

// Deploys idle donations into the active yield adapter. Yield only accrues once funds
// are deployed, so this precedes Accrue on a fresh campaign.
export function InvestIdleCard({ onSuccess }: { onSuccess?: () => void }) {
  const { run, writeContractAsync, phase, error, txHash, pending } = useOwnerWrite();

  async function onClick() {
    const res = await run(
      () => writeContractAsync({ address: POOL, abi: CharityPoolAbi, functionName: "investIdle", chainId: CHAIN_ID }),
      "Invest idle failed",
    );
    if (res) onSuccess?.();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Invest idle</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-foreground-soft">
          Deploy idle donations into the active adapter so yield can accrue.
        </p>
        <Button className="w-fit" disabled={pending} onClick={onClick}>
          {pending ? "Investing…" : "Invest idle"}
        </Button>
        <TxStatus phase={phase} error={error} txHash={txHash} pendingLabel="Investing…" />
      </CardContent>
    </Card>
  );
}
