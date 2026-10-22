"use client";

import { MockYieldVaultAbi, MockHalalVaultAbi, ADDRESSES, CHAIN_ID } from "@amanah/shared";
import { Button } from "@amanah/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@amanah/ui/card";
import { TxStatus } from "@/components/TxStatus";
import { useOwnerWrite } from "@/lib/console/useOwnerWrite";

// Demo accrual rate in basis points — large enough that the ticker visibly moves.
const DEMO_ACCRUE_BPS = 150;

// Accrues yield on whichever adapter is active (halal → MockHalalVault, else MockYieldVault).
export function AccrueCard({
  halalMode,
  onSuccess,
}: {
  halalMode: boolean | undefined;
  onSuccess?: () => void;
}) {
  const { run, writeContractAsync, phase, error, txHash, pending } = useOwnerWrite();

  async function onClick() {
    const hash = await run(
      () =>
        halalMode
          ? writeContractAsync({
              address: ADDRESSES[CHAIN_ID].MockHalalVault,
              abi: MockHalalVaultAbi,
              functionName: "accrue",
              args: [DEMO_ACCRUE_BPS],
              chainId: CHAIN_ID,
            })
          : writeContractAsync({
              address: ADDRESSES[CHAIN_ID].MockYieldVault,
              abi: MockYieldVaultAbi,
              functionName: "accrue",
              args: [DEMO_ACCRUE_BPS],
              chainId: CHAIN_ID,
            }),
      "Accrue yield failed",
    );
    if (hash) onSuccess?.();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Accrue yield</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-foreground-soft">
          Accrue {(DEMO_ACCRUE_BPS / 100).toFixed(2)}% on the {halalMode ? "halal (sukuk)" : "standard"} adapter.
          If the ticker stays flat, invest idle funds first.
        </p>
        <Button className="w-fit" disabled={pending} onClick={onClick}>
          {pending ? "Accruing…" : "Accrue yield"}
        </Button>
        <TxStatus phase={phase} error={error} txHash={txHash} pendingLabel="Accruing…" />
      </CardContent>
    </Card>
  );
}
