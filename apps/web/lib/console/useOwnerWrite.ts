"use client";

import { useCallback, useState } from "react";
import { useWriteContract, usePublicClient } from "wagmi";
import type { Hex, TransactionReceipt } from "viem";
import { CHAIN_ID } from "@amanah/shared";
import { sendAndConfirm, type TxPhase } from "../tx";
import { txErrorMessage } from "../txError";

export type OwnerWriteResult = { hash: Hex; receipt: TransactionReceipt };

// Generic owner-write driver shared by every console action (accrue, invest, fire,
// approve, release, setMode, recordAndPay). Wraps writeContractAsync in sendAndConfirm
// and exposes the canonical TxPhase machine. The caller supplies a fully-typed write
// thunk (so each contract call keeps viem's ABI inference — no `any`, no loose generics
// here). `pending` is the per-action in-flight disable (a single operator, one button at
// a time — no cross-card mutex needed).

export type UseOwnerWrite = {
  /** Build the write with wagmi's typed writeContractAsync, pass the thunk here. Resolves
   * to the confirmed { hash, receipt } (so callers can parse events without a second RPC
   * round-trip) or null on failure. */
  run: (write: () => Promise<Hex>, revertMessage: string) => Promise<OwnerWriteResult | null>;
  writeContractAsync: ReturnType<typeof useWriteContract>["writeContractAsync"];
  phase: TxPhase;
  error: string | null;
  txHash: Hex | null;
  pending: boolean;
  reset: () => void;
};

export function useOwnerWrite(): UseOwnerWrite {
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);

  const run = useCallback(
    async (write: () => Promise<Hex>, revertMessage: string): Promise<OwnerWriteResult | null> => {
      if (!publicClient) {
        setPhase("error");
        setError("No RPC client for Base Sepolia");
        return null;
      }
      setPhase("signing");
      setError(null);
      setTxHash(null);
      try {
        const { hash, receipt } = await sendAndConfirm(publicClient, write, revertMessage, (h) => {
          setTxHash(h);
          setPhase("mining");
        });
        setPhase("success");
        return { hash, receipt };
      } catch (e) {
        setError(txErrorMessage(e));
        setPhase("error");
        return null;
      }
    },
    [publicClient],
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setError(null);
    setTxHash(null);
  }, []);

  return {
    run,
    writeContractAsync,
    phase,
    error,
    txHash,
    pending: phase === "signing" || phase === "mining",
    reset,
  };
}
