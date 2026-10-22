"use client";

import { MockYieldVaultAbi, MockHalalVaultAbi, ADDRESSES, CHAIN_ID } from "@amanah/shared";
import { ActionCard } from "./ActionCard";
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
    const res = await run(
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
    if (res) onSuccess?.();
  }

  return (
    <ActionCard
      title="Accrue yield"
      description={`Accrue ${(DEMO_ACCRUE_BPS / 100).toFixed(2)}% on the ${
        halalMode ? "halal (sukuk)" : "standard"
      } adapter. If the ticker stays flat, invest idle funds first.`}
      buttonLabel="Accrue yield"
      pendingLabel="Accruing…"
      pending={pending}
      phase={phase}
      error={error}
      txHash={txHash}
      onClick={onClick}
    />
  );
}
