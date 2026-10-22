"use client";

import { useState } from "react";
import { useWriteContract, usePublicClient } from "wagmi";
import { MockStablecoinAbi, CHAIN_ID } from "@amanah/shared";
import type { Address, Hex } from "viem";
import { txErrorMessage } from "@/lib/txError";
import type { TxPhase } from "@/components/TxStatus";

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
    setPhase("signing");
    try {
      const hash = await writeContractAsync({
        address: token,
        abi: MockStablecoinAbi,
        functionName: "mint",
        args: [to, amount],
        chainId: CHAIN_ID,
      });
      setTxHash(hash);
      setPhase("mining");
      if (!publicClient) throw new Error("No RPC client");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Mint transaction reverted");
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
