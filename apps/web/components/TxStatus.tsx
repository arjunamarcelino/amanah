"use client";

import { txUrl } from "@amanah/shared";
import type { Hex } from "viem";

export type TxPhase = "idle" | "signing" | "mining" | "success" | "error";

export function TxStatus({
  phase,
  error,
  txHash,
  pendingLabel = "Processing transaction…",
}: {
  phase: TxPhase;
  error?: string | null;
  txHash?: Hex | null;
  pendingLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      {phase === "signing" ? <p className="text-foreground-soft">Confirm in your wallet…</p> : null}
      {phase === "mining" ? <p className="text-foreground-soft">{pendingLabel}</p> : null}
      {phase === "error" && error ? <p className="text-destructive">{error}</p> : null}
      {txHash ? (
        <a
          className="text-primary underline underline-offset-4"
          href={txUrl(txHash)}
          target="_blank"
          rel="noopener noreferrer"
        >
          View transaction on BaseScan
        </a>
      ) : null}
    </div>
  );
}
