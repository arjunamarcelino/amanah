"use client";

import { useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import {
  ADDRESSES,
  CHAIN_ID,
  CharityPoolAbi,
  MockStablecoinAbi,
  buildConsentHash,
} from "@amanah/shared";
import type { Address, Hex } from "viem";
import { parseDonatedEvent } from "@/lib/donations";
import { txErrorMessage } from "@/lib/txError";
import { sendAndConfirm, type TxPhase } from "@/lib/tx";

const POOL = ADDRESSES[CHAIN_ID].CharityPool;

export type DonateStage = "approve" | "donate" | null;

export type DonateResult = {
  txHash: Hex;
  consentHash: Hex;
  baseOut: bigint | undefined;
  logIndex: number | undefined;
};

/**
 * approve (exact, only if needed) -> donate -> parse Donated. The consentHash is
 * derived INLINE from the exact args passed to donate (S-1) — never from UI state.
 * Allowance is checked on every call so a retry after a mined approve skips it.
 *
 * Exposes a shared TxPhase (incl. "signing") + the current stage, so the UI can show
 * the "confirm in your wallet" prompt for each of the (up to two) signatures.
 */
export function useDonateEngine() {
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [stage, setStage] = useState<DonateStage>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DonateResult | null>(null);

  async function donate(params: {
    campaignId: Hex;
    token: Address;
    donor: Address;
    amount: bigint;
    currentAllowance: bigint;
  }): Promise<DonateResult | null> {
    const { campaignId, token, donor, amount, currentAllowance } = params;
    setError(null);
    setResult(null);
    if (!publicClient) {
      setError("No RPC client");
      setPhase("error");
      return null;
    }
    try {
      if (currentAllowance < amount) {
        setStage("approve");
        setPhase("signing");
        await sendAndConfirm(
          publicClient,
          () =>
            writeContractAsync({
              address: token,
              abi: MockStablecoinAbi,
              functionName: "approve",
              args: [POOL, amount], // exact approve
              chainId: CHAIN_ID,
            }),
          "Approve transaction reverted",
          () => setPhase("mining"),
        );
      }

      const consentHash = buildConsentHash({ campaignId, donor, stablecoin: token, amount });

      setStage("donate");
      setPhase("signing");
      const { hash, receipt } = await sendAndConfirm(
        publicClient,
        () =>
          writeContractAsync({
            address: POOL,
            abi: CharityPoolAbi,
            functionName: "donate",
            args: [campaignId, token, amount, consentHash],
            chainId: CHAIN_ID,
          }),
        "Donation transaction reverted",
        () => setPhase("mining"),
      );

      const donated = parseDonatedEvent(receipt, POOL, {
        campaignId,
        stablecoin: token,
        donor,
        amount,
      });
      const res: DonateResult = {
        txHash: hash,
        consentHash,
        baseOut: donated?.baseOut,
        logIndex: donated?.logIndex,
      };
      setResult(res);
      setPhase("success");
      return res;
    } catch (e) {
      setError(txErrorMessage(e));
      setPhase("error");
      return null;
    }
  }

  return {
    donate,
    phase,
    stage,
    error,
    result,
    pending: phase === "signing" || phase === "mining",
  };
}
