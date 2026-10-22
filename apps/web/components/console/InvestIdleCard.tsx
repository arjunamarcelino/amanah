"use client";

import { CharityPoolAbi, ADDRESSES, CHAIN_ID } from "@amanah/shared";
import { ActionCard } from "./ActionCard";
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
    <ActionCard
      title="Invest idle"
      description="Deploy idle donations into the active adapter so yield can accrue."
      buttonLabel="Invest idle"
      pendingLabel="Investing…"
      pending={pending}
      phase={phase}
      error={error}
      txHash={txHash}
      onClick={onClick}
    />
  );
}
