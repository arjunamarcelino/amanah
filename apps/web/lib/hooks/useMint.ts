"use client";

import { useState } from "react";
import { useWriteContract, usePublicClient } from "wagmi";
import { MockStablecoinAbi, CHAIN_ID } from "@amanah/shared";
import type { Address, Hex } from "viem";
import { txErrorMessage } from "@/lib/txError";
import { sendAndConfirm, type TxPhase } from "@/lib/tx";

/** Mint flow for the public MockStablecoin faucet. Explicit per-step state machine. */
export function useMint() {
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);

  async function mint(token: Address, to: Address, amount: bigint) {
    setError(null);
    setTxHash(null);
    // Check the RPC client BEFORE broadcasting — never submit a tx and then report
    // "No RPC client" as a failure for a tx that actually mined.
    if (!publicClient) {
      setError("No RPC client");
      setPhase("error");
      return;
    }
    setPhase("signing");
    try {
      await sendAndConfirm(
        publicClient,
        () =>
          writeContractAsync({
            address: token,
            abi: MockStablecoinAbi,
            functionName: "mint",
            args: [to, amount],
            chainId: CHAIN_ID,
          }),
        "Mint transaction reverted",
        (hash) => {
          setTxHash(hash);
          setPhase("mining");
        },
      );
      setPhase("success");
    } catch (e) {
      setError(txErrorMessage(e));
      setPhase("error");
    }
  }

  return {
    mint,
    phase,
    error,
    txHash,
    pending: phase === "signing" || phase === "mining",
  };
}
