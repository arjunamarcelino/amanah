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

const POOL = ADDRESSES[CHAIN_ID].CharityPool;

export type DonateStep = "idle" | "approving" | "donating" | "success" | "error";

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
 */
export function useDonateEngine() {
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const [step, setStep] = useState<DonateStep>("idle");
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
      setStep("error");
      return null;
    }
    try {
      if (currentAllowance < amount) {
        setStep("approving");
        const approveHash = await writeContractAsync({
          address: token,
          abi: MockStablecoinAbi,
          functionName: "approve",
          args: [POOL, amount], // exact approve
          chainId: CHAIN_ID,
        });
        const ar = await publicClient.waitForTransactionReceipt({ hash: approveHash });
        if (ar.status !== "success") throw new Error("Approve transaction reverted");
      }

      const consentHash = buildConsentHash({ campaignId, donor, stablecoin: token, amount });

      setStep("donating");
      const txHash = await writeContractAsync({
        address: POOL,
        abi: CharityPoolAbi,
        functionName: "donate",
        args: [campaignId, token, amount, consentHash],
        chainId: CHAIN_ID,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") throw new Error("Donation transaction reverted");

      const donated = parseDonatedEvent(receipt, POOL, {
        campaignId,
        stablecoin: token,
        donor,
        amount,
      });
      const res: DonateResult = {
        txHash,
        consentHash,
        baseOut: donated?.baseOut,
        logIndex: donated?.logIndex,
      };
      setResult(res);
      setStep("success");
      return res;
    } catch (e) {
      setError(txErrorMessage(e));
      setStep("error");
      return null;
    }
  }

  return { donate, step, error, result, pending: step === "approving" || step === "donating" };
}
